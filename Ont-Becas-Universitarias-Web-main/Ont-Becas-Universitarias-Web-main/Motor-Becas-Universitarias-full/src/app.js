const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config/express');
const routes = require('./routes/web.route');
const rdfRoutes = require('./routes/rdf.routes'); // Importar rutas RDF
const path = require('path'); 
//const apiRoutes = require('./routes/api');
const languageMiddleware = require('./middleware/language');


const app = express();

// Middlewares
app.use(cookieParser());
app.use(languageMiddleware);
app.use(express.static(path.join(__dirname, 'public')));
// Configuración
config(app);

// Rutas
app.use('/', routes);
app.use('/rdf', rdfRoutes); // Usar rutas RDF
//app.use('/api', apiRoutes);

// Export app para permitir tests sin arrancar servidor automáticamente
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

// Manejador de errores para registrar errores 500 durante desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err && err.stack ? err.stack : err);
    try {
      res.status(err.status || 500).render('error', {
        title: 'Error',
        message: err.message || 'Internal Server Error',
        error: err,
        lang: req.lang || 'es'
      });
    } catch (e) {
      res.status(500).send('Internal Server Error');
    }
  });
}