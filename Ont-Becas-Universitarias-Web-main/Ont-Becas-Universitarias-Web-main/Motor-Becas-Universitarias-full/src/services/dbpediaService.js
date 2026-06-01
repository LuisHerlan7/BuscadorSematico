const axios = require('axios');
const dbpediaConfig = require('../config/dbpedia');

// Palabras clave exactas provistas por el usuario (NO MODIFICADAS)
const SCHOLARSHIP_KEYWORDS = [
  'scholarship', 'fellowship', 'grant', 'bursary', 'exchange',
  'beca', 'estudio', 'universit', 'educa', 'award', 'fellow',
  'programa', 'program', 'fund', 'financi', 'subvencion', 'ayuda',
  'stipend', 'erasmus', 'fulbright', 'daad', 'maestria', 'doctorado',
  'academic', 'academics', 'research', 'investigacion', 'student',
  'alumno', 'becario'
];

class DBpediaService {
  _getEndpoint() {
    return dbpediaConfig.endpoint;
  }

  /**
   * Construye el término de búsqueda FTS.
   * Se añaden mapeos semánticos para que si el usuario busca "requisitos",
   * el motor de DBpedia entienda y busque también "requirements" o "eligibility".
   */
  _buildBifTerm(term) {
    const esEnMap = {
      'beca': 'scholarship',
      'becas': 'scholarship',
      'universitaria': 'university',
      'universitarias': 'university',
      'universidad': 'university',
      'maestria': 'master',
      'doctorado': 'phd',
      'intercambio': 'exchange',
      'investigacion': 'research',
      'pregrado': 'undergraduate',
      'posgrado': 'graduate',
      'excelencia': 'excellence',
      'movilidad': 'mobility',
      // Mapeos específicos orientados a requisitos solicitados:
      'requisitos': 'requirements',
      'requisito': 'requirement',
      'elegibilidad': 'eligibility',
      'criterios': 'criteria',
      'postulacion': 'application'
    };

    const normalized = String(term || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

    const words = normalized.split(/\s+/).filter(w => w.length >= 3);
    if (words.length === 0) return "'scholarship'";

    const allWords = new Set();
    for (const w of words) {
      allWords.add(w);
      if (esEnMap[w]) allWords.add(esEnMap[w]);
    }

    return Array.from(allWords)
      .slice(0, 6) // Ampliado ligeramente para cubrir términos de requisitos
      .map(w => `'${w}'`)
      .join(' OR ');
  }

  /**
   * Filtro del lado de Node.js para asegurar relevancia con la lista estricta.
   */
  _filterScholarshipResults(bindings) {
    const seen = new Set();
    const results = [];

    for (const b of bindings) {
      const uri = b.scholarship?.value;
      const label = (b.label?.value || '').toLowerCase();
      const desc = (b.desc?.value || '').toLowerCase();

      if (!uri || seen.has(uri)) continue;

      const relevant = SCHOLARSHIP_KEYWORDS.some(k => label.includes(k) || desc.includes(k));
      if (!relevant) continue;

      seen.add(uri);
      results.push({
        uri,
        safeUri: encodeURIComponent(uri),
        label: b.label?.value || '',
        name: b.label?.value || '',
        description: b.desc?.value || '',
        abstract: b.desc?.value || '',
        source: 'dbpedia'
      });
    }

    return results;
  }

  /**
   * BUSCADOR DE BECAS:
   * Realiza la consulta semántica limpiando ruido y priorizando entidades académicas.
   */
  async searchScholarships(term, lang = 'es') {
    if (!term || !String(term).trim()) return [];

    const bifTerm = this._buildBifTerm(term);

    const query = `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT DISTINCT ?scholarship ?label ?desc WHERE {
        ?scholarship rdfs:label ?label .
        ?label bif:contains "${bifTerm.replace(/"/g, '\\"')}" .
        FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en")

        OPTIONAL { ?scholarship dbo:description ?d .  FILTER(LANG(?d)  = "${lang}" || LANG(?d)  = "en") }
        OPTIONAL { ?scholarship rdfs:comment    ?c .  FILTER(LANG(?c)  = "${lang}" || LANG(?c)  = "en") }
        OPTIONAL { ?scholarship dbo:abstract    ?a .  FILTER(LANG(?a)  = "${lang}" || LANG(?a)  = "en") }

        BIND(COALESCE(?d, ?c, ?a) AS ?desc)

        # Filtros semánticos estrictos para evitar personas o lugares con la palabra "beca" en su biografía
        MINUS { ?scholarship a dbo:Person }
        MINUS { ?scholarship a dbo:Place }
        MINUS { ?scholarship a dbo:Book }
        MINUS { ?scholarship a dbo:Film }
      }
      ORDER BY DESC(BOUND(?desc))
      LIMIT 100
    `;

    try {
      const response = await axios.get(this._getEndpoint(), {
        params: { query, format: 'json', timeout: 8000 },
        timeout: 9000
      });

      const bindings = response.data?.results?.bindings || [];
      return this._filterScholarshipResults(bindings);
    } catch (error) {
      this._handleError(error);
      return [];
    }
  }

  /**
   * DETALLES DE LA BECA Y SUS REQUISITOS:
   * Extrae de forma dirigida los campos de requisitos y criterios de elegibilidad mapeados por DBpedia.
   */
  async getScholarshipDetails(uri, lang = 'es') {
    const query = `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbp: <http://dbpedia.org/property/>

      SELECT ?label ?d ?c ?a ?thumbnail ?eligibility ?requirements ?criteria WHERE {
        BIND(<${uri}> AS ?s)
        OPTIONAL { ?s rdfs:label ?label .    FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en") }
        OPTIONAL { ?s dbo:description ?d .   FILTER(LANG(?d)  = "${lang}" || LANG(?d)  = "en") }
        OPTIONAL { ?s rdfs:comment    ?c .   FILTER(LANG(?c)  = "${lang}" || LANG(?c)  = "en") }
        OPTIONAL { ?s dbo:abstract    ?a .   FILTER(LANG(?a)  = "${lang}" || LANG(?a)  = "en") }
        OPTIONAL { ?s dbo:thumbnail   ?thumbnail }
        
        # Propiedades de Requisitos extraídas desde las cajas de información (Infoboxes) de Wikipedia
        OPTIONAL { ?s dbp:eligibility ?eligibility }
        OPTIONAL { ?s dbp:requirements ?requirements }
        OPTIONAL { ?s dbp:criteria ?criteria }
      }
    `;

    try {
      const response = await axios.get(this._getEndpoint(), {
        params: { query, format: 'json', timeout: 8000 },
        timeout: 9000
      });

      const rows = response.data?.results?.bindings || [];
      if (rows.length === 0) return null;

      // Selección de idioma preferente para textos básicos
      const labelRow = rows.find(r => r.label?.['xml:lang'] === lang) || rows[0];
      const descRow = rows.find(r => (r.d || r.c || r.a) && (r.d?.['xml:lang'] === lang || r.c?.['xml:lang'] === lang || r.a?.['xml:lang'] === lang)) || rows[0];
      const thumbnail = rows.find(r => r.thumbnail)?.thumbnail?.value || null;

      const desc = descRow?.d?.value || descRow?.c?.value || descRow?.a?.value || '';

      // Procesamiento dirigido de Requisitos / Criterios detectados en DBpedia
      const rawRequirements = rows.find(r => r.requirements)?.requirements?.value;
      const rawEligibility = rows.find(r => r.eligibility)?.eligibility?.value;
      const rawCriteria = rows.find(r => r.criteria)?.criteria?.value;

      // Se unifican en un formato legible para el frontend
      let requirementsText = rawRequirements || rawEligibility || rawCriteria || null;

      return {
        uri,
        label: labelRow?.label?.value || uri,
        name: labelRow?.label?.value || uri,
        abstract: desc,
        description: desc,
        thumbnail,
        requirements: requirementsText, // Nueva propiedad conteniendo los requisitos explícitos
        source: 'dbpedia'
      };
    } catch (error) {
      this._handleError(error);
      return null;
    }
  }

  async searchByIntent(intentObj, lang = 'es') {
    if (!intentObj || intentObj.intent !== 'query_property') return [];
    const value = intentObj.value || '';
    return this.searchScholarships(value, lang);
  }

  _handleError(error) {
    console.error('DBpedia Service Error Custom Log:');
    console.error(`  Message: ${error.message}`);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
    }
  }
}

module.exports = new DBpediaService();