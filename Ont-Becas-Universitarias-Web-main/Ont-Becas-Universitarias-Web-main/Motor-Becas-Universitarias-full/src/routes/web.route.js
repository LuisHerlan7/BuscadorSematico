// routes/web.js
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

// Home
router.get('/', searchController.home);

// Búsqueda
router.get('/search', searchController.search);

// Ruta oculta accesible solo por URL directa
// router.get('/admin/maintenance', searchController.maintenance);

// Detalle de enfermedad (acepta tanto /disease/:uri como /disease?uri=...)
router.get('/disease/:uri', searchController.diseaseDetails);
router.get('/disease', searchController.diseaseDetails);

// Admin: trigger DBpedia import (hidden — requires ?dev=1)
router.post('/admin/import-dbpedia', searchController.importDbpedia);

module.exports = router;
