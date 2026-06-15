const dbpediaService = require('../services/dbpediaService');
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

    // La búsqueda principal usa DBpedia remoto y cae al respaldo RDF/XML del OWL si no hay respuesta.
    const dbpediaResult = await Promise.resolve(dbpediaService.searchScholarships(q, lang))
      .then(value => ({ status: 'fulfilled', value }))
      .catch(reason => ({ status: 'rejected', reason }));

    const localResult = await Promise.resolve(rdfService.searchScholarships(q, lang))
      .then(value => ({ status: 'fulfilled', value }))
      .catch(reason => ({ status: 'rejected', reason }));

    const localResults = (localResult.status === 'fulfilled' ? localResult.value : []).map(r => ({
      uri: r.uri,
      label: r.label,
      name: r.name || r.label,
      description: r.description || '',
      dbpediaUri: r.dbpediaUri || null,
      dbpediaPage: r.dbpediaPage || r.dbpediaUri || null,
      amount: r.amount || null,
      deadline: r.deadline || null,
      institution: r.institution || null,
      level: r.level || null,
      area: r.area || null,
      country: r.country || null,
      requirements: r.requirements || null,
      benefits: r.benefits || null,
      seeAlso: r.seeAlso || null,
      source: r.source || 'local'
    }));

    // Resultados de DBpedia
    const dbpediaResults = (dbpediaResult.status === 'fulfilled' ? dbpediaResult.value : []).map(r => ({
      uri: r.uri,
      label: r.label,
      name: r.name || r.label,
      description: r.description || '',
      dbpediaUri: r.dbpediaUri || null,
      dbpediaPage: r.dbpediaPage || r.dbpediaUri || null,
      amount: r.amount || null,
      deadline: r.deadline || null,
      institution: r.institution || null,
      level: r.level || null,
      area: r.area || null,
      country: r.country || null,
      requirements: r.requirements || null,
      benefits: r.benefits || null,
      seeAlso: r.seeAlso || null,
      source: r.source || 'dbpedia'
    }));

    // Log de errores si alguna fuente falló
    if (dbpediaResult.status === 'rejected') {
      console.error('Error en búsqueda DBpedia:', dbpediaResult.reason?.message);
    }
    if (localResult.status === 'rejected') {
      console.error('Error en búsqueda local:', localResult.reason?.message);
    }

    // Combinar: primero locales, luego DBpedia (evitar duplicados por URI)
    const canonicalKey = uri => String(uri || '')
      .replace(/^offline-dbpedia:/, '')
      .split('#')
      .pop()
      .toLowerCase();
    const seenUris = new Set();
    const results = [];

    for (const r of localResults) {
      const key = canonicalKey(r.uri);
      if (r.uri && !seenUris.has(key)) {
        seenUris.add(key);
        results.push(r);
      }
    }
    for (const r of dbpediaResults) {
      const key = canonicalKey(r.uri);
      if (r.uri && !seenUris.has(key)) {
        seenUris.add(key);
        results.push(r);
      }
    }

    const visibleLocalCount = results.filter(r => r.source === 'local').length;
    const remoteDbpediaCount = results.filter(r => r.source === 'dbpedia').length;
    const offlineDbpediaCount = results.filter(r => r.source === 'dbpedia-offline').length;

    console.log(`Búsqueda "${q}": ${visibleLocalCount} locales, ${remoteDbpediaCount} DBpedia, ${offlineDbpediaCount} DBpedia offline, ${results.length} combinados`);

    if (req.query.format === 'json') {
      return res.json({
        query: q,
        results,
        localCount: visibleLocalCount,
        dbpediaCount: remoteDbpediaCount,
        dbpediaOfflineCount: offlineDbpediaCount
      });
    }

    res.render('search-results', {
      title: `Resultados para "${q}"`,
      query: q,
      diseases: results,      // Mantenido por compatibilidad
      scholarships: results,
      isEmpty: results.length === 0,
      localCount: visibleLocalCount,
      dbpediaCount: remoteDbpediaCount,
      dbpediaOfflineCount: offlineDbpediaCount,
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
    if (decoded.startsWith('offline-dbpedia:')) {
      scholarship = await dbpediaService.getOfflineScholarshipDetails(decoded, lang);
    } else if (decoded.includes('dbpedia.org') || decoded.includes('wikidata.org/entity/')) {
      // CORREGIDO
      scholarship = await dbpediaService.getScholarshipDetails(decoded, lang);
    } else {
      // CORREGIDO
      scholarship = await rdfService.getScholarshipDetails(decoded, lang);
    }

    if (!scholarship) {
      console.warn(`Detalle no disponible para URI ${decoded}. Mostrando página mínima.`);
      scholarship = {
        uri: decoded,
        label: decoded.split('/').pop() || decoded,
        name: decoded.split('/').pop() || decoded,
        abstract: '',
        description: '',
        source: (decoded.includes('dbpedia.org') || decoded.includes('wikidata.org/entity/')) ? 'dbpedia' : 'local',
        dbpediaUri: (decoded.includes('dbpedia.org') || decoded.includes('wikidata.org/entity/')) ? decoded : null
      };
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

// Admin action: trigger DBpedia extraction script (hidden). Requires query param dev=1.
exports.importDbpedia = (req, res) => {
  try {
    if (req.query.dev !== '1') return res.status(403).json({ error: 'Forbidden' });

    const { limit = 300, merge = 'true', langs = 'es,en,pt,de,fr' } = req.body || {};
    const ints = parseInt(limit, 10) || 300;
    const mergeFlag = merge === 'true' || merge === true;
    const langsList = String(langs).split(',').map(s => s.trim()).filter(Boolean);

    const { spawn } = require('child_process');
    const scriptPath = require('path').join(__dirname, '../../scripts/extract_dbpedia_scholarships.js');
    const args = [scriptPath, `--limit=${ints}`];
    if (mergeFlag) args.push('--out', 'src/public/data/ontologia_becas.owl', '--merge');
    if (langsList.length) args.push(`--langs=${langsList.join(',')}`);

    const child = spawn('node', args, { cwd: require('path').join(__dirname, '../../') });

    // stream logs
    child.stdout.on('data', d => console.log('[import-dbpedia]', d.toString()));
    child.stderr.on('data', d => console.error('[import-dbpedia]', d.toString()));

    child.on('close', code => console.log(`import-dbpedia exited ${code}`));

    return res.json({ status: 'started', pid: child.pid });
  } catch (err) {
    console.error('importDbpedia error', err);
    return res.status(500).json({ error: err.message });
  }
};
