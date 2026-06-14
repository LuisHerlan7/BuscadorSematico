const axios = require('axios');
const dbpediaConfig = require('../config/dbpedia');
const rdfService = require('./rdfService');

// Keywords estrictos de becas universitarias en 5 idiomas
const SCHOLARSHIP_KEYWORDS = [
  // Español
  'beca', 'becas', 'becario', 'estipendio',
  // Inglés
  'scholarship', 'scholarships', 'fellowship', 'fellowships',
  'bursary', 'bursaries', 'studentship',
  // Portugués
  'bolsa', 'bolsas',
  // Francés
  'bourse', 'bourses',
  // Alemán
  'stipendium', 'stipendien',
  // Nombres propios de becas conocidas
  'fulbright', 'erasmus', 'chevening', 'daad', 'rhodes', 'marshall',
  'carolina', 'gates cambridge', 'schwarzman',
  // Términos académicos clave (solo los más específicos)
  'grant', 'award', 'exchange program', 'academic exchange',
  'intercambio académico', 'movilidad estudiantil'
];

// Palabras que indican que un resultado NO es una beca universitaria
const EXCLUSION_KEYWORDS = [
  'football', 'soccer', 'basketball', 'baseball', 'cricket',
  'wrestling', 'boxing', 'rugby', 'hockey', 'tennis',
  'album', 'discography', 'filmography', 'tv series', 'movie',
  'politician', 'military', 'battle', 'war',
  'genus', 'species', 'phylum'
];

class DBpediaService {
  _getEndpoint() {
    return dbpediaConfig.endpoint;
  }

  searchOfflineScholarships(term, lang = 'es') {
    return rdfService.searchOfflineDbpediaScholarships(term, lang);
  }

  getOfflineScholarshipDetails(uri, lang = 'es') {
    return rdfService.getOfflineDbpediaScholarshipDetails(uri, lang);
  }

