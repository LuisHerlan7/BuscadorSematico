# Quick Start: Búsqueda Semántica de Becas

Guía rápida para comenzar a usar las nuevas funciones de búsqueda semántica.

---

## Instalación (5 minutos)

**✅ Buena noticia**: No hay que instalar nada nuevo. Las funciones ya están implementadas.

Solo asegúrate de que tienes:
- Node.js instalado
- `axios` en package.json (ya está)
- DBpedia endpoint accesible (por defecto está configurado)

---

## Uso Básico

### 1. Búsqueda General de Becas

**Archivo**: `src/controllers/search.controller.js`

```javascript
const dbpediaService = require('../services/dbpediaService');

// En tu función de controlador:
async function buscarBecas(req, res) {
  const termino = req.query.q; // "ingeniería", "medicina", etc.
  const idioma = req.lang || 'es';
  
  const becas = await dbpediaService.searchScholarships(termino, idioma);
  
  res.render('resultados', { becas });
}
```

**Prueba desde terminal**:
```bash
curl "http://localhost:3000/api/scholarships/search?q=ingenieria&lang=es"
```

---

### 2. Ver Detalles de una Beca

```javascript
const dbpediaService = require('../services/dbpediaService');

async function verDetalles(req, res) {
  const uri = decodeURIComponent(req.params.uri);
  const idioma = req.lang || 'es';
  
  const detalles = await dbpediaService.getScholarshipDetails(uri, idioma);
  
  res.render('detalles-beca', { detalles });
}
```

---

### 3. Buscar Becas por Nivel Académico

```javascript
async function buscarPorNivel(req, res) {
  const nivel = req.query.nivel; // "Maestría", "Doctorado", etc.
  const idioma = req.lang || 'es';
  
  const becas = await dbpediaService.searchScholarshipsByLevel(nivel, idioma);
  
  res.render('resultados-nivel', { becas, nivel });
}
```

**Ejemplo de uso**:
```javascript
// Becas de maestría
const masterBecas = await dbpediaService.searchScholarshipsByLevel("Maestría", "es");

// Becas de doctorado
const phdBecas = await dbpediaService.searchScholarshipsByLevel("Doctorado", "es");

// Becas de pregrado
const undergraduateBecas = await dbpediaService.searchScholarshipsByLevel("Pregrado", "es");
```

---

### 4. Buscar Becas por Idioma Requerido

```javascript
async function buscarPorIdioma(req, res) {
  const idioma = req.query.idioma; // "Inglés", "Alemán", etc.
  const lang = req.lang || 'es';
  
  const becas = await dbpediaService.searchScholarshipsByLanguage(idioma, lang);
  
  res.render('resultados-idioma', { becas, idioma });
}
```

**Ejemplo de uso**:
```javascript
// Becas que requieren inglés
const englishBecas = await dbpediaService.searchScholarshipsByLanguage("Inglés", "es");

// Becas que requieren francés
const frenchBecas = await dbpediaService.searchScholarshipsByLanguage("Francés", "es");

// Becas que requieren alemán
const germanBecas = await dbpediaService.searchScholarshipsByLanguage("Alemán", "es");
```

---

## Integración Rápida en Rutas

### Agregar estas rutas a `src/routes/web.route.js`:

```javascript
// ============================================
// NUEVAS RUTAS DE BÚSQUEDA SEMÁNTICA
// ============================================

const dbpediaService = require('../services/dbpediaService');

// Búsqueda de becas por término
router.get('/scholarships/search', async (req, res) => {
  try {
    const { q } = req.query;
    const lang = req.lang || 'es';
    
    if (!q) {
      return res.render('scholarships/search', { lang });
    }
    
    const results = await dbpediaService.searchScholarships(q, lang);
    
    res.render('scholarships/results', {
      title: `Becas: ${q}`,
      results,
      query: q,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error en búsqueda',
      error,
      lang: req.lang
    });
  }
});

// Búsqueda por nivel académico
router.get('/scholarships/by-level/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const lang = req.lang || 'es';
    
    const results = await dbpediaService.searchScholarshipsByLevel(level, lang);
    
    res.render('scholarships/results', {
      title: `Becas de ${level}`,
      results,
      query: level,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error',
      error,
      lang: req.lang
    });
  }
});

// Búsqueda por idioma requerido
router.get('/scholarships/by-language/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const lang = req.lang || 'es';
    
    const results = await dbpediaService.searchScholarshipsByLanguage(language, lang);
    
    res.render('scholarships/results', {
      title: `Becas que requieren ${language}`,
      results,
      query: language,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error',
      error,
      lang: req.lang
    });
  }
});

// Detalles de beca específica
router.get('/scholarships/:uri/details', async (req, res) => {
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
});
```

