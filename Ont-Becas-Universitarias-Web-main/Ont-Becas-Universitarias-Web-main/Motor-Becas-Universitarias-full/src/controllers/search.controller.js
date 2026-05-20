const dbpediaService = require('../services/dbpediaService');
const translationService = require('../services/translationService');

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
    
    // Buscar solo en DBpedia (no búsqueda local)
    const remoteResults = await dbpediaService.searchDiseases(q, lang);

    // Mapear resultados a la forma que espera la plantilla
    const results = remoteResults.map(r => ({
      uri: r.uri,
      label: r.label,
      description: r.description || '',
      source: 'dbpedia'
    }));

    console.log('Merged results:', JSON.stringify(results, null, 2));
    if (req.query.format === 'json') {
      return res.json({ query: q, results });
    }

    res.render('search-results', {
      title: `Resultados para "${q}"`,
      query: q,
      diseases: results,
      isEmpty: results.length === 0,
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