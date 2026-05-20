# Guía de Integración: Búsqueda Semántica de Becas Universitarias

## Tabla de Contenidos
1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Funciones Implementadas](#funciones-implementadas)
4. [Patrones de Uso](#patrones-de-uso)
5. [Integración en Rutas](#integración-en-rutas)
6. [Ejemplos Prácticos](#ejemplos-prácticos)
7. [Preguntas Semánticas que Responde](#preguntas-semánticas-que-responde)
8. [Compatibilidad y Garantías](#compatibilidad-y-garantías)

---

## Visión General

Se han implementado **4 nuevas funciones de búsqueda semántica** en el servicio `DBpediaService` sin modificar funcionalidades existentes. Estas funciones utilizan consultas SPARQL inteligentes contra DBpedia para buscar becas universitarias de forma semántica.

### Beneficios
- ✅ **Búsqueda semántica**: Entiende significados, no solo palabras clave
- ✅ **Multilingüismo**: Soporta español, inglés y otros idiomas
- ✅ **Seguridad**: Usa OPTIONAL para evitar errores si faltan datos
- ✅ **Compatibilidad**: No rompe funcionalidad existente
- ✅ **Modularidad**: Fácil de mantener y extender
- ✅ **Rendimiento**: Optimizado con LIMIT y FILTER

---

## Arquitectura

### Flujo de Datos

```
Frontend (Handlebars)
        ↓
Controllers (search.controller.js)
        ↓
Services (dbpediaService.js) ← ← ← ← Nueva capa
        ↓
Utils (sparqlQueries.js) ← ← ← ← ← Consultas SPARQL
        ↓
DBpedia SPARQL Endpoint
        ↓
Datos RDF (Becas, Universidades, etc.)
```

### Archivos Modificados

1. **`src/services/dbpediaService.js`** - Agregadas 4 nuevas métodos
   - `searchScholarships(term, lang)`
   - `getScholarshipDetails(uri, lang)`
   - `searchScholarshipsByLevel(level, lang)`
   - `searchScholarshipsByLanguage(language, lang)`

2. **`src/utils/sparqlQueries.js`** - Agregadas 4 nuevas consultas SPARQL
   - `searchScholarships(term, lang)`
   - `getScholarshipDetails(uri, lang)`
   - `searchScholarshipsByLevel(level, lang)`
   - `searchScholarshipsByLanguage(language, lang)`

### Archivos NO Modificados
- ✅ `src/routes/` - Todas las rutas existentes
- ✅ `src/config/` - Configuración de Express
- ✅ `src/controllers/` - Métodos originales intactos
- ✅ `src/public/` - Ontología local
- ✅ `src/views/` - Plantillas Handlebars
- ✅ `package.json` - Sin nuevas dependencias

---

## Funciones Implementadas

### 1. searchScholarships(term, lang)

**Propósito**: Búsqueda general de becas por término

```javascript
/**
 * Búsqueda semántica general de becas por término
 * @param {string} term - Término a buscar (ej: "ingeniería")
 * @param {string} lang - Código de idioma (ej: "es", "en")
 * @returns {Promise<Array>} Array de becas
 */
const results = await dbpediaService.searchScholarships("ingeniería", "es");
```

**Responde**: "¿Cuáles son todas las becas que coinciden con este término?"

**Retorna**:
```javascript
[
  {
    uri: "http://dbpedia.org/resource/SomeScholarship",
    label: "Nombre de la Beca",
    description: "Descripción de la beca...",
    institution: "Universidad que la ofrece"
  },
  ...
]
```

**Características**:
- Búsqueda case-insensitive
- Filtro por idioma
- Recuperación de institución si existe
- LIMIT de 50 resultados

---

### 2. getScholarshipDetails(uri, lang)

**Propósito**: Obtener todos los detalles de una beca específica

```javascript
/**
 * Obtener detalles completos de una beca
 * @param {string} uri - URI de la beca
 * @param {string} lang - Código de idioma
 * @returns {Promise<Object>} Objeto con detalles o null
 */
const details = await dbpediaService.getScholarshipDetails(
  "http://dbpedia.org/resource/Fulbright_Program",
  "es"
);
```

**Responde**: "¿Cuál es toda la información disponible para esta beca?"

**Retorna**:
```javascript
{
  uri: "http://dbpedia.org/resource/Fulbright_Program",
  safeUri: "http%3A%2F%2Fdbpedia.org%2Fresource%2FFulbright_Program",
  name: "Fulbright Program",
  abstract: "Programa de intercambio educativo internacional...",
  institution: "U.S. Department of State",
  country: "Estados Unidos",
  level: "Postgrado",
  benefits: "Matrícula y vivienda cubierta",
  requirements: "Excelencia académica",
  thumbnail: "https://...",
  location: "Estados Unidos"
}
```

**Características**:
- Recupera 9 campos de información
- Usa OPTIONAL para evitar errores si faltan datos
- Predicados alternativos para máxima compatibilidad
- URI segura codificada (para URLs)

---

### 3. searchScholarshipsByLevel(level, lang)

**Propósito**: Filtrar becas por nivel académico

```javascript
/**
 * Buscar becas por nivel académico
 * @param {string} level - Nivel (ej: "Maestría", "Doctorado")
 * @param {string} lang - Código de idioma
 * @returns {Promise<Array>} Array de becas
 */
const masterBecas = await dbpediaService.searchScholarshipsByLevel("Maestría", "es");
```

**Responde**: "¿Cuáles son las becas para un nivel académico específico?"

**Retorna**:
```javascript
[
  {
    uri: "http://dbpedia.org/resource/Erasmus_Mundus",
    label: "Erasmus Mundus",
    description: "Programa de maestría europea...",
    level: "Maestría"
  },
  ...
]
```

**Niveles Soportados**:
- Pregrado / Undergraduate
- Maestría / Master
- Doctorado / PhD
- Especialización
- Diplomado

**Características**:
- Filtro SPARQL por nivel académico
- Búsqueda case-insensitive
- LIMIT de 100 resultados

---

### 4. searchScholarshipsByLanguage(language, lang)

**Propósito**: Encontrar becas que requieren un idioma específico

```javascript
/**
 * Buscar becas por requisito de idioma
 * @param {string} language - Idioma requerido (ej: "Inglés")
 * @param {string} lang - Código de idioma
 * @returns {Promise<Array>} Array de becas
 */
const englishBecas = await dbpediaService.searchScholarshipsByLanguage("Inglés", "es");
```

**Responde**: "¿Qué becas requieren dominio de un idioma específico?"

**Retorna**:
```javascript
[
  {
    uri: "http://dbpedia.org/resource/Cambridge_Scholarships",
    label: "Cambridge Scholarships",
    description: "Becas de la Universidad de Cambridge...",
    requiredLanguage: "Inglés"
  },
  ...
]
```

**Idiomas Soportados**:
- Inglés / English
- Alemán / German
- Francés / French
- Español / Spanish
- Portugués / Portuguese
- Italiano / Italian
- Chino / Chinese
- Japonés / Japanese
- Árabe / Arabic

**Características**:
- Filtro SPARQL por idioma requerido
- Búsqueda flexible (partial matching)
- LIMIT de 100 resultados

---

## Patrones de Uso

### Patrón 1: Búsqueda Simple

```javascript
try {
  const results = await dbpediaService.searchScholarships("medicina", "es");
  console.log(`Encontradas ${results.length} becas`);
} catch (error) {
  console.error('Error en búsqueda:', error);
}
```

### Patrón 2: Búsqueda con Detalles

```javascript
try {
  const results = await dbpediaService.searchScholarships("ingeniería", "es");
  
  for (const scholarship of results) {
    const details = await dbpediaService.getScholarshipDetails(scholarship.uri, "es");
    console.log(details);
  }
} catch (error) {
  console.error('Error:', error);
}
```

### Patrón 3: Búsqueda Avanzada

```javascript
try {
  // Opción 1: Por nivel académico
  const masterBecas = await dbpediaService.searchScholarshipsByLevel("Maestría", "es");
  
  // Opción 2: Por idioma
  const englishBecas = await dbpediaService.searchScholarshipsByLanguage("Inglés", "es");
  
  // Opción 3: General
  const allBecas = await dbpediaService.searchScholarships("becas", "es");
  
  // Combinar resultados
  const combined = [...masterBecas, ...englishBecas, ...allBecas];
} catch (error) {
  console.error('Error:', error);
}
```

### Patrón 4: Búsqueda con Multilingüismo

```javascript
async function searchInMultipleLanguages(term) {
  const languages = ['es', 'en', 'fr', 'de'];
  const results = {};
  
  for (const lang of languages) {
    try {
      results[lang] = await dbpediaService.searchScholarships(term, lang);
    } catch (error) {
      console.error(`Error para idioma ${lang}:`, error);
      results[lang] = [];
    }
  }
  
  return results;
}
```

---

## Integración en Rutas

### Opción 1: Agregar Nuevas Rutas

Crea un archivo `src/routes/scholarships.routes.js`:

```javascript
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

// Búsqueda general
router.get('/search', searchController.scholarshipSearch);

// Búsqueda por nivel
router.get('/search/level/:level', searchController.scholarshipByLevel);

// Búsqueda por idioma
router.get('/search/language/:language', searchController.scholarshipByLanguage);

// Detalles
router.get('/:uri/details', searchController.scholarshipDetails);

module.exports = router;
```

Luego, en `src/app.js`:
```javascript
const scholarshipsRoutes = require('./routes/scholarships.routes');
app.use('/api/scholarships', scholarshipsRoutes);
```

### Opción 2: Extender Rutas Existentes

Modifica `src/routes/web.route.js` o `src/routes/search.route.js`:

```javascript
// Búsqueda por nivel
router.get('/scholarships/level', async (req, res) => {
  try {
    const { level } = req.query;
    const lang = req.lang || 'es';
    
    const results = await dbpediaService.searchScholarshipsByLevel(level, lang);
    
    res.render('search-results', {
      title: `Becas de ${level}`,
      scholarships: results,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { error, lang: req.lang });
  }
});
```

---

## Ejemplos Prácticos

### Ejemplo 1: Controlador Completo

```javascript
// src/controllers/scholarships.controller.js
const dbpediaService = require('../services/dbpediaService');

exports.search = async (req, res) => {
  try {
    const { q, level, language, type } = req.query;
    const lang = req.lang || 'es';
    let results = [];

    if (level) {
      results = await dbpediaService.searchScholarshipsByLevel(level, lang);
    } else if (language) {
      results = await dbpediaService.searchScholarshipsByLanguage(language, lang);
    } else if (q) {
      results = await dbpediaService.searchScholarships(q, lang);
    }

    res.render('scholarships/search-results', {
      title: 'Búsqueda de Becas',
      results,
      isEmpty: results.length === 0,
      query: q || level || language,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error en búsqueda de becas',
      error,
      lang: req.lang
    });
  }
};

exports.details = async (req, res) => {
  try {
    const { uri } = req.params;
    const lang = req.lang || 'es';
    const decoded = decodeURIComponent(uri);

    const scholarship = await dbpediaService.getScholarshipDetails(decoded, lang);

    if (!scholarship) {
      return res.status(404).render('error', {
        message: 'Beca no encontrada',
        lang
      });
    }

    res.render('scholarships/detail', {
      title: scholarship.name,
      scholarship,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error al cargar detalles',
      error,
      lang: req.lang
    });
  }
};
```

### Ejemplo 2: Vista Handlebars

```handlebars
<!-- src/views/scholarships/search-results.hbs -->
<div class="container">
  <h1>{{title}}</h1>
  
  {{#if isEmpty}}
    <div class="alert alert-info">
      No se encontraron resultados para "{{query}}"
    </div>
  {{else}}
    <div class="results">
      {{#each results}}
        <div class="scholarship-card">
          <h3>
            <a href="/scholarships/{{this.uri}}/details">
              {{this.label}}
            </a>
          </h3>
          <p class="institution">{{this.institution}}</p>
          <p class="level">Nivel: {{this.level}}</p>
          <p class="language">Idioma: {{this.requiredLanguage}}</p>
          <p class="description">{{this.description}}</p>
          <a href="/scholarships/{{this.uri}}/details" class="btn btn-primary">
            Ver detalles
          </a>
        </div>
      {{/each}}
    </div>
  {{/if}}
</div>
```

### Ejemplo 3: API JSON

```javascript
// Para retornar JSON en lugar de HTML
router.get('/api/scholarships/search', async (req, res) => {
  try {
    const { q, level, language } = req.query;
    const lang = req.query.lang || 'es';
    let results = [];

    if (level) {
      results = await dbpediaService.searchScholarshipsByLevel(level, lang);
    } else if (language) {
      results = await dbpediaService.searchScholarshipsByLanguage(language, lang);
    } else if (q) {
      results = await dbpediaService.searchScholarships(q, lang);
    }

    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## Preguntas Semánticas que Responde

### Búsqueda General
- "¿Dónde puedo encontrar becas de ingeniería?"
- "¿Qué becas están disponibles en medicina?"
- "Busca becas para informática"

### Búsqueda por Nivel
- "¿Cuáles son las becas de doctorado?"
- "Necesito una beca de maestría en el extranjero"
- "¿Hay becas de pregrado disponibles?"

### Búsqueda por Idioma
- "¿Qué becas requieren inglés?"
- "Necesito becas que requieran francés"
- "¿Hay becas para hablantes de alemán?"

### Búsqueda Combinada
- "¿Cuáles son las becas de maestría que requieren inglés?"
- "Becas de doctorado en ingeniería para hablantes de español"
- "¿Hay becas de postgrado en el exterior que no requieran idioma?"

---

## Compatibilidad y Garantías

### ✅ Garantías de Compatibilidad

1. **Rutas Existentes**: No se han modificado ni eliminado
2. **Funciones Existentes**: `searchDiseases()` y `getDiseaseDetails()` sin cambios
3. **Configuración**: Express, Handlebars, etc. intactos
4. **Multilingüismo**: Sistema de idiomas preservado
5. **DBpedia**: Totalmente compatible
6. **Dependencias**: Ninguna nueva requerida

### Código Defensivo

Cada función incluye:
- ✅ Validación de parámetros
- ✅ Try/catch para manejo de errores
- ✅ Retorno de arrays vacíos en caso de error
- ✅ OPTIONAL en SPARQL para campos faltantes
- ✅ Filtros por idioma seguros

### Ejemplo de Validación

```javascript
if (!term || typeof term !== "string") {
  throw new Error("Invalid search term");
}

try {
  const response = await axios.get(endpoint, { params: { query } });
  // Procesar respuesta
} catch (error) {
  this._handleError(error);
  return []; // Retornar array vacío en caso de error
}
```

---

## Próximos Pasos

### Integración Recomendada
1. Importar `dbpediaService` en controladores
2. Crear nuevas rutas para búsquedas semánticas
3. Actualizar plantillas Handlebars
4. Agregar controles de búsqueda avanzada

### Optimizaciones Futuras
- Implementar caché de resultados
- Agregar paginación
- Crear filtros combinados
- Añadir búsqueda por rango de precios
- Integrar machine learning para recomendaciones

### Testing
```bash
# Probar funciones en consola
npm test
# O incluir en suite de tests existente
npm run test:integration
```

---

## Soporte y Debugging

### Logs Útiles
```javascript
console.log('Query:', query);
console.log('Endpoint:', endpoint);
console.log('Response:', response.data);
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Invalid response structure" | Endpoint cambió formato | Verificar DBpedia API |
| "Empty results" | Término no existe | Usar términos más generales |
| "Timeout" | Consulta muy compleja | Reducir LIMIT |
| "Invalid URI" | URI malformada | Validar encoding |

---

## Conclusión

Se han implementado **4 nuevas funciones de búsqueda semántica** que:
- ✅ Mantienen la estructura MVC actual
- ✅ No rompen funcionalidades existentes
- ✅ Agregan capacidades semánticas potentes
- ✅ Son fáciles de usar y mantener
- ✅ Están completamente documentadas

¡Listo para integrar en tu aplicación! 🚀