---

## Ejemplos de Plantillas Handlebars

### `src/views/scholarships/results.hbs`

```handlebars
<div class="container">
  <h1>{{title}}</h1>
  
  {{#if results}}
    <div class="scholarships-grid">
      {{#each results}}
        <div class="scholarship-card">
          <h3><a href="/scholarships/{{this.uri}}/details">{{this.label}}</a></h3>
          {{#if this.institution}}
            <p class="institution"><strong>Institución:</strong> {{this.institution}}</p>
          {{/if}}
          {{#if this.level}}
            <p class="level"><strong>Nivel:</strong> {{this.level}}</p>
          {{/if}}
          {{#if this.requiredLanguage}}
            <p class="language"><strong>Idioma:</strong> {{this.requiredLanguage}}</p>
          {{/if}}
          <p class="description">{{truncate this.description 150}}</p>
          <a href="/scholarships/{{this.uri}}/details" class="btn btn-primary">
            Ver detalles completos
          </a>
        </div>
      {{/each}}
    </div>
  {{else}}
    <div class="alert alert-warning">
      No se encontraron becas para: "{{query}}"
    </div>
  {{/if}}
</div>

<style>
  .scholarships-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    margin: 20px 0;
  }
  
  .scholarship-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .scholarship-card h3 {
    margin-top: 0;
  }
  
  .scholarship-card p {
    margin: 8px 0;
  }
</style>
```

### `src/views/scholarships/detail.hbs`

```handlebars
<div class="container">
  <div class="scholarship-detail">
    <h1>{{scholarship.name}}</h1>
    
    {{#if scholarship.thumbnail}}
      <img src="{{scholarship.thumbnail}}" alt="{{scholarship.name}}" class="scholarship-image">
    {{/if}}
    
    <div class="detail-grid">
      {{#if scholarship.abstract}}
        <section>
          <h3>Descripción</h3>
          <p>{{scholarship.abstract}}</p>
        </section>
      {{/if}}
      
      {{#if scholarship.institution}}
        <section>
          <h4>Institución</h4>
          <p>{{scholarship.institution}}</p>
        </section>
      {{/if}}
      
      {{#if scholarship.country}}
        <section>
          <h4>País</h4>
          <p>{{scholarship.country}}</p>
        </section>
      {{/if}}
      
      {{#if scholarship.level}}
        <section>
          <h4>Nivel Académico</h4>
          <p>{{scholarship.level}}</p>
        </section>
      {{/if}}
      
      {{#if scholarship.benefits}}
        <section>
          <h4>Beneficios</h4>
          <p>{{scholarship.benefits}}</p>
        </section>
      {{/if}}
      
      {{#if scholarship.requirements}}
        <section>
          <h4>Requisitos</h4>
          <p>{{scholarship.requirements}}</p>
        </section>
      {{/if}}
    </div>
    
    <div class="actions">
      <a href="/scholarships/search" class="btn btn-secondary">Volver a búsqueda</a>
    </div>
  </div>
</div>

<style>
  .scholarship-detail {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .scholarship-image {
    max-width: 300px;
    margin: 20px 0;
    border-radius: 8px;
  }
  
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 30px 0;
  }
  
  .detail-grid section {
    border-left: 4px solid #007bff;
    padding-left: 15px;
  }
</style>
```

---

## API REST (Opcional)

Si prefieres consumir como API JSON:

### Crear `src/routes/api.routes.js`:

