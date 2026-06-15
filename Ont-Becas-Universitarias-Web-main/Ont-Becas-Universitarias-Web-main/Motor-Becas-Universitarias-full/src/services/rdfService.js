const fs = require('fs');
const path = require('path');

// Rutas de los archivos ontológicos
const defaultOwl = path.join(__dirname, '../public/data/ontologia_becas.owl');
const rdfFilePath = process.env.ONTOLOGY_FILE || defaultOwl;

// Términos genéricos que describen la ontología o conectores comunes
const GENERIC_TERMS = new Set([
  'beca', 'becas', 'universitaria', 'universitarias', 
  'universitario', 'universitarios', 'universidad', 'universidades',
  'estudio', 'estudios', 'programa', 'programas', 'de', 'para', 'en'
]);

class RDFService {
  constructor() {
    this.engine = null;
    this.fileContent = null;
    this.mediaType = null;
    this.offlineDbpediaRecords = null;
  }

  _ensureLoaded() {
    if (this.engine && this.fileContent && this.mediaType) return;

    const { QueryEngine } = require('@comunica/query-sparql');
    this.engine = new QueryEngine();

    // Resolvemos la ruta absoluta del archivo ontológico
    const filePath = path.resolve(rdfFilePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No se encontró el archivo ontológico en: ${filePath}`);
    }
    
    // Cargamos el contenido del archivo en memoria para evitar accesos repetitivos a disco
    this.fileContent = fs.readFileSync(filePath, 'utf8');
    
    this.mediaType = 'application/rdf+xml';
  }

  _getComunicaSources() {
    this._ensureLoaded();

    return [{
      type: 'serialized',
      value: this.fileContent,
      mediaType: this.mediaType,
      baseIRI: 'http://www.semanticweb.org/ontologia/becas-universitarias#'
    }];
  }

  async _queryBindings(query) {
    const sources = this._getComunicaSources();
    const bindingsStream = await this.engine.queryBindings(query, { sources });
    const bindings = [];

    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => {
        const plain = new Map();
        for (const [key, value] of b) {
          const keyName = key?.value || key?.id || String(key).replace(/^\?/, '');
          plain.set(keyName, value ? {
            value: value.value,
            language: value.language,
            datatype: value.datatype?.value,
            termType: value.termType
          } : null);
        }
        bindings.push(plain);
      });
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    return bindings;
  }

  _normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
  }

  _isGenericScholarshipSearch(term) {
    const normalized = this._normalize(term);
    return ['beca', 'becas', 'scholarship', 'scholarships', 'bolsa', 'bolsas', 'bourse', 'stipendium'].includes(normalized);
  }

  _pickLiteral(group, field, lang = 'es') {
    const values = group[field] || [];
    const preferred = values.find(v => v.lang === lang)
      || values.find(v => v.lang === 'es')
      || values.find(v => v.lang === 'en')
      || values[0];

    return preferred?.value || null;
  }

  _mapOfflineGroup(uri, group, lang = 'es') {
    const label = this._pickLiteral(group, 'labels', lang) || uri;
    const description = this._pickLiteral(group, 'descriptions', lang) || '';
    const fragment = uri.split('#').pop() || uri;
    const publicUri = `offline-dbpedia:${fragment}`;

    return {
      uri: publicUri,
      safeUri: encodeURIComponent(publicUri),
      ontologyUri: uri,
      dbpediaUri: group.dbpediaUri || null,
      dbpediaPage: group.dbpediaUri || null,
      label,
      name: label,
      description,
      abstract: description,
      type: group.type || null,
      institution: group.institution || null,
      level: group.level || null,
      area: group.area || null,
      country: group.country || null,
      amount: group.amount || null,
      deadline: group.deadline || null,
      requirements: this._pickLiteral(group, 'requirements', lang),
      benefits: this._pickLiteral(group, 'benefits', lang),
      seeAlso: group.seeAlso || null,
      thumbnail: null,
      source: 'dbpedia-offline'
    };
  }

  _decodeXml(value) {
    return String(value || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  _extractFirst(block, tagName) {
    const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`);
    const match = block.match(pattern);
    return match ? this._decodeXml(match[1].trim()) : null;
  }

