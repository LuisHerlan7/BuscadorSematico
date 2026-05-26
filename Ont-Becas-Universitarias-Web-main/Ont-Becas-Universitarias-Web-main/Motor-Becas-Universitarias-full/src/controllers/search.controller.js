const dbpediaService = require('../services/dbpediaService');
const translationService = require('../services/translationService');
// CORREGIDO: Faltaba importar rdfService en este archivo
const rdfService = require('../services/rdfService');

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

    // Buscar en AMBAS fuentes en paralelo: Local (TTL) y DBpedia
    const [localResult, dbpediaResult] = await Promise.allSettled([
      rdfService.searchScholarships(q, lang),
      dbpediaService.searchScholarships(q, lang)
    ]);

    // Resultados locales (ontologia_becas_instances.ttl)
    const localResults = (localResult.status === 'fulfilled' ? localResult.value : []).map(r => ({
      uri: r.uri,
      label: r.label,
      name: r.name || r.label,
      description: r.description || '',
      amount: r.amount || null,
      deadline: r.deadline || null,
      source: 'local'
    }));

    // Resultados de DBpedia
    const dbpediaResults = (dbpediaResult.status === 'fulfilled' ? dbpediaResult.value : []).map(r => ({
      uri: r.uri,
      label: r.label,
      name: r.name || r.label,
      description: r.description || '',
      source: 'dbpedia'
    }));

    // Log de errores si alguna fuente falló
    if (localResult.status === 'rejected') {
      console.error('Error en búsqueda local:', localResult.reason?.message);
    }
    if (dbpediaResult.status === 'rejected') {
      console.error('Error en búsqueda DBpedia:', dbpediaResult.reason?.message);
    }

    // Combinar: primero locales, luego DBpedia (evitar duplicados por URI)
    const seenUris = new Set();
    const results = [];

    for (const r of localResults) {
      if (r.uri && !seenUris.has(r.uri)) {
        seenUris.add(r.uri);
        results.push(r);
      }
    }
    for (const r of dbpediaResults) {
      if (r.uri && !seenUris.has(r.uri)) {
        seenUris.add(r.uri);
        results.push(r);
      }
    }

    console.log(`Búsqueda "${q}": ${localResults.length} locales, ${dbpediaResults.length} DBpedia, ${results.length} combinados`);

    if (req.query.format === 'json') {
      return res.json({ query: q, results, localCount: localResults.length, dbpediaCount: dbpediaResults.length });
    }

    res.render('search-results', {
      title: `Resultados para "${q}"`,
      query: q,
      diseases: results,      // Mantenido por compatibilidad
      scholarships: results,
      isEmpty: results.length === 0,
      localCount: localResults.length,
      dbpediaCount: dbpediaResults.length,
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

    // Enrutar por origen: dbpedia.org → servicio remoto, resto → ontología local
    let scholarship;
    if (decoded.includes('dbpedia.org')) {
      // CORREGIDO
      scholarship = await dbpediaService.getScholarshipDetails(decoded, lang);
    } else {
      // CORREGIDO
      scholarship = await rdfService.getScholarshipDetails(decoded);
    }

    if (!scholarship) {
      return res.status(404).render('error', {
        title: 'Beca no encontrada',
        message: 'La beca solicitada no fue encontrada',
        lang
      });
    }

    res.render('disease-detail', {
      title: scholarship.name || scholarship.label || uri,
      disease: scholarship,    // Mantenido por compatibilidad
      scholarship: scholarship,
      lang
    });
  } catch (error) {
    res.status(500).render('error', {
      title: 'Error',
      message: 'Error al cargar detalles de la beca',
      error,
      lang: req.lang
    });
  }
};