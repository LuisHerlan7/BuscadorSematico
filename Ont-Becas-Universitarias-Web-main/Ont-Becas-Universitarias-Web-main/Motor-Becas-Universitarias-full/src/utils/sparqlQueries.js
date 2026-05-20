module.exports = {
  searchDiseases: (term, lang = "es") => {
    if (!term || typeof term !== "string") {
      throw new Error("Invalid search term");
    }

    const escapedTerm = term.replace(/"/g, '\\"');

    return `
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      SELECT DISTINCT ?beca ?label ?nombre ?descripcion ?monto ?fechaLimite WHERE {
        # buscar instancias cuyo tipo sea Beca o una subclase de Beca
        ?beca rdf:type ?t .
        ?t rdfs:subClassOf* becas:Beca .

        # etiquetas y nombre
        OPTIONAL { ?beca rdfs:label ?labelRaw }
        OPTIONAL { ?beca becas:nombreBeca ?nombre }

        BIND(COALESCE(?nombre, ?labelRaw) AS ?label)

        # Buscar por coincidencia sobre label/nombre/descripcion o en el área asociada
        OPTIONAL { ?beca becas:descripcion ?descripcion }
        OPTIONAL { ?beca becas:montoCubierto ?monto }
        OPTIONAL { ?beca becas:fechaLímitePostulación ?fechaLimite }

        OPTIONAL { ?beca becas:perteneceAÁrea ?area . ?area rdfs:label ?areaLabel }

        FILTER(
          CONTAINS(LCASE(STR(COALESCE(?label, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?descripcion, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?areaLabel, ""))), LCASE("${escapedTerm}"))
        )
      }
      LIMIT 100
    `;
  }
};
