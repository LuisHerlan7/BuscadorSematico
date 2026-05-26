const rdfService = require('../services/rdfService');

exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    // CORREGIDO: Llamada al nuevo nombre del método
    const results = await rdfService.searchScholarships(q);

    res.render('search-results', {
      title: `Resultados para "${q}"`,
      query: q,
      diseases: results,       // Mantenido por compatibilidad con tu vista actual
      scholarships: results,   // Listo para cuando actualices tu vista
      isEmpty: results.length === 0
    });
  } catch (err) {
    res.status(500).render('error', {
      title: 'Error',
      message: 'La búsqueda RDF falló',
      error: err
    });
  }
};

exports.diseaseDetails = async (req, res) => {
  try {
    const { uri } = req.params;
    const decodedUri = decodeURIComponent(uri);
    // CORREGIDO: Llamada al nuevo nombre del método
    const scholarship = await rdfService.getScholarshipDetails(decodedUri);

    res.render('disease-detail', {
      title: scholarship.name || scholarship.label || 'Detalles de la Beca',
      disease: scholarship,    // Mantenido por compatibilidad
      scholarship: scholarship,
      lang: req.lang || 'es'
    });
  } catch (err) {
    res.status(500).render('error', {
      title: 'Error',
      message: 'Error al cargar detalles de la beca',
      error: err
    });
  }
};