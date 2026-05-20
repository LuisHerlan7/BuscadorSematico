const axios = require('axios');
const dbpediaConfig = require('../config/dbpedia');
const sparqlQueries = require('../utils/sparqlQueries');

class DBpediaService {
  _getEndpoint() {
    return dbpediaConfig.endpoint;
  }

  // Buscar entidades en DBpedia por label que contenga el término
  async searchDiseases(term, lang = 'es') {
    const endpoint = this._getEndpoint();
    const escaped = ('' + term).replace(/"/g, '\\"').toLowerCase();

    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbo: <http://dbpedia.org/ontology/>

      SELECT DISTINCT ?s ?label ?abstract WHERE {
        ?s rdfs:label ?label .
        FILTER(CONTAINS(LCASE(STR(?label)), "${escaped}"))
        OPTIONAL { ?s dbo:abstract ?abstractRaw . FILTER(LANG(?abstractRaw) = "${lang}" || LANG(?abstractRaw) = "en") }
        BIND(COALESCE(?abstractRaw, "") AS ?abstract)
      } LIMIT 50
    `;

    try {
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response structure from DBpedia');
      }

      const results = response.data.results.bindings.map(result => ({
        uri: result.s?.value,
        label: result.label?.value,
        description: result.abstract?.value || ''
      }));

      return results;
    } catch (error) {
      this._handleError(error);
      return [];
    }
  }

  async getDiseaseDetails(uri, lang = 'es') {
    const endpoint = this._getEndpoint();

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
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        }
      });

      const rows = response.data.results.bindings;
      if (!rows || rows.length === 0) return null;

      const base = rows[0];
      return {
        uri,
        label: base.label?.value,
        description: base.abstract?.value,
        types: Array.from(new Set(rows.map(r => r.type?.value).filter(Boolean)))
      };
    } catch (error) {
      this._handleError(error);
      return null;
    }
  }

  /**
   * Búsqueda semántica general de becas por término
   * Pregunta: "¿Cuáles son todas las becas que coinciden con este término de búsqueda?"
   * 
   * @param {string} term - Término a buscar (ej: "ingeniería", "medicina")
   * @param {string} lang - Código de idioma (ej: "es", "en")
   * @returns {Promise<Array>} Array de becas con {uri, label, description, institution}
   * 
   * @example
   * const results = await dbpediaService.searchScholarships("ingeniería", "es");
   * // Retorna becas relacionadas con ingeniería en español
   */
  async searchScholarships(term, lang = 'es') {
    const endpoint = this._getEndpoint();
    const query = sparqlQueries.searchScholarships(term, lang);

    try {
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response structure from DBpedia');
      }

      const results = response.data.results.bindings.map(result => ({
        uri: result.s?.value,
        label: result.label?.value,
        description: result.abstract?.value || '',
        institution: result.institution?.value || null
      }));

      return results;
    } catch (error) {
      this._handleError(error);
      return [];
    }
  }

  /**
   * Obtener detalles completos de una beca específica
   * Pregunta: "¿Cuál es toda la información disponible para esta beca en particular?"
   * 
   * @param {string} uri - URI de la beca (ej: "http://dbpedia.org/resource/Beca_MIT")
   * @param {string} lang - Código de idioma (ej: "es", "en")
   * @returns {Promise<Object>} Objeto con detalles de la beca o null si no existe
   * 
   * @returns {Object} {
   *   uri: string,
   *   safeUri: string (encoded),
   *   name: string,
   *   abstract: string,
   *   institution: string,
   *   country: string,
   *   level: string (ej: "Pregrado", "Maestría"),
   *   benefits: string,
   *   requirements: string,
   *   thumbnail: string (URL),
   *   location: string
   * }
   * 
   * @example
   * const details = await dbpediaService.getScholarshipDetails("http://dbpedia.org/resource/Beca_MIT", "es");
   * // Retorna todos los detalles de la beca MIT
   */
  async getScholarshipDetails(uri, lang = 'es') {
    const endpoint = this._getEndpoint();
    const query = sparqlQueries.getScholarshipDetails(uri, lang);

    try {
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        }
      });

      const rows = response.data.results.bindings;
      if (!rows || rows.length === 0) return null;

      // Usar la primera fila como base (contiene todos los campos OPTIONAL recuperados)
      const base = rows[0];
      
      return {
        uri: uri,
        safeUri: encodeURIComponent(uri),
        name: base.name?.value || '',
        abstract: base.abstract?.value || '',
        institution: base.institution?.value || '',
        country: base.country?.value || '',
        level: base.level?.value || '',
        benefits: base.benefits?.value || '',
        requirements: base.requirements?.value || '',
        thumbnail: base.thumbnail?.value || null,
        location: base.location?.value || ''
      };
    } catch (error) {
      this._handleError(error);
      return null;
    }
  }

  /**
   * Buscar becas por nivel académico
   * Pregunta: "¿Cuáles son las becas disponibles para un nivel académico específico?"
   * 
   * @param {string} level - Nivel académico (ej: "Pregrado", "Maestría", "Doctorado")
   * @param {string} lang - Código de idioma (ej: "es", "en")
   * @returns {Promise<Array>} Array de becas con {uri, label, description, level}
   * 
   * @example
   * const masterBecas = await dbpediaService.searchScholarshipsByLevel("Maestría", "es");
   * // Retorna todas las becas de maestría disponibles
   */
  async searchScholarshipsByLevel(level, lang = 'es') {
    const endpoint = this._getEndpoint();
    const query = sparqlQueries.searchScholarshipsByLevel(level, lang);

    try {
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response structure from DBpedia');
      }

      const results = response.data.results.bindings.map(result => ({
        uri: result.s?.value,
        label: result.label?.value,
        description: result.abstract?.value || '',
        level: result.level?.value || level
      }));

      return results;
    } catch (error) {
      this._handleError(error);
      return [];
    }
  }

  /**
   * Buscar becas por requisito de idioma
   * Pregunta: "¿Cuáles son las becas que requieren dominio de un idioma específico?"
   * 
   * @param {string} language - Idioma requerido (ej: "Inglés", "Alemán", "Francés")
   * @param {string} lang - Código de idioma (ej: "es", "en")
   * @returns {Promise<Array>} Array de becas con {uri, label, description, requiredLanguage}
   * 
   * @example
   * const englishBecas = await dbpediaService.searchScholarshipsByLanguage("Inglés", "es");
   * // Retorna todas las becas que requieren inglés
   */
  async searchScholarshipsByLanguage(language, lang = 'es') {
    const endpoint = this._getEndpoint();
    const query = sparqlQueries.searchScholarshipsByLanguage(language, lang);

    try {
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response structure from DBpedia');
      }

      const results = response.data.results.bindings.map(result => ({
        uri: result.s?.value,
        label: result.label?.value,
        description: result.abstract?.value || '',
        requiredLanguage: result.requiredLanguage?.value || language
      }));

      return results;
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


