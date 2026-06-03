const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');

module.exports = function(app) {
  // Configuración de idiomas soportados
  const supportedLangs = {
    es: 'Español',
    en: 'English',
    pt: 'Português',
    fr: 'Français',
    de: 'Deutsch'
  };

  const i18n = require('../i18n');

  // Crear instancia de Handlebars con helpers para i18n
  const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
      // Helper para codificación URI
      encodeURI: function(uri) {
        return encodeURIComponent(uri);
      },
      encodeURIComponent: function(uri) {
        return encodeURIComponent(uri);
      },
      
      // Helper para truncar texto
      truncate: function(str, len) {
        if (str && str.length > len) {
          return str.substring(0, len) + '...';
        }
        return str;
      },
      
      // Helper para año actual
      currentYear: function() {
        return new Date().getFullYear();
      },
      
      // Helper para dividir strings
      split: function(str, index) {
        return str ? str.split(' ')[index] : '';
      },
      
      // Helper para comparación estricta
      eq: (a, b) => a === b,
      
      // Helper para comparación de idioma
      isLang: function(lang, options) {
        return this.lang === lang ? options.fn(this) : options.inverse(this);
      },
      
      // Helper para obtener texto traducido (lee archivos JSON en src/i18n)
      t: function(key, options) {
        const lang = this.lang || options?.data?.root?.lang || 'es';
        return i18n.get(lang, key) || i18n.get('es', key) || key;
      },
      
      // Helper para listar idiomas soportados
      supportedLanguages: function(options) {
        return Object.entries(supportedLangs)
          .map(([code, name]) => options.fn({ code, name, current: this.lang === code }))
          .join('');
      },
      
      // Helper para formatear fechas según idioma
      formatDate: function(dateStr) {
        const date = new Date(dateStr);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const lang = this.lang || 'es';
        
        return date.toLocaleDateString(lang, options);
      }
    }
  });

  // Configurar Handlebars como motor de plantillas
  app.engine('hbs', hbs.engine);
  app.set('view engine', 'hbs');
  app.set('views', path.join(__dirname, '../views'));

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Exponer lista de idiomas soportados a las vistas (el middleware de idioma unificado
  // en src/middleware/language.js se encarga de establecer req.lang / res.locals.lang)
  app.use((req, res, next) => {
    res.locals.supportedLangs = supportedLangs;
    next();
  });
};
