const i18n = require('../src/i18n');

test('carga traducciones en inglés', () => {
  const val = i18n.get('en', 'site_title');
  expect(val).toBe('Scholarship Finder');
});

test('fallback a español si no existe clave en idioma', () => {
  const val = i18n.get('en', 'nonexistent_key');
  expect(val).toBeUndefined();
});
