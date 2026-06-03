const rdfService = require('../src/services/rdfService');

test('_pickLiteral prefiere el idioma solicitado y hace fallback', () => {
  const group = {
    labels: [
      { lang: 'es', value: 'Beca Español' },
      { lang: 'en', value: 'Scholarship English' },
      { lang: 'pt', value: 'Bolsa Português' }
    ],
    descriptions: [
      { lang: 'es', value: 'Descripción ES' },
      { lang: 'en', value: 'Description EN' }
    ]
  };

  expect(rdfService._pickLiteral(group, 'labels', 'pt')).toBe('Bolsa Português');
  expect(rdfService._pickLiteral(group, 'labels', 'de')).toBe('Beca Español'); // fallback a 'es'
  expect(rdfService._pickLiteral(group, 'labels', 'en-US')).toBe('Scholarship English'); // normaliza 'en-US' -> 'en'
  expect(rdfService._pickLiteral(group, 'descriptions', 'en')).toBe('Description EN');
});
