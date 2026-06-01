const fs = require('fs');
const path = require('path');
const { QueryEngine } = require('@comunica/query-sparql');

// Rutas de los archivos ontológicos
const defaultOwl = path.join(__dirname, '../public/data/ontologia_becas.owl');
const instancesTtl = path.join(__dirname, '../public/data/ontologia_becas_instances.ttl');

let rdfFilePath = process.env.ONTOLOGY_FILE || defaultOwl;
if (fs.existsSync(instancesTtl)) {
  rdfFilePath = process.env.ONTOLOGY_FILE || instancesTtl;
}

// Términos genéricos que describen la ontología o conectores comunes
const GENERIC_TERMS = new Set([
  'beca', 'becas', 'universitaria', 'universitarias', 
  'universitario', 'universitarios', 'universidad', 'universidades',
  'estudio', 'estudios', 'programa', 'programas', 'de', 'para', 'en'
]);

class RDFService {
  constructor() {
    this.engine = new QueryEngine();
    
    // Resolvemos la ruta absoluta del archivo ontológico
    const filePath = path.resolve(rdfFilePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No se encontró el archivo ontológico en: ${filePath}`);
    }
    
    // Cargamos el contenido del archivo en memoria para evitar accesos repetitivos a disco
    this.fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Determinamos dinámicamente el mediaType según la extensión del archivo
    const ext = path.extname(filePath).toLowerCase();
    this.mediaType = ext === '.ttl' ? 'text/turtle' : 'application/rdf+xml';
  }

  _getComunicaSources() {
    return [{
      type: 'serialized',
      value: this.fileContent,
      mediaType: this.mediaType,
      baseIRI: 'http://www.semanticweb.org/ontologia/becas-universitarias#'
    }];
  }

  /**
   * Tokeniza y normaliza el término de búsqueda
   */
  _parseSearchKeywords(term) {
    if (!term) return [];
    const normalized = term
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
    
    return normalized.split(/\s+/).filter(w => w.length >= 2);
  }

  /**
   * Filtra términos genéricos para quedarse con las palabras clave específicas
   */
  _getSpecificKeywords(keywords) {
    return keywords.filter(w => {
      let stem = w;
      // Singularización básica para español
      if (w.endsWith('es') && w.length > 4) {
        stem = w.slice(0, -2);
      } else if (w.endsWith('s') && !w.endsWith('es') && w.length > 3) {
        stem = w.slice(0, -1);
      }
      return !GENERIC_TERMS.has(w) && !GENERIC_TERMS.has(stem);
    });
  }

  /**
   * Construye dinámicamente la cláusula FILTER en SPARQL para admitir búsquedas multi-palabra y evitar búsquedas vacías
   */
  _buildSPARQLFilter(term) {
    const keywords = this._parseSearchKeywords(term);
    const specific = this._getSpecificKeywords(keywords);

    if (specific.length === 0) {
      // Si la búsqueda solo contiene términos genéricos (ej. "becas universitarias"),
      // devolvemos todas las becas de la ontología sin aplicar filtro rígido de texto.
      return '';
    }

    // Si contiene palabras clave específicas, construimos filtros tolerantes con OR (||)
    const filterClauses = specific.map(word => {
      const escaped = word.replace(/"/g, '\\"');
      return `(
        CONTAINS(LCASE(STR(?label)), "${escaped}")
        || CONTAINS(LCASE(STR(?nombre)), "${escaped}")
        || CONTAINS(LCASE(STR(?descripcion)), "${escaped}")
      )`;
    });

    return `FILTER(${filterClauses.join(' || ')})`;
  }

  async searchScholarships(term, lang = 'es') {
    const filterClause = this._buildSPARQLFilter(term);

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
        
        ${filterClause}
      } LIMIT 50
    `;

    // Consultamos pasando los datos serializados
    const bindingsStream = await this.engine.queryBindings(query, { sources: this._getComunicaSources() });
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

    // Consultamos pasando los datos serializados
    const bindingsStream = await this.engine.queryBindings(query, { sources: this._getComunicaSources() });
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