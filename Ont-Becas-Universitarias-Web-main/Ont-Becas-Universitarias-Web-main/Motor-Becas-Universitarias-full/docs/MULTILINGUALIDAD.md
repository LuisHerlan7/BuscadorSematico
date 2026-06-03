# Cambios funcionales - rama `multilingualidad`

Este documento resume los cambios funcionales introducidos en la rama `multilingualidad`. No incluye cambios visuales (CSS, estilos, posicionamiento). Está pensado para desarrolladores que integren o revisen la internacionalización (i18n) y el manejo de idioma en la aplicación.

## Resumen rápido

- Se externalizó la traducción de mensajes a archivos JSON por idioma bajo `src/i18n/`.
- Se añadió soporte de internacionalización en servidor y vistas (helpers y middleware).
- Se agregó preservación/gestión de parámetros de búsqueda al cambiar idioma (preservar `q`).
- Se registraron helpers globales para Handlebars (`t`, `buildLangUrl`, etc.) para evitar errores "Missing helper".
- Se hizo que la lógica de selección de idioma use: query `?lang=`, cookie `lang`, cabecera `Accept-Language`, y finalmente un valor por defecto.
- Se hicieron cambios en servicios y controladores para propagar `lang` en consultas RDF/DBpedia.
- Se añadieron tests unitarios e integración para cubrir i18n y comportamiento de búsqueda.
- Se añadieron scripts de apoyo (comprobación de claves i18n, traducción de etiquetas OWL) en `scripts/`.

## Archivos/áreas modificadas (funcional)

- `src/i18n/` — nuevos archivos JSON por idioma con claves de traducción.
- `src/config/express.js` —
  - Registro de helpers para Handlebars.
  - `buildLangUrl` helper que genera URLs de cambio de idioma (ahora asegura orden q -> otros -> lang).
  - Helpers registrados tanto en la instancia `exphbs` como en el runtime global de `handlebars`.
- `src/middleware/language.js` —
  - Middleware central que: detecta idioma, setea `req.lang` y `res.locals.lang`, y expone `res.locals.currentQuery` y `res.locals.currentUrl` para las vistas.
  - Orden de detección: query → cookie → Accept-Language → default.
- `src/controllers/search.controller.js` —
  - Propaga `lang` a los servicios y registra logs claros de búsquedas por idioma.
- `src/services/rdfService.js` y `src/services/dbpediaService.js` —
  - Métodos que aceptan `lang` para preferir literales en el idioma solicitado y realizar fallbacks.
  - Mejora de la función `_pickLiteral` para normalizar y priorizar por idioma.
- `src/config/*` y `src/app.js` — integración del middleware `language` y orden correcto de middlewares.
- `src/views/*` (parciales) — solo cambios para usar los helpers (`t`, `buildLangUrl`) y exponer `lang`/`q` a las plantillas (no documentados aquí por ser visuales).
- `scripts/` — utilidades:
  - `check_i18n_keys.js` (o similar): verifica que todas las claves estén presentes en los idiomas.
  - `add_multilingual_labels.js`: ayuda a inyectar traducciones en la ontología (OWL) en desarrollo.

## Tests añadidos

- Unitarios:
  - `__tests__/i18n.test.js` — carga/lookup de traducciones y fallback.
  - `__tests__/rdf_pickLiteral.test.js` — preferencia por idioma en `_pickLiteral`.
  - `__tests__/language.test.js` — pruebas del middleware de idioma (query, cookie, header, default).
- Integración:
  - `__tests__/integration.i18n.test.js` — rutas públicas verificando que `/?lang=xx` devuelve contenido traducido.
  - `__tests__/integration.search.detail.test.js` — `/search` y detalle: preservación de `q` al cambiar idioma, y uso de `dbpediaService`/`rdfService` según URI.

Todos los tests existentes en la rama pasan localmente (ejecutados con `npx jest`).

## Comportamientos a tener en cuenta / notas de integración

- Cuando el usuario cambia de idioma desde una página con búsqueda, la aplicación preserva el parámetro `q` en los enlaces de cambio de idioma para mantener la búsqueda. El helper `buildLangUrl` y/o la plantilla construyen la URL; recientemente se ajustó la serialización para que `q` aparezca antes que `lang` (ej.: `/search?q=comedor&lang=es`).

- El logo / enlace a inicio fue ajustado para navegar a `/` (inicio limpio) cuando se desea descartar la consulta actual.

- Helpers se registran globalmente para evitar errores en contextos donde Handlebars se instancia fuera de `express-handlebars`.

- Los servicios RDF y DBpedia ahora reciben el parámetro `lang` desde el controlador y prefieren literales en ese idioma, haciendo fallback cuando sea necesario. Esto puede afectar resultados si la ontología o DBpedia no tienen traducciones completas.

## Cómo probar localmente

1. Instala dependencias (si no están):

```bash
npm install
```

2. Ejecuta tests:

```bash
npx jest
```

3. Arranca la app y prueba manualmente:

```bash
npm start
# abrir http://localhost:3000
```

- Prueba: ir a `http://localhost:3000/search?q=comedor&lang=es`, cambiar idioma desde el selector y verificar que la búsqueda se preserve y que las rutas devuelvan contenido en el idioma seleccionado.
