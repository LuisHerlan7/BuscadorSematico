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

  // Definir helpers en un objeto para compartirlos con Handlebars subyacente
  const helpers = {
    encodeURI: function(uri) { return encodeURIComponent(uri); },
    encodeURIComponent: function(uri) { return encodeURIComponent(uri); },
    truncate: function(str, len) { if (str && str.length > len) return str.substring(0, len) + '...'; return str; },
    currentYear: function() { return new Date().getFullYear(); },
    split: function(str, index) { return str ? str.split(' ')[index] : ''; },
    eq: (a, b) => a === b,
    isLang: function(lang, options) { return this.lang === lang ? options.fn(this) : options.inverse(this); },
    t: function(key, options) { const lang = this.lang || options?.data?.root?.lang || 'es'; return i18n.get(lang, key) || i18n.get('es', key) || key; },
    supportedLanguages: function(options) { return Object.entries(supportedLangs).map(([code, name]) => options.fn({ code, name, current: this.lang === code })).join(''); },
    formatDate: function(dateStr) { const date = new Date(dateStr); const opts = { year: 'numeric', month: 'long', day: 'numeric' }; const lang = this.lang || 'es'; return date.toLocaleDateString(lang, opts); },
    buildLangUrl: function(code, maybePath, options) {
      let thePath = '/';
      let opts = options;
      if (arguments.length === 2) {
        opts = maybePath;
        thePath = opts?.data?.root?.currentUrl || '/';
      } else {
        thePath = maybePath || (options?.data?.root?.currentUrl) || '/';
      }

      const root = opts?.data?.root || {};
      let queryObj = {};
      if (root.currentQuery && typeof root.currentQuery === 'object') {
        queryObj = Object.assign({}, root.currentQuery);
      } else if (root.query && typeof root.query === 'string') {
        queryObj = Object.assign({}, {}, { q: root.query });
      } else if (root.query && typeof root.query === 'object') {
        queryObj = Object.assign({}, root.query);
      }
      queryObj.lang = code;

      const parts = Object.keys(queryObj).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryObj[k])}`).filter(Boolean);
      return thePath + (parts.length ? ('?' + parts.join('&')) : '');
    }
  };

  // Crear instancia de Handlebars con los helpers
  const hbs = exphbs.create({ extname: '.hbs', defaultLayout: 'main', helpers });

  // Registrar los mismos helpers en el runtime de Handlebars
  try {
    Object.entries(helpers).forEach(([name, fn]) => {
      if (hbs && hbs.handlebars && typeof hbs.handlebars.registerHelper === 'function') {
        hbs.handlebars.registerHelper(name, fn);
      }
    });
    // También registrar en la instancia global de `handlebars` por si se usa
    // directamente (evita Missing helper en algunos entornos).
    try {
      const Handlebars = require('handlebars');
      Object.entries(helpers).forEach(([name, fn]) => {
        if (Handlebars && typeof Handlebars.registerHelper === 'function') {
          Handlebars.registerHelper(name, fn);
        }
      });
    } catch (e) {
      // no crítico
    }
  } catch (err) {
    console.warn('Warning: could not register helpers on hbs.handlebars', err && err.message);
  }

  // Configurar Handlebars como motor de plantillas
  app.engine('hbs', hbs.engine);
  app.set('view engine', 'hbs');
  app.set('views', path.join(__dirname, '../views'));

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../public')));

  // Exponer lista de idiomas soportados a las vistas
  app.use((req, res, next) => {
    res.locals.supportedLangs = supportedLangs;
    next();
  });
};
