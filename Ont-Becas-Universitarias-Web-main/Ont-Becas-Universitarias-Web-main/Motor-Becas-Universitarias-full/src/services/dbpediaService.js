const axios = require('axios');
const dbpediaConfig = require('../config/dbpedia');

class DBpediaService {
  _getEndpoint() {
    return dbpediaConfig.endpoint;
  }

  async _fetchSparql(query) {
    const response = await axios.get(this._getEndpoint(), {
      params: {
        ...dbpediaConfig.defaultQueryOptions,
        query
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

    const safeTerm = String(term).replace(/"/g, '\\"').trim().toLowerCase();
    const query = `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT DISTINCT ?scholarship ?label ?abstract
      WHERE {
        ?scholarship rdfs:label ?label .
        ?scholarship dbo:abstract ?abstract .

        FILTER(CONTAINS(LCASE(STR(?label)), "${safeTerm}"))
        FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en")
        FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en")
      }

      LIMIT 10
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
    console.error('DBpedia Service Error:');
    console.error(`- Message: ${error.message}`);
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      console.error(`- Response: ${JSON.stringify(error.response.data)}`);
    }
  }
}

module.exports = new DBpediaService();
