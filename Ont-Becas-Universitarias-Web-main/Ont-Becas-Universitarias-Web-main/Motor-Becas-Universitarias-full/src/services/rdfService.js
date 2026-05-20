const fs = require('fs');
const path = require('path');
const { QueryEngine } = require('@comunica/query-sparql');
const N3 = require('n3');
// Usaremos N3.Store como fuente RDFJS compatible con Comunica
const { searchDiseases } = require('../utils/rdfQueries');

// Preferir archivo de instancias si existe (más práctico para pruebas)
const defaultOwl = path.join(__dirname, '../public/data/ontologia_becas.owl');
const instancesTtl = path.join(__dirname, '../public/data/ontologia_becas_instances.ttl');
let rdfFilePath = process.env.ONTOLOGY_FILE || defaultOwl; 
if (fs.existsSync(instancesTtl)) {
  rdfFilePath = process.env.ONTOLOGY_FILE || instancesTtl;
}

// Convertir a URL de archivo adecuada para Comunica (file:///...) en Windows
function toFileUrl(p) {
  if (!p) return p;
  if (p.startsWith('file://')) return p;
  const abs = path.resolve(p).replace(/\\/g, '/');
  return `file:///${abs}`;
}
const rdfFileUrl = toFileUrl(rdfFilePath);
// Determinar mediaType según extensión
function mediaTypeFor(p) {
  if (!p) return undefined;
  const lower = p.toLowerCase();
  if (lower.endsWith('.ttl')) return 'text/turtle';
  if (lower.endsWith('.nt')) return 'application/n-triples';
  if (lower.endsWith('.nq')) return 'application/n-quads';
  if (lower.endsWith('.rdf') || lower.endsWith('.owl') || lower.endsWith('.xml')) return 'application/rdf+xml';
  return undefined;
}
const rdfMediaType = mediaTypeFor(rdfFilePath);

class RDFService {
  constructor() {
    this.engine = new QueryEngine();
    this._dataset = null; // cache del dataset cargado
  }

  async _loadDataset() {
    if (this._dataset) return this._dataset;

    const filePath = path.resolve(rdfFilePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No se encontró el archivo ontológico en: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/rdf+xml';
    if (ext === '.ttl') contentType = 'text/turtle';
    if (ext === '.nq') contentType = 'application/n-quads';
    if (ext === '.nt') contentType = 'application/n-triples';
    if (ext === '.jsonld') contentType = 'application/ld+json';

    const content = fs.readFileSync(filePath, 'utf8');
    const parser = new N3.Parser({ baseIRI: `file://${filePath}` });
    const quads = parser.parse(content);
    const store = new N3.Store(quads);
    this._dataset = store;
    return store;
  }

  async searchDiseases(term, lang = 'es') {
    const ontologyClass = process.env.ONTOLOGY_CLASS || 'http://www.semanticweb.org/ontologia/becas-universitarias#Beca';
    const escaped = ('' + term).replace(/"/g, '\\"');

    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      SELECT ?s ?label ?descripcion ?monto ?fecha ?nombre WHERE {
        ?s a <${ontologyClass}> .
        ?s rdfs:label ?label .
        FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${escaped}")))
        OPTIONAL { ?s becas:descripcion ?descripcion }
        OPTIONAL { ?s becas:montoCubierto ?monto }
        OPTIONAL { ?s becas:fechaLímitePostulación ?fecha }
        OPTIONAL { ?s becas:nombreBeca ?nombre }
      } LIMIT 50
    `;

    // Cargar dataset RDFJS y usarlo como fuente
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
      const descripcion = binding.get('descripcion');
      const monto = binding.get('monto');
      const fecha = binding.get('fecha');
      const nombre = binding.get('nombre');
      return {
        uri: s?.value,
        label: label?.value,
        name: nombre?.value,
        description: descripcion?.value,
        amount: monto?.value,
        deadline: fecha?.value
      };
    });
  }

  async getDiseaseDetails(uri) {
    const query = `
      SELECT ?p ?o WHERE {
        <${uri}> ?p ?o .
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

    const details = {};
    bindings.forEach(binding => {
      const p = binding.get('p') || binding.get('?p');
      const o = binding.get('o') || binding.get('?o');
      if (p && o) details[p.value] = o.value;
    });

    return details;
  }
}

module.exports = new RDFService();