  /**
   * Mapeos multilingüe para 5 idiomas → inglés (idioma base de DBpedia).
   * Siempre inyecta "scholarship" como término base.
   */
  _buildBifTerm(term, lang = 'es') {
    const multiLangMap = {
      // Español
      'beca': 'scholarship', 'becas': 'scholarship',
      'universitaria': 'university scholarship', 'universitarias': 'university scholarship',
      'universidad': 'university', 'maestria': 'master scholarship',
      'doctorado': 'doctoral scholarship', 'intercambio': 'exchange scholarship',
      'investigacion': 'research fellowship', 'pregrado': 'undergraduate scholarship',
      'posgrado': 'graduate scholarship', 'excelencia': 'excellence scholarship',
      'movilidad': 'mobility scholarship',
      'requisitos': 'scholarship requirements', 'requisito': 'scholarship requirement',
      'elegibilidad': 'scholarship eligibility',
      'criterios': 'scholarship criteria', 'postulacion': 'scholarship application',
      // Portugués
      'bolsa': 'scholarship', 'bolsas': 'scholarship',
      'universidade': 'university', 'universitaria': 'university scholarship',
      'mestrado': 'master scholarship', 'doutorado': 'doctoral scholarship',
      'intercambio': 'exchange scholarship', 'pesquisa': 'research fellowship',
      'graduacao': 'graduate scholarship', 'pos-graduacao': 'postgraduate scholarship',
      // Francés
      'bourse': 'scholarship', 'bourses': 'scholarship',
      'universite': 'university', 'universitaire': 'university scholarship',
      'maitrise': 'master scholarship', 'doctorat': 'doctoral scholarship',
      'echange': 'exchange scholarship', 'recherche': 'research fellowship',
      'licence': 'undergraduate scholarship',
      // Alemán
      'stipendium': 'scholarship', 'stipendien': 'scholarship',
      'universitat': 'university', 'universitaet': 'university',
      'forschung': 'research fellowship', 'austausch': 'exchange scholarship',
      'doktorand': 'doctoral scholarship', 'master': 'master scholarship',
      'studium': 'study scholarship', 'forderung': 'funding scholarship',
      'hochschule': 'university'
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
    // Siempre incluir "scholarship" para forzar relevancia
    allWords.add('scholarship');

    for (const w of words) {
      // Agregar la palabra original si no es un conector
      if (!['para', 'los', 'las', 'des', 'les', 'der', 'die', 'das', 'the', 'for', 'and'].includes(w)) {
        allWords.add(w);
      }
      if (multiLangMap[w]) {
        // Puede ser una frase como "university scholarship"
        multiLangMap[w].split(' ').forEach(part => allWords.add(part));
      }
    }

    return Array.from(allWords)
      .slice(0, 8)
      .map(w => `'${w}'`)
      .join(' OR ');
  }

  /**
   * Filtro estricto: solo entidades que realmente son becas universitarias.
   */
  _filterScholarshipResults(bindings) {
    const seen = new Set();
    const results = [];

    for (const b of bindings) {
      const uri = b.scholarship?.value;
      const label = (b.label?.value || '').toLowerCase();
      const desc = (b.desc?.value || '').toLowerCase();
      const cats = (b.cats?.value || '').toLowerCase();
      const combined = `${label} ${desc} ${cats}`;

      if (!uri || seen.has(uri)) continue;

      // Verificar relevancia: al menos un keyword de beca debe estar presente
      const relevant = SCHOLARSHIP_KEYWORDS.some(k => combined.includes(k));
      if (!relevant) continue;

      // Verificar que NO sea un resultado irrelevante (deportes, cine, etc.)
      const excluded = EXCLUSION_KEYWORDS.some(k => combined.includes(k));
      if (excluded) continue;

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
   * BUSCADOR DE BECAS UNIVERSITARIAS:
   * Consulta SPARQL enfocada en entidades académicas con filtro por categoría y tipo.
   * Busca en múltiples idiomas y combina resultados remotos con offline.
   */
  async searchScholarships(term, lang = 'es') {
    if (!term || !String(term).trim()) return [];

    const bifTerm = this._buildBifTerm(term, lang);

    // Construir lista de idiomas para labels: el idioma del usuario + inglés + español
    const langSet = new Set([lang, 'en', 'es']);
    const langFilters = Array.from(langSet)
      .map(l => `LANG(?label) = "${l}"`)
      .join(' || ');

    const query = `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

      SELECT DISTINCT ?scholarship ?label ?desc ?cats WHERE {
        ?scholarship rdfs:label ?label .
        ?label bif:contains "${bifTerm.replace(/"/g, '\\"')}" .
        FILTER(${langFilters})

        OPTIONAL { ?scholarship dbo:abstract ?a . FILTER(LANG(?a) = "${lang}") }
        OPTIONAL { ?scholarship dbo:abstract ?a_en . FILTER(LANG(?a_en) = "en") }
        OPTIONAL { ?scholarship rdfs:comment ?c . FILTER(LANG(?c) = "${lang}") }
        OPTIONAL { ?scholarship rdfs:comment ?c_en . FILTER(LANG(?c_en) = "en") }

        BIND(COALESCE(?a, ?c, ?a_en, ?c_en) AS ?desc)

        # Obtener categorías para filtrado
        OPTIONAL {
          ?scholarship dcterms:subject ?cat .
          ?cat rdfs:label ?catLabel .
          FILTER(LANG(?catLabel) = "en")
        }
        BIND(COALESCE(?catLabel, "") AS ?cats)

        # Excluir personas, lugares, libros, películas, deportistas
        MINUS { ?scholarship a dbo:Person }
        MINUS { ?scholarship a dbo:Place }
        MINUS { ?scholarship a dbo:Book }
        MINUS { ?scholarship a dbo:Film }
        MINUS { ?scholarship a dbo:Athlete }
        MINUS { ?scholarship a dbo:SportsTeam }
        MINUS { ?scholarship a dbo:MilitaryConflict }
        MINUS { ?scholarship a dbo:Animal }
        MINUS { ?scholarship a dbo:Plant }
        MINUS { ?scholarship a dbo:MusicalWork }
        MINUS { ?scholarship a dbo:Album }
      }
      ORDER BY DESC(BOUND(?desc))
      LIMIT 80
    `;

    let remoteResults = [];
    try {
      const response = await axios.get(this._getEndpoint(), {
        params: { query, format: 'json', timeout: 14000 },
        timeout: 15000
      });

      const bindings = response.data?.results?.bindings || [];
      remoteResults = this._filterScholarshipResults(bindings);
    } catch (error) {
      this._handleError(error);
    }

    // Siempre intentar obtener resultados offline también
    let offlineResults = [];
    try {
      offlineResults = await this.searchOfflineScholarships(term, lang);
    } catch (err) {
      // silencioso
    }

    // Combinar: primero remotos, luego offline (sin duplicados)
    const seenUris = new Set(remoteResults.map(r => r.uri));
    const combined = [...remoteResults];
    for (const r of offlineResults) {
      if (!seenUris.has(r.uri)) {
        seenUris.add(r.uri);
        combined.push(r);
      }
    }

    return combined;
  }

  /**
   * DETALLES DE LA BECA Y SUS REQUISITOS
   */
  async getScholarshipDetails(uri, lang = 'es') {
    const query = `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbp: <http://dbpedia.org/property/>

      SELECT ?label ?label_en ?d ?d_en ?c ?c_en ?a ?a_en ?thumbnail ?eligibility ?requirements ?criteria WHERE {
        BIND(<${uri}> AS ?s)
        OPTIONAL { ?s rdfs:label ?label .    FILTER(LANG(?label) = "${lang}") }
        OPTIONAL { ?s rdfs:label ?label_en . FILTER(LANG(?label_en) = "en") }
        OPTIONAL { ?s dbo:description ?d .   FILTER(LANG(?d)  = "${lang}") }
        OPTIONAL { ?s dbo:description ?d_en . FILTER(LANG(?d_en) = "en") }
        OPTIONAL { ?s rdfs:comment    ?c .   FILTER(LANG(?c)  = "${lang}") }
        OPTIONAL { ?s rdfs:comment    ?c_en . FILTER(LANG(?c_en) = "en") }
        OPTIONAL { ?s dbo:abstract    ?a .   FILTER(LANG(?a)  = "${lang}") }
        OPTIONAL { ?s dbo:abstract    ?a_en . FILTER(LANG(?a_en) = "en") }
        OPTIONAL { ?s dbo:thumbnail   ?thumbnail }
        
        # Propiedades de Requisitos extraídas desde las cajas de información (Infoboxes) de Wikipedia
        OPTIONAL { ?s dbp:eligibility ?eligibility }
        OPTIONAL { ?s dbp:requirements ?requirements }
        OPTIONAL { ?s dbp:criteria ?criteria }
      }
    `;

    try {
      const response = await axios.get(this._getEndpoint(), {
        params: { query, format: 'json', timeout: 14000 },
        timeout: 15000
      });

      const rows = response.data?.results?.bindings || [];
      if (rows.length === 0) return this.getOfflineScholarshipDetails(uri, lang);

      // Selección de idioma preferente para textos básicos
      const labelRow = rows.find(r => r.label?.['xml:lang'] === lang)
        || rows.find(r => r.label_en)
        || rows[0];

      const descRow = rows.find(r => (r.d || r.c || r.a) && ((r.d?.['xml:lang'] === lang) || (r.c?.['xml:lang'] === lang) || (r.a?.['xml:lang'] === lang)))
        || rows.find(r => r.d_en || r.c_en || r.a_en)
        || rows[0];

      const thumbnail = rows.find(r => r.thumbnail)?.thumbnail?.value || null;
      const desc = descRow?.d?.value || descRow?.c?.value || descRow?.a?.value || descRow?.d_en?.value || descRow?.c_en?.value || descRow?.a_en?.value || '';

      // Procesamiento dirigido de Requisitos / Criterios detectados en DBpedia
      const rawRequirements = rows.find(r => r.requirements)?.requirements?.value;
      const rawEligibility = rows.find(r => r.eligibility)?.eligibility?.value;
      const rawCriteria = rows.find(r => r.criteria)?.criteria?.value;

      // Se unifican en un formato legible para el frontend
      let requirementsText = rawRequirements || rawEligibility || rawCriteria || null;

      return {
        uri,
        label: labelRow?.label?.value || labelRow?.label_en?.value || uri,
        name: labelRow?.label?.value || labelRow?.label_en?.value || uri,
        abstract: desc,
        description: desc,
        thumbnail,
        requirements: requirementsText,
        source: 'dbpedia'
      };
    } catch (error) {
      this._handleError(error);
      return this.getOfflineScholarshipDetails(uri, lang);
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