```javascript
const express = require('express');
const router = express.Router();
const dbpediaService = require('../services/dbpediaService');

// GET /api/scholarships/search?q=ingenieria&lang=es
router.get('/scholarships/search', async (req, res) => {
  try {
    const { q } = req.query;
    const lang = req.query.lang || 'es';
    
    if (!q) {
      return res.status(400).json({
        error: 'Parameter "q" is required'
      });
    }
    
    const results = await dbpediaService.searchScholarships(q, lang);
    
    res.json({
      success: true,
      query: q,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/scholarships/level/Maestria?lang=es
router.get('/scholarships/level/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const lang = req.query.lang || 'es';
    
    const results = await dbpediaService.searchScholarshipsByLevel(level, lang);
    
    res.json({
      success: true,
      level,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/scholarships/language/Ingles?lang=es
router.get('/scholarships/language/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const lang = req.query.lang || 'es';
    
    const results = await dbpediaService.searchScholarshipsByLanguage(language, lang);
    
    res.json({
      success: true,
      language,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

Luego en `src/app.js`:
```javascript
const apiRoutes = require('./routes/api.routes');
app.use('/api', apiRoutes);
```

---

## Pruebas en Terminal

### Prueba 1: Búsqueda General

```bash
curl -X GET "http://localhost:3000/api/scholarships/search?q=ingenieria&lang=es" \
  -H "Content-Type: application/json"
```

**Respuesta esperada**:
```json
{
  "success": true,
  "query": "ingenieria",
  "count": 25,
  "results": [
    {
      "uri": "http://dbpedia.org/resource/...",
      "label": "Beca de Ingeniería",
      "description": "...",
      "institution": "..."
    }
  ]
}
```

### Prueba 2: Búsqueda por Nivel

```bash
curl -X GET "http://localhost:3000/api/scholarships/level/Maestria?lang=es" \
  -H "Content-Type: application/json"
```

### Prueba 3: Búsqueda por Idioma

```bash
curl -X GET "http://localhost:3000/api/scholarships/language/Ingles?lang=es" \
  -H "Content-Type: application/json"
```

---

## Pruebas en JavaScript (Node.js)

Crea un archivo `test-scholarships.js`:

```javascript
const dbpediaService = require('./src/services/dbpediaService');

async function testAll() {
  console.log('🔍 Iniciando pruebas de búsqueda semántica...\n');
  
  try {
    // Test 1: Búsqueda general
    console.log('1️⃣  Búsqueda general "ingeniería"');
    const general = await dbpediaService.searchScholarships('ingeniería', 'es');
    console.log(`   ✅ ${general.length} resultados\n`);
    
    // Test 2: Búsqueda por nivel
    console.log('2️⃣  Búsqueda por nivel "Maestría"');
    const byLevel = await dbpediaService.searchScholarshipsByLevel('Maestría', 'es');
    console.log(`   ✅ ${byLevel.length} resultados\n`);
    
    // Test 3: Búsqueda por idioma
    console.log('3️⃣  Búsqueda por idioma "Inglés"');
    const byLanguage = await dbpediaService.searchScholarshipsByLanguage('Inglés', 'es');
    console.log(`   ✅ ${byLanguage.length} resultados\n`);
    
    // Test 4: Detalles
    if (general.length > 0) {
      console.log('4️⃣  Obteniendo detalles del primer resultado');
      const details = await dbpediaService.getScholarshipDetails(general[0].uri, 'es');
      console.log('   ✅ Detalles obtenidos:');
      console.log(`      - Nombre: ${details.name}`);
      console.log(`      - País: ${details.country}`);
      console.log(`      - Nivel: ${details.level}\n`);
    }
    
    console.log('✅ Todas las pruebas completadas correctamente!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAll();
```

Ejecuta con:
```bash
node test-scholarships.js
```

---

## Troubleshooting

### ❌ "Cannot find module 'dbpediaService'"

**Solución**: Verifica la ruta de importación:
```javascript
// ✅ Correcto
const dbpediaService = require('../services/dbpediaService');

// ❌ Incorrecto
const dbpediaService = require('./dbpediaService');
```

### ❌ "No results returned"

**Solución**: 
- Verifica que DBpedia esté accesible
- Prueba con términos más comunes
- Comprueba el código de idioma ('es', 'en', etc.)

### ❌ "Timeout error"

**Solución**:
- Reduce el número de resultados (LIMIT)
- Usa un término más específico
- Verifica la conexión a internet

---

## Próximos Pasos

1. ✅ Copiar las rutas de ejemplo
2. ✅ Crear las plantillas Handlebars
3. ✅ Probar con curl o Postman
4. ✅ Integrar en tu aplicación
5. ✅ Personalizar estilos CSS

---

## ¡Listo! 🎉

Ya puedes usar las nuevas funciones de búsqueda semántica. Consulta `SEMANTIC_SEARCH_GUIDE.md` para más detalles.
