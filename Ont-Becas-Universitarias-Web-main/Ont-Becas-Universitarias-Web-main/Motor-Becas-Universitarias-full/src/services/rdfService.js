const fs = require('fs');
const path = require('path');
const { QueryEngine } = require('@comunica/query-sparql');
const N3 = require('n3');

// Rutas de los archivos ontológicos
const defaultOwl = path.join(__dirname, '../public/data/ontologia_becas.owl');
const instancesTtl = path.join(__dirname, '../public/data/ontologia_becas_instances.ttl');

let rdfFilePath = process.env.ONTOLOGY_FILE || defaultOwl;
if (fs.existsSync(instancesTtl)) {
  rdfFilePath = process.env.ONTOLOGY_FILE || instancesTtl;
}

class RDFService {
  constructor() {
    this.engine = new QueryEngine();
    this._dataset = null; // caché del dataset cargado en memoria
  }

  async _loadDataset() {
    if (this._dataset) return this._dataset;

    const filePath = path.resolve(rdfFilePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No se encontró el archivo ontológico en: ${filePath}`);
    }

    // Nota: N3 maneja nativamente Turtle (.ttl), TriG, N-Triples, N-Quads.
    // Si tu .owl está en formato RDF/XML puro, el parser N3 fallará. 
    // Es recomendable convertir tu .owl a .ttl.
    const content = fs.readFileSync(filePath, 'utf8');
    const parser = new N3.Parser({ baseIRI: `file://${filePath}` });
    const quads = parser.parse(content);

    const store = new N3.Store(quads);
    this._dataset = store;
    return store;
  }

  async searchScholarships(term, lang = 'es') {
    const ontologyClass = process.env.ONTOLOGY_CLASS || 'http://www.semanticweb.org/ontologia/becas-universitarias#Beca';
    const escaped = ('' + term).replace(/"/g, '\\"');

    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      SELECT DISTINCT ?s ?label ?descripcion ?monto ?fechaFinal ?nombre WHERE {
        {
          # Buscar instancias de Beca o cualquier subclase de Beca
          ?s a ?type .
          ?type rdfs:subClassOf* becas:Beca .
        } UNION {
          # Fallback: cualquier entidad con nombreBeca es una beca
          ?s becas:nombreBeca ?anyNombre .
        }
        ?s rdfs:label ?label .
        OPTIONAL { ?s becas:descripcion ?descripcion }
        OPTIONAL { ?s becas:montoCubierto ?monto }
        OPTIONAL { ?s becas:fechaLímitePostulación ?fecha }
        OPTIONAL { ?s becas:fechaLimitePostulacion ?fechaAlt }
        OPTIONAL { ?s becas:nombreBeca ?nombre }
        BIND(COALESCE(?fecha, ?fechaAlt) AS ?fechaFinal)
        FILTER(
          CONTAINS(LCASE(STR(?label)), LCASE("${escaped}"))
          || CONTAINS(LCASE(STR(?nombre)), LCASE("${escaped}"))
          || CONTAINS(LCASE(STR(?descripcion)), LCASE("${escaped}"))
        )
      } LIMIT 50
    `;

    const dataset = await this._loadDataset();
    const bindingsStream = await this.engine.queryBindings(query, { sources: [dataset] });
    const bindings = [];

    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => bindings.push(b));
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    return bindings.map(binding => {
      const s = binding.get('s') || binding.get('?s');
      const label = binding.get('label') || binding.get('?label');
      const descripcion = binding.get('descripcion') || binding.get('?descripcion');
      const monto = binding.get('monto') || binding.get('?monto');
      const fecha = binding.get('fechaFinal') || binding.get('?fechaFinal') || binding.get('fecha') || binding.get('?fecha');
      const nombre = binding.get('nombre') || binding.get('?nombre');

      return {
        uri: s?.value,
        label: label?.value,
        name: nombre?.value || label?.value,
        description: descripcion?.value,
        amount: monto?.value,
        deadline: fecha?.value,
        source: 'local'
      };
    });
  }

  async getScholarshipDetails(uri) {
    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      SELECT ?p ?o ?oLbl WHERE {
        <${uri}> ?p ?o .
        OPTIONAL {
          ?o rdfs:label ?oLbl .
        }
      }
    `;

    const dataset = await this._loadDataset();
    const bindingsStream = await this.engine.queryBindings(query, { sources: [dataset] });
    const bindings = [];

    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => bindings.push(b));
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    const NS = 'http://www.semanticweb.org/ontologia/becas-universitarias#';
    const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
    const OWL = 'http://www.w3.org/2002/07/owl#';

    const raw = {};
    const requirements = [];
    const benefits = [];
    let institution = null;
    let level = null;
    let area = null;
    let country = null;

    bindings.forEach(binding => {
      const p = binding.get('p') || binding.get('?p');
      const o = binding.get('o') || binding.get('?o');
      const oLbl = binding.get('oLbl') || binding.get('?oLbl');

      if (!p || !o) return;

      const propUri = p.value;
      const objVal = o.value;
      const objLabel = oLbl ? oLbl.value : objVal.split('#')[1] || objVal;

      raw[propUri] = objVal;

      if (propUri === `${NS}tieneRequisito`) {
        requirements.push(objLabel);
      } else if (propUri === `${NS}otorgaBeneficio`) {
        benefits.push(objLabel);
      } else if (propUri === `${NS}esOfrecidaPor`) {
        institution = objLabel;
      } else if (propUri === `${NS}perteneceANivel`) {
        level = objLabel;
      } else if (propUri === `${NS}perteneceAArea` || propUri === `${NS}perteneceAÁrea`) {
        area = objLabel;
      } else if (propUri === `${NS}destinadaAPais` || propUri === `${NS}destinadaAPaís`) {
        country = objLabel;
      }
    });

    const label = raw[`${RDFS}label`] || raw[`${NS}nombreBeca`] || uri;
    const desc = raw[`${NS}descripcion`] || raw[`${NS}descripción`] || '';
    const amount = raw[`${NS}montoCubierto`] || null;
    const deadline = raw[`${NS}fechaLímitePostulación`] || raw[`${NS}fechaLimitePostulacion`] || null;
    const dbpediaUri = raw[`${OWL}sameAs`] || null;
    const seeAlso = raw[`${RDFS}seeAlso`] || null;

    return {
      uri,
      label,
      name: label,
      abstract: desc,
      description: desc,
      amount,
      deadline,
      dbpediaUri,
      seeAlso,
      requirements: requirements.length > 0 ? requirements.join(', ') : null,
      benefits: benefits.length > 0 ? benefits.join(', ') : null,
      institution,
      level,
      area,
      country,
      thumbnail: null,
      source: 'local',
      _raw: raw
    };
  }
}

module.exports = new RDFService();