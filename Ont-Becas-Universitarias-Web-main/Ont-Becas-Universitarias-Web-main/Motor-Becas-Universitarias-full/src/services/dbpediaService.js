const axios = require('axios');
const dbpediaConfig = require('../config/dbpedia');
const rdfService = require('./rdfService');

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

  _getWikidataEndpoint() {
    return 'https://query.wikidata.org/sparql';
  }

  searchOfflineScholarships(term, lang = 'es') {
    return rdfService.searchOfflineDbpediaScholarships(term, lang);
  }

  getOfflineScholarshipDetails(uri, lang = 'es') {
    return rdfService.getOfflineDbpediaScholarshipDetails(uri, lang);
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
    const explicitScholarship = /\b(scholarship|fellowship|grant|bursary|beca|bolsa|bourse|stipendium|stipendien|subvencion|financi)\b/i;
    const academicProgram = /\b(erasmus\+|erasmus programme|erasmus program|erasmus mundus|fulbright|daad|chevening|rhodes scholarship|exchange program|student exchange|mobility program)\b/i;
    const noisyResource = /(disambiguation|list_of_|category:|_song|_hospital|_train|_house|_castle|_academy|_school|_college|_university|minor_planets|taxa_named|portrait_of|martyrdom|saint_erasmus|erasmus_of_formia|cereopsius|hypolycaena|crypt_of)/i;

    for (const b of bindings) {
      const uri = b.scholarship?.value;
      const label = (b.label?.value || '').toLowerCase();
      const desc = (b.desc?.value || '').toLowerCase();

      if (!uri || seen.has(uri)) continue;

      if (noisyResource.test(uri)) continue;

      const haystack = `${label} ${desc}`;
      const relevant = explicitScholarship.test(haystack) || academicProgram.test(haystack);
      if (!relevant) continue;

      seen.add(uri);
      results.push({
        uri,
        safeUri: encodeURIComponent(uri),
        dbpediaUri: uri,
        dbpediaPage: uri,
        label: b.label?.value || '',
        name: b.label?.value || '',
        description: b.desc?.value || '',
        abstract: b.desc?.value || '',
        source: 'dbpedia'
      });
    }

    return results;
  }

  _escapeSparqlText(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  _isWikidataFallbackLang(lang) {
    return ['pt', 'de', 'fr'].includes(lang);
  }

  _wikidataEntityId(uri) {
    const match = String(uri || '').match(/\/(Q[0-9]+)$/);
    return match ? match[1] : null;
  }

  _filterWikiScholarshipResults(bindings) {
    const seen = new Set();
    const results = [];
    const multilingualScholarshipPattern = /\b(scholarship|fellowship|grant|bursary|beca|bolsa|bourse|stipendium|stipendien|subvencion|financi)\b/i;

    for (const b of bindings) {
      const uri = b.item?.value;
      const label = b.itemLabel?.value || '';
      const desc = b.itemDescription?.value || '';
      const labelLower = label.toLowerCase();
      const haystack = `${label} ${desc}`.toLowerCase();

      if (!uri || seen.has(uri)) continue;
      if (!multilingualScholarshipPattern.test(haystack)) continue;
      if (!multilingualScholarshipPattern.test(label) && !/erasmus\s*[-+]?(\+|program|programm|programme)/i.test(labelLower)) continue;

      seen.add(uri);
      results.push({
        uri,
        safeUri: encodeURIComponent(uri),
        dbpediaUri: uri,
        dbpediaPage: uri,
        label,
        name: label,
        description: desc,
        abstract: desc,
        source: 'dbpedia'
      });
    }

    return results;
  }

  async searchWikidataScholarships(term, lang = 'es') {
    if (!term || !String(term).trim()) return [];

    const query = `
      PREFIX bd: <http://www.bigdata.com/rdf#>
      PREFIX mwapi: <https://www.mediawiki.org/ontology#API/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX schema: <http://schema.org/>
      PREFIX wikibase: <http://wikiba.se/ontology#>

      SELECT ?item ?itemLabel ?itemDescription WHERE {
        SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:endpoint "www.wikidata.org";
                          wikibase:api "EntitySearch";
                          mwapi:search "${this._escapeSparqlText(term)}";
                          mwapi:language "${lang}".
          ?item wikibase:apiOutputItem mwapi:item.
        }
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "${lang},en,es".
          ?item rdfs:label ?itemLabel.
          ?item schema:description ?itemDescription.
        }
      }
      LIMIT 40
    `;

    try {
      const response = await axios.get(this._getWikidataEndpoint(), {
        params: { query, format: 'json' },
        timeout: 9000,
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': 'BuscadorBecasUniversitarias/1.0'
        }
      });

      return this._filterWikiScholarshipResults(response.data?.results?.bindings || []);
    } catch (error) {
      this._handleError(error);
      return [];
    }
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
      const remoteResults = this._filterScholarshipResults(bindings);
      if (remoteResults.length > 0) return remoteResults;

      if (this._isWikidataFallbackLang(lang)) {
        const wikiResults = await this.searchWikidataScholarships(term, lang);
        if (wikiResults.length > 0) return wikiResults;
      }

      return this.searchOfflineScholarships(term, lang);
    } catch (error) {
      this._handleError(error);
      if (this._isWikidataFallbackLang(lang)) {
        const wikiResults = await this.searchWikidataScholarships(term, lang);
        if (wikiResults.length > 0) return wikiResults;
      }
      return this.searchOfflineScholarships(term, lang);
    }
  }

  /**
   * DETALLES DE LA BECA Y SUS REQUISITOS:
   * Extrae de forma dirigida los campos de requisitos y criterios de elegibilidad mapeados por DBpedia.
   */
  async getScholarshipDetails(uri, lang = 'es') {
    if (String(uri || '').includes('wikidata.org/entity/')) {
      const wikiDetails = await this.getWikidataScholarshipDetails(uri, lang);
      if (wikiDetails) return wikiDetails;
    }

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
      if (rows.length === 0) {
        const offline = await this.getOfflineScholarshipDetails(uri, lang);
        if (offline) return offline;
        const fallbackLabel = uri.split('/').pop() || uri;
        return {
          uri,
          label: fallbackLabel,
          name: fallbackLabel,
          abstract: '',
          description: '',
          thumbnail: null,
          requirements: null,
          source: 'dbpedia',
          dbpediaUri: uri
        };
      }

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
      const offline = await this.getOfflineScholarshipDetails(uri, lang);
      if (offline) return offline;
      const fallbackLabel = uri.split('/').pop() || uri;
      return {
        uri,
        label: fallbackLabel,
        name: fallbackLabel,
        abstract: '',
        description: '',
        thumbnail: null,
        requirements: null,
        source: 'dbpedia',
        dbpediaUri: uri
      };
    }
  }

  async getWikidataScholarshipDetails(uri, lang = 'es') {
    const entityId = this._wikidataEntityId(uri);
    if (!entityId) return null;

    const query = `
      PREFIX bd: <http://www.bigdata.com/rdf#>
      PREFIX wd: <http://www.wikidata.org/entity/>
      PREFIX wdt: <http://www.wikidata.org/prop/direct/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX schema: <http://schema.org/>
      PREFIX wikibase: <http://wikiba.se/ontology#>

      SELECT ?item ?itemLabel ?itemDescription ?image ?countryLabel ?website WHERE {
        BIND(wd:${entityId} AS ?item)
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P17|wdt:P495 ?country. }
        OPTIONAL { ?item wdt:P856 ?website. }
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "${lang},en,es".
          ?item rdfs:label ?itemLabel.
          ?item schema:description ?itemDescription.
          ?country rdfs:label ?countryLabel.
        }
      }
      LIMIT 1
    `;

    try {
      const response = await axios.get(this._getWikidataEndpoint(), {
        params: { query, format: 'json' },
        timeout: 9000,
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': 'BuscadorBecasUniversitarias/1.0'
        }
      });

      const row = response.data?.results?.bindings?.[0];
      if (!row) return null;

      const label = row.itemLabel?.value || entityId;
      const description = row.itemDescription?.value || '';

      return {
        uri,
        label,
        name: label,
        abstract: description,
        description,
        thumbnail: row.image?.value || null,
        requirements: null,
        benefits: null,
        country: row.countryLabel?.value || null,
        seeAlso: row.website?.value || null,
        source: 'dbpedia',
        dbpediaUri: uri,
        dbpediaPage: uri
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
