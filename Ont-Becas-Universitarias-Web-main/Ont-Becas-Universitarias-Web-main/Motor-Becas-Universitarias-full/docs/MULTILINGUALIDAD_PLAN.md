# Plan de implementación de Multilingualidad (funcional)

## Resumen

Este documento describe un plan práctico y ejecutable para que el proyecto soporte multilingualidad de forma consistente: interfaz, datos (ontología) y runtime (traducción y selección de literales).

## Objetivos

- Soportar múltiples idiomas en la interfaz (ES/EN/PT/FR/DE). 
- Que la ontología local exponga etiquetas en varios idiomas (`rdfs:label` con `xml:lang`).
- Consultas SPARQL y servicios devuelvan literales en el idioma pedido con fallbacks configurables.
- Evitar inconsistencias entre middlewares y helpers de plantilla.
- Opcional: traducción en tiempo de ejecución cuando no exista literal.

## Alcance

- Archivos a modificar: `src/config/express.js`, `src/middleware/language.js`, `src/services/rdfService.js`, `src/services/dbpediaService.js`, `src/services/translationService.js`, helpers de Handlebars y la ontología en `src/public/data/ontologia_becas.owl`.
- Añadir recursos de i18n en `src/i18n/*.json` para texto UI.

## Requisitos previos

- Decidir idiomas soportados (por defecto: `es,en,pt,fr,de`).
- Si se usa traducción automática, obtener credenciales/clave y aceptar coste/privacidad.

## Plan por fases

1. Unificar detección y contexto de idioma (middleware)
   - Mantener un único middleware que:
     - lea `?lang`, `cookie('lang')`, `Accept-Language`;
     - valide contra lista soportada;
     - establezca `req.lang` y `res.locals.lang`.
   - Eliminar duplicidad (hay lógica en `src/config/express.js` y `src/middleware/language.js`).

2. Externalizar cadenas UI a archivos i18n
   - Crear `src/i18n/{es,en,pt,fr,de}.json` con las claves usadas por el helper `t`.
   - Actualizar el helper `t` para leer desde esos JSON y cachearlos en memoria.

3. Ontología: añadir etiquetas multilingües
   - Para conceptos y propiedades principales, añadir `rdfs:label` con `xml:lang` por cada idioma soportado.
   - Estrategia rápida: escribir un script (Node) que reciba un CSV/JSON con labels por idioma y actualice `ontologia_becas.owl` añadiendo literales.
   - Alternativa: mantener un recurso lingüístico externo (ej. `src/public/data/labels.csv`) y mapear con `owl:sameAs` o `rdfs:seeAlso`.

4. Mejorar selección de literales en RDF/DBpedia services
   - En `rdfService._pickLiteral` y en `dbpediaService.getScholarshipDetails` usar preferencia configurable:
     1) `req.lang` (petición)
     2) idioma por configuración (p. ej. `es`)
     3) `en`
     4) primer literal disponible
   - Pasar `lang` desde controladores a servicios cuando se ejecuten consultas.

5. SPARQL: filtrar y priorizar por idioma
   - Usar `OPTIONAL { ?s rdfs:label ?label . FILTER(LANG(?label) = "${lang}") }` y cláusulas `COALESCE` para preferir el literal correcto.
   - Implementar función utilitaria para construir consultas con preferencia de idioma.

6. Traducción on‑the‑fly (opcional)
   - Si no se encuentra literal en el idioma pedido, usar `translationService.translateText()` para traducir campos importantes (`label`, `description`, `requirements`).
   - Cachear traducciones (memoria o Redis) para limitar coste.

7. Tests y QA
   - Añadir tests unitarios para `_pickLiteral` y para la lógica de middleware de idioma.
   - Tests de integración: iniciar servidor y validar endpoints `/?lang=xx` y `/search?q=...&lang=xx` retornan `res.locals.lang` y literales correctos.

8. Documentación y despliegue
   - Actualizar README con la estrategia de multilingualidad y cómo añadir nuevos labels a la ontología.
   - En producción: configurar variables para activar/desactivar traducción automática y cache.

## Cambios de código propuestos (ejemplos)

- Unificar middleware: mantener solo `src/middleware/language.js` y adaptar `config/express.js` para no sobrescribir `req.lang`.

- Externalizar `t` helper: ejemplo de comportamiento

  - Crear `src/i18n/es.json` y `src/i18n/en.json` con la estructura { "site_title": "...", "search_placeholder": "..." }
  - Helper `t(key)` carga `i18n[req.lang][key] || i18n['es'][key] || key`.

- Mejorar `_pickLiteral` (pseudo):

  function pickLiteral(values, lang) {
    return values.find(v => v.lang === lang)
      || values.find(v => v.lang === defaultLang)
      || values.find(v => v.lang === 'en')
      || values[0];
  }

## Script sugerido para añadir labels multilang (alternativa manual)

- `scripts/add_labels_to_owl.js`:
  - Leer `labels.json` => lista de { uri, labels: { es:..., en:..., pt:... } }
  - Parsear OWL como texto e insertar nuevos `rdfs:label xml:lang="xx"` en el bloque del individuo/clase.

## Pruebas recomendadas

- Manuales:
  - Navegar a `/?lang=es`, `/?lang=en`, verificar vistas y `html lang` en `main.hbs`.
  - Buscar becas con `/search?q=...&lang=en` y comprobar `label` en inglés.
- Automáticas:
  - Unit tests para `language` middleware, `rdfService._pickLiteral`, `dbpediaService.getScholarshipDetails`.

## Checklist (prioridad mínima viable)

[] Unificar middleware y exponer `res.locals.lang`
[] Externalizar strings UI en `src/i18n/*.json`
[] Actualizar helper `t` para usar archivos i18n
[] Añadir algunos `rdfs:label xml:lang` en `ontologia_becas.owl` para conceptos clave
[] Actualizar `_pickLiteral` y consultas SPARQL para preferir `req.lang`
[] Integrar `translationService` como fallback y añadir cache
[] Añadir tests básicos
[] Documentar procesos (este archivo + README)

## Estimación y prioridades

- Fase 1 (1-2 días): Unificar middleware + externalizar `t` helper + i18n JSON + tests mínimos.
- Fase 2 (1-2 días): Actualizar selectores de literales y consultas SPARQL.
- Fase 3 (1-2 días): Script/actualización de ontología y pruebas de integración.
- Fase 4 (opcional, 1-2 días): Traducción automática y cache.

---

Archivo creado: `docs/MULTILINGUALIDAD_PLAN.md`