  _extractLiterals(block, tagName) {
    const pattern = new RegExp(`<${tagName}([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'g');
    const values = [];
    let match;

    while ((match = pattern.exec(block)) !== null) {
      const langMatch = match[1].match(/xml:lang="([^"]+)"/);
      values.push({
        lang: langMatch ? langMatch[1] : '',
        value: this._decodeXml(match[2].trim())
      });
    }

    return values;
  }

  _extractResource(block, tagName) {
    const pattern = new RegExp(`<${tagName}[^>]*rdf:resource="([^"]+)"`);
    const match = block.match(pattern);
    return match ? this._decodeXml(match[1]) : null;
  }

  _loadOfflineDbpediaRecords() {
    if (this.offlineDbpediaRecords) return this.offlineDbpediaRecords;

    const filePath = path.resolve(rdfFilePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const individualPattern = /<owl:NamedIndividual\s+rdf:about="([^"]+)">([\s\S]*?)<\/owl:NamedIndividual>/g;
    const records = new Map();
    let match;

    while ((match = individualPattern.exec(content)) !== null) {
      const [, about, block] = match;
      if (!block.includes('<esRespaldoDBpedia')) continue;

      const typeResource = this._extractResource(block, 'rdf:type');
      const labels = this._extractLiterals(block, 'rdfs:label');
      const descriptions = this._extractLiterals(block, 'descripción');
      const requirements = this._extractLiterals(block, 'requisitosTexto');
      const benefits = this._extractLiterals(block, 'beneficiosTexto');
      const dbpediaUri = this._extractResource(block, 'owl:sameAs');
      const seeAlso = this._extractResource(block, 'rdfs:seeAlso');

      const uri = about.startsWith('#')
        ? `http://www.semanticweb.org/ontologia/becas-universitarias${about}`
        : about;

      records.set(uri, {
        labels,
        descriptions,
        requirements,
        benefits,
        type: typeResource ? typeResource.replace('#', '') : null,
        amount: this._extractFirst(block, 'montoCubierto'),
        deadline: this._extractFirst(block, 'fechaLímitePostulación'),
        institution: this._extractFirst(block, 'institucionTexto'),
        level: this._extractFirst(block, 'nivelTexto'),
        area: this._extractFirst(block, 'areaTexto'),
        country: this._extractFirst(block, 'paisTexto'),
        dbpediaUri,
        seeAlso
      });
    }

    this.offlineDbpediaRecords = records;
    return records;
  }

  _offlineSearchText(group) {
    return [
      ...(group.labels || []).map(item => item.value),
      ...(group.descriptions || []).map(item => item.value),
      ...(group.requirements || []).map(item => item.value),
      ...(group.benefits || []).map(item => item.value),
      group.type,
      group.institution,
      group.level,
      group.area,
      group.country
    ].join(' ');
  }

  async _getOfflineDbpediaGroups() {
    return this._loadOfflineDbpediaRecords();
  }

  async searchOfflineDbpediaScholarships(term, lang = 'es') {
    const groups = await this._getOfflineDbpediaGroups();
    const words = this._normalize(term).split(/\s+/).filter(Boolean);
    const isGeneric = !term || !String(term).trim() || this._isGenericScholarshipSearch(term);

    return Array.from(groups.entries())
      .filter(([, group]) => {
        if (isGeneric) return true;
        const haystack = this._normalize(this._offlineSearchText(group));
        return words.every(word => haystack.includes(word));
      })
      .map(([uri, group]) => this._mapOfflineGroup(uri, group, lang));
  }

  async getOfflineDbpediaScholarshipDetails(uri, lang = 'es') {
    const groups = await this._getOfflineDbpediaGroups();
    const target = String(uri || '')
      .replace(/^offline-dbpedia:/, '')
      .toLowerCase();

    for (const [subject, group] of groups.entries()) {
      const fragment = (subject.split('#').pop() || subject).toLowerCase();
      if (subject === uri || group.dbpediaUri === uri || fragment === target) {
        return this._mapOfflineGroup(subject, group, lang);
      }
    }

    return null;
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
        CONTAINS(LCASE(COALESCE(STR(?label), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?nombre), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?descripcion), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?requisitosTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?beneficiosTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?institucionTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?nivelTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?areaTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?paisTexto), "")), "${escaped}")
      )`;
    });

    return `FILTER(${filterClauses.join(' || ')})`;
  }

  async searchScholarships(term, lang = 'es') {
    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      SELECT DISTINCT ?s ?label ?descripcion ?monto ?fechaFinal ?nombre ?requisitosTexto ?beneficiosTexto ?institucionTexto ?nivelTexto ?areaTexto ?paisTexto WHERE {
        {
          # Buscar instancias de Beca o cualquier subclase de Beca
          ?s a ?type .
          ?type rdfs:subClassOf* becas:Beca .
        } UNION {
          # Fallback: cualquier entidad con nombreBeca es una beca
          ?s becas:nombreBeca ?anyNombre .
        }
        ?s rdfs:label ?label .
        FILTER(LANG(?label) = "${lang}" || LANG(?label) = "es" || LANG(?label) = "en" || LANG(?label) = "")
        OPTIONAL { ?s becas:descripcion ?descripcionSinTilde }
        OPTIONAL { ?s becas:descripción ?descripcionConTilde }
        OPTIONAL { ?s becas:requisitosTexto ?requisitosTexto }
        OPTIONAL { ?s becas:beneficiosTexto ?beneficiosTexto }
        OPTIONAL { ?s becas:institucionTexto ?institucionTexto }
        OPTIONAL { ?s becas:nivelTexto ?nivelTexto }
        OPTIONAL { ?s becas:areaTexto ?areaTexto }
        OPTIONAL { ?s becas:paisTexto ?paisTexto }
        OPTIONAL { ?s becas:montoCubierto ?monto }
        OPTIONAL { ?s becas:fechaLímitePostulación ?fecha }
        OPTIONAL { ?s becas:fechaLimitePostulacion ?fechaAlt }
        OPTIONAL { ?s becas:nombreBeca ?nombre }
        BIND(COALESCE(?fecha, ?fechaAlt) AS ?fechaFinal)
        BIND(COALESCE(?descripcionSinTilde, ?descripcionConTilde) AS ?descripcion)
      } LIMIT 200
    `;

    const bindings = await this._queryBindings(query);
    const specific = this._getSpecificKeywords(this._parseSearchKeywords(term));

    const mapped = bindings.map(binding => {
      const s = binding.get('s') || binding.get('?s');
      const label = binding.get('label') || binding.get('?label');
      const descripcion = binding.get('descripcion') || binding.get('?descripcion');
      const monto = binding.get('monto') || binding.get('?monto');
      const fecha = binding.get('fechaFinal') || binding.get('?fechaFinal') || binding.get('fecha') || binding.get('?fecha');
      const nombre = binding.get('nombre') || binding.get('?nombre');
      const requisitos = binding.get('requisitosTexto') || binding.get('?requisitosTexto');
      const beneficios = binding.get('beneficiosTexto') || binding.get('?beneficiosTexto');
      const institucion = binding.get('institucionTexto') || binding.get('?institucionTexto');
      const nivel = binding.get('nivelTexto') || binding.get('?nivelTexto');
      const area = binding.get('areaTexto') || binding.get('?areaTexto');
      const pais = binding.get('paisTexto') || binding.get('?paisTexto');

      return {
        uri: s?.value,
        label: label?.value,
        name: nombre?.value || label?.value,
        description: descripcion?.value,
        amount: monto?.value,
        deadline: fecha?.value,
        requirements: requisitos?.value,
        benefits: beneficios?.value,
        institution: institucion?.value,
        level: nivel?.value,
        area: area?.value,
        country: pais?.value,
        source: 'local'
      };
    });

    const deduped = [];
    const seen = new Set();

    for (const item of mapped) {
      if (!item.uri || seen.has(item.uri)) continue;

      const haystack = this._normalize([
        item.label,
        item.name,
        item.description,
        item.requirements,
        item.benefits,
        item.institution,
        item.level,
        item.area,
        item.country
      ].join(' '));

      if (specific.length > 0 && !specific.some(word => haystack.includes(word))) continue;

      seen.add(item.uri);
      deduped.push(item);
    }

    return deduped.slice(0, 50);
  }

  async getScholarshipDetails(uri, lang = 'es') {
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

    const bindings = await this._queryBindings(query);

    const NS = 'http://www.semanticweb.org/ontologia/becas-universitarias#';
    const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
    const OWL = 'http://www.w3.org/2002/07/owl#';

    const raw = {};
    const requirements = [];
    const benefits = [];
    const labels = [];
    const descriptions = [];
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

      if (propUri === `${RDFS}label`) {
        labels.push({ value: objVal, lang: o.language || '' });
      } else if (propUri === `${NS}descripción` || propUri === `${NS}descripcion`) {
        descriptions.push({ value: objVal, lang: o.language || '' });
      } else if (propUri === `${NS}tieneRequisito`) {
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

    const pickLang = values => {
      const preferred = values.find(v => v.lang === lang)
        || values.find(v => v.lang === 'es')
        || values.find(v => v.lang === 'en')
        || values[0];
      return preferred?.value || null;
    };

    const label = pickLang(labels) || raw[`${NS}nombreBeca`] || uri;
    const desc = pickLang(descriptions) || raw[`${NS}descripcion`] || raw[`${NS}descripción`] || '';
    const amount = raw[`${NS}montoCubierto`] || null;
    const deadline = raw[`${NS}fechaLímitePostulación`] || raw[`${NS}fechaLimitePostulacion`] || null;
    const dbpediaUri = raw[`${OWL}sameAs`] || null;
    const seeAlso = raw[`${RDFS}seeAlso`] || null;
    const requirementsText = raw[`${NS}requisitosTexto`] || null;
    const benefitsText = raw[`${NS}beneficiosTexto`] || null;
    const institutionText = raw[`${NS}institucionTexto`] || null;
    const levelText = raw[`${NS}nivelTexto`] || null;
    const areaText = raw[`${NS}areaTexto`] || null;
    const countryText = raw[`${NS}paisTexto`] || null;

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
      requirements: requirements.length > 0 ? requirements.join(', ') : requirementsText,
      benefits: benefits.length > 0 ? benefits.join(', ') : benefitsText,
      institution: institution || institutionText,
      level: level || levelText,
      area: area || areaText,
      country: country || countryText,
      thumbnail: null,
      source: 'local',
      _raw: raw
    };
  }
}

module.exports = new RDFService();
