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

        # Buscar por coincidencia sobre label/nombre/descripcion y entidades relacionadas
        OPTIONAL { ?beca becas:descripcion ?descripcionSimple }
        OPTIONAL { ?beca becas:descripción ?descripcionOwl }
        BIND(COALESCE(?descripcionSimple, ?descripcionOwl) AS ?descripcion)

        OPTIONAL { ?beca becas:montoCubierto ?montoDirecto }
        OPTIONAL {
          ?beca becas:otorgaBeneficio ?beneficioMonto .
          ?beneficioMonto becas:montoCubierto ?montoBeneficio .
        }
        BIND(COALESCE(?montoDirecto, ?montoBeneficio) AS ?monto)

        OPTIONAL { ?beca becas:fechaLímitePostulación ?fechaLimiteOwl }
        OPTIONAL { ?beca becas:fechaLimitePostulacion ?fechaLimiteSimple }
        BIND(COALESCE(?fechaLimiteOwl, ?fechaLimiteSimple) AS ?fechaLimite)

        OPTIONAL { ?beca becas:perteneceAÁrea ?area . ?area rdfs:label ?areaLabel }
        OPTIONAL { ?beca becas:perteneceAArea ?areaSimple . ?areaSimple rdfs:label ?areaSimpleLabel }
        OPTIONAL { ?beca becas:perteneceANivel ?nivel . ?nivel rdfs:label ?nivelLabel }
        OPTIONAL { ?beca becas:esOfrecidaPor ?institucion . ?institucion rdfs:label ?institucionLabel }
        OPTIONAL { ?beca becas:esOfrecidaPor ?institucionNombre . ?institucionNombre becas:nombreInstitucion ?institucionNombreLabel }
        OPTIONAL { ?beca becas:tieneRequisito ?requisito . ?requisito rdfs:label ?requisitoLabel }
        OPTIONAL { ?beca becas:otorgaBeneficio ?beneficio . ?beneficio rdfs:label ?beneficioLabel }
        OPTIONAL { ?beca becas:destinadaAPaís ?pais . ?pais rdfs:label ?paisLabel }
        OPTIONAL { ?beca becas:destinadaAPais ?paisSimple . ?paisSimple rdfs:label ?paisSimpleLabel }
        OPTIONAL { ?t rdfs:label ?tipoLabel }

        FILTER(
          CONTAINS(LCASE(STR(COALESCE(?label, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?descripcion, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?areaLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?areaSimpleLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?nivelLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?institucionLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?institucionNombreLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?requisitoLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?beneficioLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?paisLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?paisSimpleLabel, ""))), LCASE("${escapedTerm}")) ||
          CONTAINS(LCASE(STR(COALESCE(?tipoLabel, ""))), LCASE("${escapedTerm}"))
        )
      }
      LIMIT 100
    `;
  }
};
