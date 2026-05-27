// Parser de intención simple basado en reglas y keywords

const KEYWORDS = [
  {keywords: ['toefl'], property: 'tieneRequisito', type: 'requisito', valueNormalize: s => s.toUpperCase()},
  {keywords: ['ielts'], property: 'tieneRequisito', type: 'requisito', valueNormalize: s => s.toUpperCase()},
  {keywords: ['ingles', 'inglés', 'b2'], property: 'tieneRequisito', type: 'requisito', valueNormalize: s => s},
  {keywords: ['promedio', 'excelencia'], property: 'tieneRequisito', type: 'requisito', valueNormalize: s => s},
  {keywords: ['alojamiento','housing'], property: 'otorgaBeneficio', type: 'beneficio', valueNormalize: s => s},
  {keywords: ['manutención','manutencion','stipend','stipendio'], property: 'otorgaBeneficio', type: 'beneficio', valueNormalize: s => s},
  {keywords: ['matricula', 'matrícula'], property: 'otorgaBeneficio', type: 'beneficio', valueNormalize: s => s},
  {keywords: ['pasajes', 'transporte'], property: 'otorgaBeneficio', type: 'beneficio', valueNormalize: s => s},
  {keywords: ['seguro', 'seguro medico', 'seguro médico'], property: 'otorgaBeneficio', type: 'beneficio', valueNormalize: s => s},
  {keywords: ['tecnologia', 'tecnología', 'ingenier', 'engineering', 'ingeniería'], property: 'perteneceAÁrea', type: 'area', valueNormalize: s => s},
  {keywords: ['ciencias sociales', 'sociales'], property: 'perteneceAÁrea', type: 'area', valueNormalize: () => 'Ciencias Sociales'},
  {keywords: ['ciencias naturales', 'naturales'], property: 'perteneceAÁrea', type: 'area', valueNormalize: () => 'Ciencias Naturales'},
  {keywords: ['humanidades'], property: 'perteneceAÁrea', type: 'area', valueNormalize: s => s},
  {keywords: ['artes'], property: 'perteneceAÁrea', type: 'area', valueNormalize: s => s},
  {keywords: ['pregrado'], property: 'perteneceANivel', type: 'nivel', valueNormalize: s => s},
  {keywords: ['maestria', 'maestría', 'master'], property: 'perteneceANivel', type: 'nivel', valueNormalize: () => 'Maestr'},
  {keywords: ['doctorado', 'doctoral'], property: 'perteneceANivel', type: 'nivel', valueNormalize: s => s},
  {keywords: ['postdoctorado'], property: 'perteneceANivel', type: 'nivel', valueNormalize: s => s},
  {keywords: ['fulbright', 'daad', 'chevening', 'erasmus', 'usms', 'minedu'], property: 'esOfrecidaPor', type: 'institucion', valueNormalize: s => s},
  {keywords: ['bolivia', 'alemania', 'estados unidos', 'reino unido'], property: 'destinadaAPaís', type: 'pais', valueNormalize: s => s},
  {keywords: ['movilidad','exchange','intercambio'], property: 'perteneceAÁrea', type: 'area', valueNormalize: s => s}
];

const LIST_TYPES_KEYWORDS = ['tipo','tipos','clase','clases','qué tipos','qué clase','qué clases','qué tipo'];
const LIST_INSTITUTIONS_KEYWORDS = [
  'instituciones',
  'institucion',
  'organizaciones',
  'organizacion',
  'quien ofrece',
  'quienes ofrecen',
  'ofrecen programas de becas',
  'ofrecen becas'
];

function normalize(text) {
  if (!text) return '';
  // pasar a minúsculas, quitar signos de puntuación y eliminar diacríticos (tildes)
  const lowered = text.toLowerCase().replace(/[¿?¡!.,]/g, '').trim();
  return lowered.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function parseIntent(text) {
  const norm = normalize(text);
  if (!norm) return null;

  // detectar petición de listar tipos
  for (const kw of LIST_TYPES_KEYWORDS) {
    const nkw = normalize(kw);
    if (nkw && norm.includes(nkw)) return { intent: 'list_types', raw: text };
  }

  for (const kw of LIST_INSTITUTIONS_KEYWORDS) {
    const nkw = normalize(kw);
    if (nkw && norm.includes(nkw)) {
      return { intent: 'list_institutions', raw: text };
    }
  }

  // buscar coincidencia de palabra clave
  for (const rule of KEYWORDS) {
    for (const kw of rule.keywords) {
      const nkw = normalize(kw);
      if (nkw && norm.includes(nkw)) {
        // extraer la palabra relevante (si hay otras palabras después)
        // ejemplo: "¿Qué becas requieren TOEFL?" -> detecta 'toefl'
        const match = norm.match(new RegExp(`(\\b${nkw}\\b)(.*)`));
        let value = kw;
        if (match && match[2]) {
          // intentar extraer término compuesto (p.ej. 'requieren toefl')
          const tail = match[2].trim().split(' ').filter(Boolean)[0];
          if (tail) value = tail;
        }
        return {
          intent: 'query_property',
          property: rule.property,
          type: rule.type,
          value: rule.valueNormalize ? rule.valueNormalize(kw) : kw,
          raw: text
        };
      }
    }
  }

  return null;
}

module.exports = { parseIntent };
