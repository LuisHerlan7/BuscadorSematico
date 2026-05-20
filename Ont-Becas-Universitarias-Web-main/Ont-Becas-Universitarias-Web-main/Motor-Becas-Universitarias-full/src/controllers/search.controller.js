const dbpediaService = require('../services/dbpediaService');
const rdfService = require('../services/rdfService');
const translationService = require('../services/translationService');

function extractFallbackTerms(query, intent) {
  if (!query) return [];

  const normalized = String(query)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');

  const stopWords = new Set([
    'que', 'cual', 'cuales', 'beca', 'becas', 'dan', 'da', 'de', 'del',
    'con', 'para', 'por', 'en', 'hay', 'quiero', 'necesito', 'busco', 'una',
    'un', 'las', 'los', 'el', 'la', 'y'
  ]);

  const ignored = new Set();
  if (intent?.value) {
    ignored.add(
      String(intent.value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
    );
  }

  return Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map(term => term.trim())
        .filter(term => term.length >= 4)
        .filter(term => !stopWords.has(term))
        .filter(term => !ignored.has(term))
    )
  );
}

exports.home = (req, res) => {
  res.render('index', { 
    title: 'Buscador de Becas Universitarias',
    lang: req.lang || 'es'
  });
};

exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    const lang = req.lang || 'es';
    // Soporta búsquedas por tipo via query param `type`
    if (req.query.type) {
      const typeLabel = req.query.type;
      const localResults = await rdfService.searchByType(typeLabel, lang);
      const mapped = localResults.map(r => ({ uri: r.uri, label: r.label, description: r.description || '', source: 'local' }));
      return res.render('search-results', {
        title: `Resultados para tipo: ${typeLabel}`,
        query: q || typeLabel,
        diseases: mapped,
        isEmpty: mapped.length === 0,
        lang,
        showDetails: true
      });
    }

    // Intent detection: si se detecta intención, usar consultas SPARQL específicas
    const intentParser = require('../utils/intentParser');
    const intent = intentParser.parseIntent(q);

    // Manejo temprano de intención "listar tipos" para evitar búsquedas innecesarias
    if (intent && intent.intent === 'list_types') {
      const types = await rdfService.listBecaTypes(lang);
      return res.render('types', {
        title: `Tipos de beca para "${q}"`,
        query: q,
        types,
        isEmpty: types.length === 0,
        lang
      });
    }

    let localResults = [];
    let remoteResults = [];

    if (intent) {
      // ejecutar búsquedas específicas por intención
      const [localRes, remoteRes] = await Promise.allSettled([
        rdfService.searchByIntent(intent, lang),
        dbpediaService.searchByIntent(intent, lang)
      ]);
      localResults = localRes.status === 'fulfilled' ? localRes.value : [];
      remoteResults = remoteRes.status === 'fulfilled' ? remoteRes.value : [];
    } else {
      // Ejecutar búsquedas en paralelo: local (RDF) + DBpedia
      const [localRes, remoteRes] = await Promise.allSettled([
        rdfService.searchDiseases(q, lang),
        dbpediaService.searchDiseases(q, lang)
      ]);

      localResults = localRes.status === 'fulfilled' ? localRes.value : [];
      remoteResults = remoteRes.status === 'fulfilled' ? remoteRes.value : [];
    }

    // Si la consulta por intención no arrojó nada, fallback a búsqueda textual general
    if ((Array.isArray(localResults) && localResults.length === 0) && (Array.isArray(remoteResults) && remoteResults.length === 0)) {
      const [localFb, remoteFb] = await Promise.allSettled([
        rdfService.searchDiseases(q, lang),
        dbpediaService.searchDiseases(q, lang)
      ]);
      if (localFb.status === 'fulfilled') localResults = localFb.value;
      if (remoteFb.status === 'fulfilled') remoteResults = remoteFb.value;
    }

    // Mapear y unificar resultados, evitando duplicados por URI
    let merged = [];
    const seen = new Set();
          // listar tipos de beca
          if (intent && intent.intent === 'list_types') {
            const types = await rdfService.listBecaTypes(lang);
            const results = types.map(t => ({ label: t, source: 'local' }));
            return res.render('search-results', { q, results });
          }

    const mapLocal = localResults.map(r => ({
      uri: r.uri,
      label: r.label,
      description: r.description || r.name || '',
      amount: r.amount,
      deadline: r.deadline,
      source: 'local'
    }));

    const mapRemote = remoteResults.map(r => ({
      uri: r.uri,
      label: r.label,
      description: r.description || '',
      source: 'dbpedia'
    }));

    for (const it of mapLocal.concat(mapRemote)) {
      const key = it.uri || (it.label && it.label.toLowerCase());
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(it);
    }

    // Si se detectó intención pero no hubo resultados, hacer fallback a búsqueda textual
    if (intent && merged.length === 0) {
      const [fbLocalRes, fbRemoteRes] = await Promise.allSettled([
        rdfService.searchDiseases(q, lang),
        dbpediaService.searchDiseases(q, lang)
      ]);
      const fbLocal = fbLocalRes.status === 'fulfilled' ? fbLocalRes.value : [];
      const fbRemote = fbRemoteRes.status === 'fulfilled' ? fbRemoteRes.value : [];

      const fbMapLocal = fbLocal.map(r => ({ uri: r.uri, label: r.label, description: r.description || r.name || '', amount: r.amount, deadline: r.deadline, source: 'local' }));
      const fbMapRemote = fbRemote.map(r => ({ uri: r.uri, label: r.label, description: r.description || '', source: 'dbpedia' }));

      for (const it of fbMapLocal.concat(fbMapRemote)) {
        const key = it.uri || (it.label && it.label.toLowerCase());
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(it);
      }

      if (merged.length === 0) {
        const fallbackTerms = extractFallbackTerms(q, intent);

        for (const term of fallbackTerms) {
          const [termLocalRes, termRemoteRes] = await Promise.allSettled([
            rdfService.searchDiseases(term, lang),
            dbpediaService.searchDiseases(term, lang)
          ]);

          const termLocal = termLocalRes.status === 'fulfilled' ? termLocalRes.value : [];
          const termRemote = termRemoteRes.status === 'fulfilled' ? termRemoteRes.value : [];

          const termMapLocal = termLocal.map(r => ({ uri: r.uri, label: r.label, description: r.description || r.name || '', amount: r.amount, deadline: r.deadline, source: 'local' }));
          const termMapRemote = termRemote.map(r => ({ uri: r.uri, label: r.label, description: r.description || '', source: 'dbpedia' }));

          for (const it of termMapLocal.concat(termMapRemote)) {
            const key = it.uri || (it.label && it.label.toLowerCase());
            if (!key) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(it);
          }
        }
      }
    }

    console.log('Merged results:', JSON.stringify(merged, null, 2));
    if (req.query.format === 'json') {
      return res.json({ query: q, results: merged });
    }

    res.render('search-results', {
      title: `Resultados para "${q}"`,
      query: q,
      diseases: merged,
      isEmpty: merged.length === 0,
      lang,
      showDetails: true
    });
  } catch (error) {
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error en la búsqueda de becas',
      error,
      lang: req.lang
    });
  }
};

exports.diseaseDetails = async (req, res) => {
  try {
    const { uri } = req.params;
    const lang = req.lang || 'es';
    const decoded = decodeURIComponent(uri);
    // No usar búsqueda local: intentar cargar detalles desde DBpedia únicamente
    const disease = await dbpediaService.getDiseaseDetails(decoded, lang);
    
    if (!disease) {
      return res.status(404).render('error', {
        title: 'Beca no encontrada',
        message: 'La beca solicitada no fue encontrada',
        lang
      });
    }

    // Opcional: traducir campos si hace falta
    // Renderizar detalle tal cual (el objeto contiene predicados completos)
    res.render('disease-detail', {
      title: disease['http://www.w3.org/2000/01/rdf-schema#label'] || disease['http://www.semanticweb.org/ontologia/becas-universitarias#nombreBeca'] || uri,
      disease,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error al cargar detalles de la enfermedad',
      error,
      lang: req.lang
    });
  }
};
