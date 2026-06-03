const languageMiddleware = require('../src/middleware/language');

function mockReqRes({ query = {}, cookies = {}, headers = {} } = {}) {
  const req = { query, cookies, headers };
  const res = { cookie: jest.fn(), locals: {} };
  const next = jest.fn();
  return { req, res, next };
}

test('usa query lang si está presente', () => {
  const { req, res, next } = mockReqRes({ query: { lang: 'es' } });
  languageMiddleware(req, res, next);
  expect(req.lang).toBe('es');
  expect(res.cookie).toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
});

test('usa cookie lang si no hay query', () => {
  const { req, res, next } = mockReqRes({ cookies: { lang: 'pt' } });
  languageMiddleware(req, res, next);
  expect(req.lang).toBe('pt');
  expect(res.locals.lang).toBe('pt');
  expect(next).toHaveBeenCalled();
});

test('usa header Accept-Language si no hay query ni cookie', () => {
  const { req, res, next } = mockReqRes({ headers: { 'accept-language': 'de-DE,de;q=0.9' } });
  languageMiddleware(req, res, next);
  expect(req.lang).toBe('de');
  expect(res.locals.lang).toBe('de');
  expect(next).toHaveBeenCalled();
});

test('valor por defecto es en', () => {
  const { req, res, next } = mockReqRes();
  languageMiddleware(req, res, next);
  expect(req.lang).toBe('en');
  expect(res.locals.lang).toBe('en');
});
