const axios = require('axios');
const dbpediaConfig = require('../config/dbpedia');

class DBpediaService {
  constructor() {
    this.unavailableUntil = 0;
    this.lastNetworkWarningAt = 0;
  }

  _getEndpoint() {
    return dbpediaConfig.endpoint;
  }

  _isTemporarilyUnavailable() {
    return Date.now() < this.unavailableUntil;
  }

  _buildScholarshipTerms(term) {
    const normalized = String(term || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

    const terms = new Set(
      normalized
        .split(/\s+/)
        .filter((word) => word.length >= 4)
        .filter((word) => !['beca', 'becas', 'para', 'sobre', 'universitaria', 'universitarias'].includes(word))
    );

    const expansionMap = {
      beca: ['scholarship', 'grant', 'fellowship'],
      becas: ['scholarship', 'grant', 'fellowship'],
      universitaria: ['university', 'student'],
      universitarias: ['university', 'student'],
      universidad: ['university'],
      maestria: ['master', 'graduate'],
      master: ['master', 'graduate'],
      doctorado: ['doctoral', 'phd'],
      pregrado: ['undergraduate'],
      intercambio: ['exchange', 'erasmus'],
      movilidad: ['exchange', 'mobility', 'erasmus'],
      investigacion: ['research', 'fellowship'],
      excelencia: ['merit', 'excellence'],
      toefl: ['toefl', 'english'],
      ingles: ['english', 'toefl', 'ielts']
    };

    for (const word of normalized.split(/\s+/)) {
      for (const extra of expansionMap[word] || []) {
        terms.add(extra);
      }
    }

    if (terms.size === 0) {
      terms.add('scholarship');
      terms.add('fellowship');
    }

    return Array.from(terms).slice(0, 8);
  }

  _buildContainsFilter(variableName, terms) {
    return terms
      .map((term) => `CONTAINS(${variableName}, "${String(term).replace(/"/g, '\\"')}")`)
      .join(' || ');
  }

  async _fetchSparql(query) {
    if (this._isTemporarilyUnavailable()) {
      throw Object.assign(new Error('DBpedia temporalmente no disponible'), { code: 'DBPEDIA_UNAVAILABLE' });
    }

    const { timeout, ...queryOptions } = dbpediaConfig.defaultQueryOptions;
    const response = await axios.get(this._getEndpoint(), {
      params: {
        ...queryOptions,
        query
      },
      timeout: dbpediaConfig.timeout || timeout || 15000,
      headers: {
        Accept: 'application/sparql-results+json, application/json'
      }
    });

    if (!response.data || !response.data.results) {
      throw new Error('Invalid response structure from DBpedia');
    }

    return response.data;
  }

  async searchScholarships(term, lang = 'es') {
    if (!term || !term.trim()) {
      return [];
    }

    return this.searchUniversityScholarshipPrograms(term, lang);
  }

  async searchUniversityScholarshipPrograms(term, lang = 'es') {
    if (!term || !term.trim()) {
      return [];
    }
    if (this._isTemporarilyUnavailable()) {
      return [];
    }

    const searchTerms = this._buildScholarshipTerms(term);
    const searchFilter = this._buildContainsFilter('?text', searchTerms);
    const query = `
      PREFIX dbr: <http://dbpedia.org/resource/>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT DISTINCT ?scholarship ?label ?abstract
      WHERE {
        VALUES ?scholarship {
          dbr:Fulbright_Program
          dbr:Rhodes_Scholarship
          dbr:Chevening_Scholarship
          dbr:Marshall_Scholarship
          dbr:Gates_Cambridge_Scholarship
          dbr:Schwarzman_Scholars
          dbr:Erasmus_Programme
          dbr:Erasmus_Mundus
          dbr:German_Academic_Exchange_Service
          dbr:Commonwealth_Scholarship_and_Fellowship_Plan
        }

        ?scholarship rdfs:label ?label .

        FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en")
        OPTIONAL {
          ?scholarship dbo:abstract ?abstract .
          FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en")
        }

        BIND(LCASE(CONCAT(STR(?label), " ", STR(COALESCE(?abstract, "")))) AS ?text)
        FILTER(${searchFilter})
        FILTER(
          CONTAINS(?text, "scholarship") ||
          CONTAINS(?text, "fellowship") ||
          CONTAINS(?text, "grant") ||
          CONTAINS(?text, "bursary") ||
          CONTAINS(?text, "financial aid") ||
          CONTAINS(?text, "student exchange") ||
          CONTAINS(?text, "university") ||
          CONTAINS(?text, "fulbright") ||
          CONTAINS(?text, "erasmus") ||
          CONTAINS(?text, "chevening") ||
          CONTAINS(?text, "rhodes") ||
          CONTAINS(?text, "marshall") ||
          CONTAINS(?text, "cambridge")
        )
      }

      LIMIT 25
    `;

    try {
      const data = await this._fetchSparql(query);
      const bindings = data?.results?.bindings || [];

      return bindings.map((b) => {
        const uri = b.scholarship?.value;

        return {
          uri,
          safeUri: uri ? encodeURIComponent(uri) : null,
          label: b.label?.value,
          name: b.label?.value,
          description: b.abstract?.value || '',
          abstract: b.abstract?.value || null
        };
      });
    } catch (error) {
      this._handleError(error);
      return [];
    }
  }

  // Compatibilidad con el flujo actual del controlador.
  async searchDiseases(term, lang = 'es') {
    return this.searchScholarships(term, lang);
  }

  async getDiseaseDetails(uri, lang = 'es') {
    if (this._isTemporarilyUnavailable()) {
      return null;
    }

    const query = `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbp: <http://dbpedia.org/property/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT DISTINCT ?label ?abstract ?type WHERE {
        BIND(<${uri}> AS ?s)
        OPTIONAL { ?s rdfs:label ?label . FILTER(LANG(?label) = "${lang}") }
        OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en") }
        OPTIONAL { ?s a ?type }
      } LIMIT 200
    `;

    try {
      const data = await this._fetchSparql(query);
      const rows = data.results.bindings;
      if (!rows || rows.length === 0) return null;

      const base = rows[0];
      return {
        uri,
        label: base.label?.value,
        description: base.abstract?.value,
        types: Array.from(new Set(rows.map((r) => r.type?.value).filter(Boolean)))
      };
    } catch (error) {
      this._handleError(error);
      return null;
    }
  }

  async searchByIntent(intentObj, lang = 'es') {
    if (!intentObj || intentObj.intent !== 'query_property') return [];
    if (this._isTemporarilyUnavailable()) return [];

    const value = intentObj.value || '';
    const escaped = String(value).replace(/"/g, '\\"');

    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      SELECT DISTINCT ?s ?label ?abstract WHERE {
        ?s rdfs:label ?label .
        OPTIONAL { ?s dbo:abstract ?abstractRaw . FILTER(LANG(?abstractRaw) = "${lang}" || LANG(?abstractRaw) = "en") }
        FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${escaped}")) || CONTAINS(LCASE(STR(COALESCE(?abstractRaw, ""))), LCASE("${escaped}")))
      } LIMIT 50
    `;

    try {
      const data = await this._fetchSparql(query);
      const rows = data.results.bindings || [];
      return rows.map((r) => ({
        uri: r.s?.value,
        label: r.label?.value,
        description: r.abstract?.value || ''
      }));
    } catch (error) {
      this._handleError(error);
      return [];
    }
  }

  _handleError(error) {
    const message = error.message || error.code || error.cause?.code || error.name || 'Error desconocido';

    const networkCodes = new Set(['ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN']);

    if (networkCodes.has(error.code) || networkCodes.has(error.cause?.code)) {
      this.unavailableUntil = Date.now() + 60000;
      if (Date.now() - this.lastNetworkWarningAt > 60000) {
        this.lastNetworkWarningAt = Date.now();
        console.warn(`DBpedia no esta disponible (${message}). Se continuara solo con resultados locales.`);
      }
      return;
    }

    console.error('DBpedia Service Error:');
    console.error(`- Message: ${message}`);
    if (error.code) {
      console.error(`- Code: ${error.code}`);
    }
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      console.error(`- Response: ${JSON.stringify(error.response.data)}`);
    }
  }
}

module.exports = new DBpediaService();
