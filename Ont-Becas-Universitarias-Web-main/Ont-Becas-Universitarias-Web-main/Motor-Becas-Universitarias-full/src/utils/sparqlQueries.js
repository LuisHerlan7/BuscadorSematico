module.exports = {
  searchDiseases: (term, lang = "es") => {
    if (!term || typeof term !== "string") {
      throw new Error("Invalid search term");
    }

    const escapedTerm = term.replace(/"/g, '\\"').toLowerCase();

    return `
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT DISTINCT ?beca ?label ?nombre ?descripcion ?monto ?fechaLimite WHERE {
        ?beca a becas:Beca .

        # Nombre o etiqueta
        OPTIONAL { ?beca rdfs:label ?labelRaw }
        OPTIONAL { ?beca becas:nombreBeca ?nombre }
        FILTER (CONTAINS(LCASE(STR(COALESCE(?nombre, ?labelRaw, ""))), "${escapedTerm}"))

        BIND(COALESCE(?nombre, ?labelRaw) AS ?label)

        OPTIONAL { ?beca becas:descripcion ?descripcion }
        OPTIONAL { ?beca becas:montoCubierto ?monto }
        OPTIONAL { ?beca becas:fechaLímitePostulación ?fechaLimite }
      }
      LIMIT 50
    `;
  },

  /**
   * CONSULTA SEMÁNTICA: Búsqueda general de becas por término
   * Pregunta: "¿Cuáles son todas las becas que coinciden con este término de búsqueda?"
   * Utiliza: rdfs:label, dbo:abstract, FILTER(CONTAINS()), filtros por idioma
   * 
   * Ejemplo: searchScholarships("ingeniería", "es")
   * Retorna: becas de ingeniería disponibles
   */
  searchScholarships: (term, lang = "es") => {
    if (!term || typeof term !== "string") {
      throw new Error("Invalid search term");
    }

    const escapedTerm = term.replace(/"/g, '\\"').toLowerCase();

    return `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbp: <http://dbpedia.org/property/>

      SELECT DISTINCT ?s ?label ?abstract ?institution WHERE {
        # Búsqueda por etiqueta que contenga el término
        ?s rdfs:label ?label .
        FILTER(CONTAINS(LCASE(STR(?label)), "${escapedTerm}"))
        FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en")

        # Resumen o descripción (con preferencia por idioma)
        OPTIONAL { 
          ?s dbo:abstract ?abstract . 
          FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en")
        }

        # Institución que ofrece la beca
        OPTIONAL { ?s dbo:university ?institution }
        OPTIONAL { ?s dbo:institution ?institution }
      }
      ORDER BY ?label
      LIMIT 50
    `;
  },

  /**
   * CONSULTA SEMÁNTICA: Detalles completos de una beca específica
   * Pregunta: "¿Cuál es toda la información disponible para esta beca en particular?"
   * Utiliza: OPTIONAL para recuperación segura de datos sin errores
   * 
   * Ejemplo: getScholarshipDetails("http://dbpedia.org/resource/Beca_MIT")
   * Retorna: nombre, descripción, institución, país, nivel, beneficios, requisitos, thumbnail
   */
  getScholarshipDetails: (uri, lang = "es") => {
    if (!uri || typeof uri !== "string") {
      throw new Error("Invalid URI");
    }

    return `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbp: <http://dbpedia.org/property/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>

      SELECT DISTINCT 
        ?name ?abstract ?institution ?country ?level 
        ?benefits ?requirements ?thumbnail ?location
      WHERE {
        BIND(<${uri}> AS ?s)

        # Nombre de la beca
        OPTIONAL { ?s rdfs:label ?name . FILTER(LANG(?name) = "${lang}" || LANG(?name) = "en") }

        # Descripción / resumen
        OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en") }

        # Institución o universidad
        OPTIONAL { ?s dbo:university ?institution }
        OPTIONAL { ?s dbo:institution ?institution }
        OPTIONAL { ?s dbp:institution ?institution }

        # País de la institución/beca
        OPTIONAL { ?s dbo:country ?country }
        OPTIONAL { ?s dbp:country ?country }

        # Nivel académico
        OPTIONAL { ?s dbo:educationLevel ?level }
        OPTIONAL { ?s dbp:educationLevel ?level }

        # Beneficios (monto, cobertura, etc.)
        OPTIONAL { ?s dbo:fundingAmount ?benefits }
        OPTIONAL { ?s dbp:coverage ?benefits }

        # Requisitos (eligibilidad)
        OPTIONAL { ?s dbo:requirement ?requirements }
        OPTIONAL { ?s dbp:requirements ?requirements }

        # Imagen/thumbnail
        OPTIONAL { ?s dbo:thumbnail ?thumbnail }
        OPTIONAL { ?s foaf:depiction ?thumbnail }

        # Ubicación
        OPTIONAL { ?s dbo:location ?location }
      }
    `;
  },

  /**
   * CONSULTA SEMÁNTICA: Búsqueda de becas por nivel académico
   * Pregunta: "¿Cuáles son las becas disponibles para un nivel académico específico?"
   * Utiliza: FILTER para nivel, búsqueda por propiedades semánticas
   * 
   * Ejemplos de niveles: "Pregrado", "Maestría", "Doctorado", "PhD"
   * searchScholarshipsByLevel("Postgrado", "es")
   * Retorna: becas disponibles para ese nivel
   */
  searchScholarshipsByLevel: (level, lang = "es") => {
    if (!level || typeof level !== "string") {
      throw new Error("Invalid level");
    }

    const escapedLevel = level.replace(/"/g, '\\"').toLowerCase();

    return `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbp: <http://dbpedia.org/property/>

      SELECT DISTINCT ?s ?label ?abstract ?level WHERE {
        # Debe tener una propiedad de nivel académico
        ?s dbo:educationLevel ?levelValue .
        FILTER(CONTAINS(LCASE(STR(?levelValue)), "${escapedLevel}"))

        # Recuperar etiqueta y descripción
        OPTIONAL { ?s rdfs:label ?label . FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en") }
        OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en") }
        
        BIND(?levelValue AS ?level)
      }
      ORDER BY ?label
      LIMIT 100
    `;
  },

  /**
   * CONSULTA SEMÁNTICA: Búsqueda de becas por requisito de idioma
   * Pregunta: "¿Cuáles son las becas que requieren dominio de un idioma específico?"
   * Utiliza: FILTER para idiomas, búsqueda por requisitos lingüísticos
   * 
   * Ejemplos de idiomas: "Inglés", "Alemán", "Francés", "Español"
   * searchScholarshipsByLanguage("Inglés", "es")
   * Retorna: becas que requieren inglés
   */
  searchScholarshipsByLanguage: (language, lang = "es") => {
    if (!language || typeof language !== "string") {
      throw new Error("Invalid language");
    }

    const escapedLanguage = language.replace(/"/g, '\\"').toLowerCase();

    return `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbp: <http://dbpedia.org/property/>

      SELECT DISTINCT ?s ?label ?abstract ?requiredLanguage WHERE {
        # Debe tener un requisito de idioma
        ?s dbo:languageRequirement ?languageValue .
        FILTER(CONTAINS(LCASE(STR(?languageValue)), "${escapedLanguage}"))

        # Recuperar etiqueta y descripción
        OPTIONAL { ?s rdfs:label ?label . FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en") }
        OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en") }
        
        BIND(?languageValue AS ?requiredLanguage)
      }
      ORDER BY ?label
      LIMIT 100
    `;
  }
};
