const request = require('supertest');
const app = require('../src/app');

const langs = {
  es: 'Buscador de Becas',
  en: 'Scholarship Finder',
  pt: 'Buscador de Bolsas',
  fr: 'Recherche de Bourses',
  de: 'Stipendien-Suche'
};

describe('Integración i18n en la ruta /', () => {
  for (const [code, expected] of Object.entries(langs)) {
    test(`GET /?lang=${code} contiene título en ${code}`, async () => {
      const res = await request(app).get('/').query({ lang: code });
      expect(res.status).toBe(200);
      expect(res.text).toContain(expected);
    });
  }
});
