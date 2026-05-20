const fs = require('fs');
const path = require('path');
const { QueryEngine } = require('@comunica/query-sparql');
const N3 = require('n3');
const { RdfXmlParser } = require('rdfxml-streaming-parser');
const streamifyString = require('streamify-string');
// Usaremos N3.Store como fuente RDFJS compatible con Comunica
const sparqlQueries = require('../utils/sparqlQueries');
const translationService = require('./translationService');

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
    let quads = [];
    if (ext === '.ttl' || ext === '.nt' || ext === '.nq') {
      const parser = new N3.Parser({ baseIRI: `file://${filePath}` });
      try {
        quads = parser.parse(content);
      } catch (err) {
        // Si falla el parseo Turtle, intentar cargar el OWL (RDF/XML) como fallback
        if (fs.existsSync(defaultOwl)) {
          const owlContent = fs.readFileSync(defaultOwl, 'utf8');
          const xmlParser = new RdfXmlParser({ baseIRI: `file://${defaultOwl}` });
          quads = [];
          await new Promise((resolve, reject) => {
            const input2 = streamifyString(owlContent);
            xmlParser.on('data', q => quads.push(q));
            xmlParser.on('end', resolve);
            xmlParser.on('error', reject);
            input2.pipe(xmlParser);
          });
        } else {
          throw err;
        }
      }
    } else if (ext === '.rdf' || ext === '.owl' || ext === '.xml') {
      // usar rdfxml-streaming-parser para RDF/XML/OWL
      const parser = new RdfXmlParser({ baseIRI: `file://${filePath}` });
      await new Promise((resolve, reject) => {
        const input = streamifyString(content);
        parser.on('data', quad => quads.push(quad));
        parser.on('end', resolve);
        parser.on('error', reject);
        input.pipe(parser);
      });
    } else {
      const parser = new N3.Parser({ baseIRI: `file://${filePath}` });
      quads = parser.parse(content);
    }
    const store = new N3.Store(quads);
    this._dataset = store;
    return store;
  }

  async searchDiseases(term, lang = 'es') {
    const escaped = ('' + term).replace(/"/g, '\\"');
    const query = sparqlQueries.searchDiseases(escaped, lang);

    // Cargar dataset RDFJS y usarlo como fuente
    const dataset = await this._loadDataset();
    const bindingsStream = await this.engine.queryBindings(query, { sources: [dataset] });
    const bindings = [];
    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => bindings.push(b));
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    const results = bindings.map(binding => {
      const s = binding.get('beca') || binding.get('?beca');
      const label = binding.get('label') || binding.get('?label');
      const nombre = binding.get('nombre');
      const descripcion = binding.get('descripcion');
      const monto = binding.get('monto');
      const fecha = binding.get('fechaLimite') || binding.get('fecha');
      return {
        uri: s?.value,
        label: label?.value || nombre?.value,
        name: nombre?.value,
        description: descripcion?.value,
        amount: monto?.value,
        deadline: fecha?.value
      };
    });

    // Traducción opcional de campos locales si se solicita otro idioma
    if (lang && lang !== 'es' && translationService) {
      await Promise.all(results.map(async r => {
        try {
          if (r.label) r.label = await translationService.translateText(r.label, lang, 'es');
          if (r.description) r.description = await translationService.translateText(r.description, lang, 'es');
        } catch (e) {
          // fallthrough: devolver datos originales
        }
      }));
    }

    return results;
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

  async searchByIntent(intentObj, lang = 'es') {
    if (!intentObj) return [];
    if (intentObj.intent === 'list_institutions') {
      const query = `
        PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

        SELECT DISTINCT ?institucion WHERE {
          ?b a becas:Beca ;
             becas:esOfrecidaPor ?i .
          OPTIONAL { ?i becas:nombreInstitucion ?n1 . }
          OPTIONAL { ?i rdfs:label ?n2 . }
          BIND(COALESCE(?n1, STR(?n2)) AS ?institucion)
        }
        ORDER BY ?institucion
      `;

      const dataset = await this._loadDataset();
      const bindingsStream = await this.engine.queryBindings(query, { sources: [dataset] });
      const bindings = [];
      await new Promise((resolve, reject) => {
        bindingsStream.on('data', b => bindings.push(b));
        bindingsStream.on('end', resolve);
        bindingsStream.on('error', reject);
      });

      const results = bindings.map(binding => {
        const institucion = binding.get('institucion') || binding.get('?institucion');
        return {
          label: institucion?.value,
          description: 'Institucion que ofrece programas de becas'
        };
      }).filter(r => r.label);

      return results;
    }

    if (intentObj.intent !== 'query_property') return [];
    const prop = intentObj.property; // e.g., 'tieneRequisito'
    const value = intentObj.value; // e.g., 'TOEFL' or 'alojamiento'

    // Construir consulta dependiendo de propiedad
    let query = '';
    // escape value for regex
    const escapeRegex = v => (''+v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = escapeRegex(value);

    if (prop === 'tieneRequisito') {
      query = `
        PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

        SELECT DISTINCT ?beca ?label ?descripcion WHERE {
          ?beca rdf:type ?t .
          ?t rdfs:subClassOf* becas:Beca .
          ?beca becas:tieneRequisito ?req .
          ?req rdfs:label ?reqLabel .
          FILTER(regex(str(?reqLabel), "${re}", "i"))
          OPTIONAL { ?beca rdfs:label ?label }
          OPTIONAL { ?beca becas:descripcion ?descripcion }
        } LIMIT 100
      `;
    } else if (prop === 'otorgaBeneficio') {
      query = `
        PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

        SELECT DISTINCT ?beca ?label ?descripcion WHERE {
          ?beca rdf:type ?t .
          ?t rdfs:subClassOf* becas:Beca .
          ?beca becas:otorgaBeneficio ?ben .
          ?ben rdfs:label ?benLabel .
          FILTER(regex(str(?benLabel), "${re}", "i"))
          OPTIONAL { ?beca rdfs:label ?label }
          OPTIONAL { ?beca becas:descripcion ?descripcion }
        } LIMIT 100
      `;
    } else if (prop === 'perteneceAÁrea') {
      query = `
        PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

        SELECT DISTINCT ?beca ?label ?descripcion WHERE {
          ?beca rdf:type ?t .
          ?t rdfs:subClassOf* becas:Beca .
          ?beca becas:perteneceAÁrea ?area .
          ?area rdfs:label ?areaLabel .
          FILTER(regex(str(?areaLabel), "${re}", "i"))
          OPTIONAL { ?beca rdfs:label ?label }
          OPTIONAL { ?beca becas:descripcion ?descripcion }
        } LIMIT 100
      `;
    }

    if (!query) return [];
    console.log('SPARQL (local) =>', query);

    const dataset = await this._loadDataset();
    const bindingsStream = await this.engine.queryBindings(query, { sources: [dataset] });
    const bindings = [];
    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => bindings.push(b));
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    const results = bindings.map(binding => {
      const s = binding.get('beca') || binding.get('?beca');
      const label = binding.get('label') || binding.get('?label');
      const descripcion = binding.get('descripcion');
      return {
        uri: s?.value,
        label: label?.value,
        description: descripcion?.value
      };
    });

    // Traducción on-demand
    if (lang && lang !== 'es' && translationService) {
      await Promise.all(results.map(async r => {
        try {
          if (r.label) r.label = await translationService.translateText(r.label, lang, 'es');
          if (r.description) r.description = await translationService.translateText(r.description, lang, 'es');
        } catch (e) {}
      }));
    }

    return results;
  }

  async listBecaTypes(lang = 'es') {
    const query = `
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      SELECT DISTINCT ?tipoLabel WHERE {
        ?tipoClass rdfs:subClassOf* becas:Beca .
        FILTER(?tipoClass != becas:Beca)
        ?tipoClass rdfs:label ?tipoLabel .
      } ORDER BY ?tipoLabel
    `;

    const dataset = await this._loadDataset();
    const bindingsStream = await this.engine.queryBindings(query, { sources: [dataset] });
    const labels = [];
    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => labels.push(b.get('tipoLabel')?.value));
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    // traducir si se solicita
    if (lang && lang !== 'es' && translationService) {
      await Promise.all(labels.map(async (lbl, i) => {
        try { labels[i] = await translationService.translateText(lbl, lang, 'es'); } catch (e) {}
      }));
    }

    return labels;
  }

  async searchByType(typeLabel, lang = 'es') {
    if (!typeLabel) return [];
    const escapeRegex = v => (''+v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = escapeRegex(typeLabel);
    const query = `
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>

      SELECT DISTINCT ?beca ?label ?descripcion WHERE {
        ?beca rdf:type ?t .
        OPTIONAL { ?t rdfs:label ?tLabel }
        OPTIONAL { ?t rdfs:subClassOf* ?superClass . OPTIONAL { ?superClass rdfs:label ?superLabel } }
        OPTIONAL { ?beca rdfs:label ?label }
        OPTIONAL { ?beca becas:descripcion ?descripcion }

        FILTER(
          (
            regex(str(?label), "${re}", "i") ||
            regex(str(?tLabel), "${re}", "i") ||
            regex(str(?superLabel), "${re}", "i")
          )
          && (?t != rdfs:Class && ?t != owl:Class)
        )
      } LIMIT 200
    `;

    console.log('SPARQL (searchByType) =>', query);
    const dataset = await this._loadDataset();
    const bindingsStream = await this.engine.queryBindings(query, { sources: [dataset] });
    const bindings = [];
    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => bindings.push(b));
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    const results = bindings.map(binding => {
      const s = binding.get('beca') || binding.get('?beca');
      const label = binding.get('label') || binding.get('?label');
      const descripcion = binding.get('descripcion');
      return {
        uri: s?.value,
        label: label?.value,
        description: descripcion?.value
      };
    });

    if (lang && lang !== 'es' && translationService) {
      await Promise.all(results.map(async r => {
        try {
          if (r.label) r.label = await translationService.translateText(r.label, lang, 'es');
          if (r.description) r.description = await translationService.translateText(r.description, lang, 'es');
        } catch (e) {}
      }));
    }

    return results;
  }
}

module.exports = new RDFService();
