jest.mock('../src/services/dbpediaService');
jest.mock('../src/services/rdfService');

const dbpediaService = require('../src/services/dbpediaService');
const rdfService = require('../src/services/rdfService');
const request = require('supertest');
const app = require('../src/app');

beforeAll(() => {
  dbpediaService.searchScholarships = jest.fn(async (term, lang) => {
    return [{ uri: 'http://dbpedia.org/resource/TestScholarship', label: `Test ${lang}`, description: `Desc ${lang}`, source: 'dbpedia' }];
  });

  dbpediaService.getScholarshipDetails = jest.fn(async (uri, lang) => ({
    uri,
    label: `Detail ${lang}`,
    name: `Detail ${lang}`,
    description: `DetailDesc ${lang}`,
    requirements: `Reqs ${lang}`,
    source: 'dbpedia'
  }));

  rdfService.getScholarshipDetails = jest.fn(async (uri, lang) => ({
    uri,
    label: `Local ${lang}`,
    name: `Local ${lang}`,
    description: `LocalDesc ${lang}`,
    source: 'local'
  }));
});

describe('Integración /search y /disease', () => {
  test('GET /search retorna resultados traducidos según lang', async () => {
    const res = await request(app).get('/search').query({ q: 'test', lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('Test en');
  });

  test('al cambiar idioma preserva el parámetro q en los enlaces del selector', async () => {
    const res = await request(app).get('/search').query({ q: 'abc', lang: 'es' });
    expect(res.status).toBe(200);
    // el enlace para cambiar a 'en' debe contener q=abc
    expect(res.text).toMatch(/\?q=abc(&|\u0026).*lang=en|\?lang=en(&|\u0026).*q=abc/);
  });

  test('GET /disease/:uri usa dbpediaService para URIs dbpedia', async () => {
    const uri = encodeURIComponent('http://dbpedia.org/resource/TestScholarship');
    const res = await request(app).get(`/disease/${uri}`).query({ lang: 'pt' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('Detail pt');
  });

  test('GET /disease/:uri usa rdfService para ontología local', async () => {
    const uri = encodeURIComponent('http://www.semanticweb.org/ontologia/becas-universitarias#LOCAL');
    const res = await request(app).get(`/disease/${uri}`).query({ lang: 'fr' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('Local fr');
  });
});
