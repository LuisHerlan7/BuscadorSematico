module.exports = function(req, res, next) {
  res.locals = res.locals || {};
  // Exponer query y path para que las vistas puedan conservar parámetros al cambiar idioma
  res.locals.currentQuery = req.query || {};
  res.locals.currentUrl = req.path || req.originalUrl || '/';

  // 1. Verificar parámetro de URL
  if (req.query.lang && ['en', 'es', 'pt', 'de', 'fr'].includes(req.query.lang)) {
    req.lang = req.query.lang;
    res.cookie('lang', req.query.lang, { maxAge: 900000, httpOnly: true });
    res.locals.lang = req.lang;
    return next();
  }
  
  // 2. Verificar cookie
  if (req.cookies.lang && ['en', 'es', 'pt', 'de', 'fr'].includes(req.cookies.lang)) {
    req.lang = req.cookies.lang;
    res.locals.lang = req.lang;
    return next();
  }
  
  // 3. Verificar cabecera Accept-Language
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage) {
    const preferredLang = acceptLanguage.split(',')[0].split('-')[0];
    if (['en', 'es', 'pt', 'de', 'fr'].includes(preferredLang)) {
      req.lang = preferredLang;
      res.locals.lang = req.lang;
      return next();
    }
  }
  
  // 4. Valor por defecto
  req.lang = 'en';
  res.locals.lang = req.lang;
  next();
};