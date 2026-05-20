# Ejemplos de Consultas SPARQL para Búsqueda Semántica de Becas

Este documento contiene ejemplos de consultas SPARQL que puedes probar directamente en el endpoint de DBpedia para validar la implementación de búsqueda semántica de becas universitarias.

---

## 1. Búsqueda General de Becas por Término

### Consulta SPARQL

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dbo: <http://dbpedia.org/ontology/>

SELECT DISTINCT ?s ?label ?abstract ?institution WHERE {
  # Búsqueda por etiqueta que contenga el término
  ?s rdfs:label ?label .
  FILTER(CONTAINS(LCASE(STR(?label)), "scholarship"))
  FILTER(LANG(?label) = "en" || LANG(?label) = "es")

  # Resumen o descripción (con preferencia por idioma)
  OPTIONAL { 
    ?s dbo:abstract ?abstract . 
    FILTER(LANG(?abstract) = "en")
  }

  # Institución que ofrece la beca
  OPTIONAL { ?s dbo:university ?institution }
  OPTIONAL { ?s dbo:institution ?institution }
}
ORDER BY ?label
LIMIT 50
```

### Pregunta Semántica Respondida
**"¿Cuáles son todas las becas que coinciden con este término de búsqueda?"**

### Explicación
- `rdfs:label ?label`: Obtiene las etiquetas de las entidades
- `FILTER(CONTAINS(...))`: Busca coincidencias parciales del término (case-insensitive)
- `FILTER(LANG(...))`: Filtra por idioma especificado
- `OPTIONAL`: Recupera institución si existe (no causa error si no existe)
- `LIMIT 50`: Limita resultados para mejor rendimiento

### Ejemplo de Uso en Código
```javascript
const results = await dbpediaService.searchScholarships("engineering", "en");
// Retorna becas relacionadas con ingeniería en inglés
```

---

## 2. Detalles Completos de una Beca Específica

### Consulta SPARQL

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT DISTINCT 
  ?name ?abstract ?institution ?country ?level 
  ?benefits ?requirements ?thumbnail ?location
WHERE {
  BIND(<http://dbpedia.org/resource/Rhodes_Scholarship> AS ?s)

  # Nombre de la beca
  OPTIONAL { ?s rdfs:label ?name . FILTER(LANG(?name) = "en") }

  # Descripción / resumen
  OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "en") }

  # Institución o universidad
  OPTIONAL { ?s dbo:university ?institution }
  OPTIONAL { ?s dbo:institution ?institution }
  OPTIONAL { ?s dbp:institution ?institution }

  # País de la institución/beca
  OPTIONAL { ?s dbo:country ?country }
  OPTIONAL { ?s dbp:country ?country }

  # Nivel académico
  OPTIONAL { ?s dbo:educationLevel ?level }
  OPTIONAL { ?s dbp:educationLevel ?level }

  # Beneficios (monto, cobertura, etc.)
  OPTIONAL { ?s dbo:fundingAmount ?benefits }
  OPTIONAL { ?s dbp:coverage ?benefits }

  # Requisitos (eligibilidad)
  OPTIONAL { ?s dbo:requirement ?requirements }
  OPTIONAL { ?s dbp:requirements ?requirements }

  # Imagen/thumbnail
  OPTIONAL { ?s dbo:thumbnail ?thumbnail }
  OPTIONAL { ?s foaf:depiction ?thumbnail }

  # Ubicación
  OPTIONAL { ?s dbo:location ?location }
}
```

### Pregunta Semántica Respondida
**"¿Cuál es toda la información disponible para esta beca en particular?"**

### Explicación
- `BIND(<URI> AS ?s)`: Vincula la URI específica a la variable
- Múltiples `OPTIONAL`: Recupera cada campo sin causar errores si falta alguno
- Predicados alternativos: `dbo:university` OR `dbo:institution` OR `dbp:institution`
- `FILTER(LANG(...))`: Asegura obtener datos en idioma correcto

### Objeto JSON Retornado
```json
{
  "uri": "http://dbpedia.org/resource/Rhodes_Scholarship",
  "safeUri": "http%3A%2F%2Fdbpedia.org%2Fresource%2FRhodes_Scholarship",
  "name": "Rhodes Scholarship",
  "abstract": "The Rhodes Scholarship is an international...",
  "institution": "University of Oxford",
  "country": "United Kingdom",
  "level": "Postgrado",
  "benefits": "Cobertura completa de matrícula y alojamiento",
  "requirements": "Excelencia académica y liderazgo",
  "thumbnail": "https://upload.wikimedia.org/...",
  "location": "Oxford"
}
```

### Ejemplo de Uso en Código
```javascript
const details = await dbpediaService.getScholarshipDetails(
  "http://dbpedia.org/resource/Rhodes_Scholarship", 
  "en"
);
// Retorna objeto con todos los detalles de la beca Rhodes
```

---

## 3. Búsqueda de Becas por Nivel Académico

### Consulta SPARQL

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>

SELECT DISTINCT ?s ?label ?abstract ?level WHERE {
  # Debe tener una propiedad de nivel académico
  ?s dbo:educationLevel ?levelValue .
  FILTER(CONTAINS(LCASE(STR(?levelValue)), "postgrado"))

  # Recuperar etiqueta y descripción
  OPTIONAL { ?s rdfs:label ?label . FILTER(LANG(?label) = "es" || LANG(?label) = "en") }
  OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "es" || LANG(?abstract) = "en") }
  
  BIND(?levelValue AS ?level)
}
ORDER BY ?label
LIMIT 100
```

### Pregunta Semántica Respondida
**"¿Cuáles son las becas disponibles para un nivel académico específico?"**

### Explicación
- `?s dbo:educationLevel ?levelValue`: Solo recupera entidades con nivel académico definido
- `FILTER(CONTAINS(...))`: Búsqueda parcial del nivel (ej: "postgrado" coincide con "Postgrado")
- `BIND`: Asigna el nivel a una variable para retorno

### Niveles Académicos Soportados
- **Pregrado** / **Undergraduate** - Educación de primer ciclo
- **Maestría** / **Master** - Postgrado de dos años
- **Doctorado** / **PhD** - Postgrado de investigación
- **Especialización** - Postgrado especializado
- **Diplomado** - Formación corta

### Ejemplo de Uso en Código
```javascript
// Buscar becas de maestría en español
const masterScholarships = await dbpediaService.searchScholarshipsByLevel("Maestría", "es");

// Buscar becas de PhD en inglés
const phdScholarships = await dbpediaService.searchScholarshipsByLevel("PhD", "en");
```

### Ejemplo de Resultado
```json
[
  {
    "uri": "http://dbpedia.org/resource/Fulbright_Program",
    "label": "Fulbright Program",
    "description": "International educational exchange program...",
    "level": "Postgrado"
  },
  {
    "uri": "http://dbpedia.org/resource/Erasmus_Mundus",
    "label": "Erasmus Mundus",
    "description": "Joint Masters programme...",
    "level": "Postgrado"
  }
]
```

---

## 4. Búsqueda de Becas por Requisito de Idioma

### Consulta SPARQL

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>

SELECT DISTINCT ?s ?label ?abstract ?requiredLanguage WHERE {
  # Debe tener un requisito de idioma
  ?s dbo:languageRequirement ?languageValue .
  FILTER(CONTAINS(LCASE(STR(?languageValue)), "english"))

  # Recuperar etiqueta y descripción
  OPTIONAL { ?s rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "en") }
  
  BIND(?languageValue AS ?requiredLanguage)
}
ORDER BY ?label
LIMIT 100
```

### Pregunta Semántica Respondida
**"¿Cuáles son las becas que requieren dominio de un idioma específico?"**

### Explicación
- `?s dbo:languageRequirement ?languageValue`: Filtra por requisito de idioma
- `FILTER(CONTAINS(...))`: Búsqueda flexible del idioma
- Retorna tanto la beca como el idioma requerido

### Idiomas Soportados
- **Inglés** / **English**
- **Alemán** / **German**
- **Francés** / **French**
- **Español** / **Spanish**
- **Portugués** / **Portuguese**
- **Italiano** / **Italian**
- **Chino** / **Chinese**
- **Japonés** / **Japanese**
- **Árabe** / **Arabic**

### Ejemplo de Uso en Código
```javascript
// Buscar becas que requieren inglés
const englishBecas = await dbpediaService.searchScholarshipsByLanguage("English", "es");

// Buscar becas que requieren alemán
const germanBecas = await dbpediaService.searchScholarshipsByLanguage("German", "es");

// Buscar becas que requieren inglés (en inglés)
const englishBecasEn = await dbpediaService.searchScholarshipsByLanguage("English", "en");
```

### Ejemplo de Resultado
```json
[
  {
    "uri": "http://dbpedia.org/resource/Cambridge_Scholarships",
    "label": "Cambridge Scholarships",
    "description": "UK university scholarship programme...",
    "requiredLanguage": "English"
  },
  {
    "uri": "http://dbpedia.org/resource/Oxford_Scholarships",
    "label": "Oxford Scholarships",
    "description": "Scholarships offered by University of Oxford...",
    "requiredLanguage": "English"
  }
]
```

---

## Testing en DBpedia SPARQL Endpoint

### Acceso al Endpoint
1. Ir a: **https://query.wikidata.org/sparql** o **https://dbpedia.org/sparql**
2. Copiar una de las consultas anteriores
3. Hacer clic en "Execute"

### Tips para Debugging
- Usa `LIMIT` pequeños (10-20) primero para pruebas rápidas
- Verifica que los predicados existan: usa `?s ?p ?o` para explorar
- Si no hay resultados, intenta con términos más generales
- Comprueba códigos de idioma: "es" para español, "en" para inglés

---

## Esquema de Integración en Controladores

### Ejemplo: Controlador de Búsqueda Mejorado

```javascript
const dbpediaService = require('../services/dbpediaService');

exports.scholarshipSearch = async (req, res) => {
  try {
    const { q, level, language } = req.query;
    const lang = req.lang || 'es';
    
    let results = [];

    // Búsqueda por nivel académico
    if (level) {
      results = await dbpediaService.searchScholarshipsByLevel(level, lang);
    }
    // Búsqueda por idioma requerido
    else if (language) {
      results = await dbpediaService.searchScholarshipsByLanguage(language, lang);
    }
    // Búsqueda general por término
    else if (q) {
      results = await dbpediaService.searchScholarships(q, lang);
    }

    res.render('search-results', {
      title: `Resultados de Becas`,
      query: q || `Nivel: ${level}` || `Idioma: ${language}`,
      scholarships: results,
      isEmpty: results.length === 0,
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

exports.scholarshipDetail = async (req, res) => {
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

    res.render('scholarship-detail', {
      title: scholarship.name,
      scholarship,
      lang
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error al cargar detalles de la beca',
      error,
      lang: req.lang
    });
  }
};
```

---

## Patrones de Consultas SPARQL Comunes

### Filtro por Idioma
```sparql
FILTER(LANG(?label) = "es" || LANG(?label) = "en")
```

### Búsqueda Parcial Case-Insensitive
```sparql
FILTER(CONTAINS(LCASE(STR(?label)), "término"))
```

### Datos Opcionales
```sparql
OPTIONAL { ?s dbo:property ?value }
```

### Alternativas de Propiedades
```sparql
?s dbo:university ?institution .
OPTIONAL { ?s dbo:institution ?institution2 }
OPTIONAL { ?s dbp:institution ?institution3 }
BIND(COALESCE(?institution, ?institution2, ?institution3) AS ?finalInstitution)
```

### Agregación de Resultados
```sparql
SELECT DISTINCT ?s ?label
WHERE { ... }
ORDER BY ?label
LIMIT 100
```

---

## Mantenimiento y Optimización

### Índices Recomendados
- Crear índices en `rdfs:label` para búsquedas rápidas
- Pre-procesar resultados comunes para caché

### Puntos de Optimización
1. **Caché de resultados**: Guardar resultados frecuentes
2. **Paginación**: Implementar OFFSET para grandes conjuntos
3. **Validación**: Validar URIs antes de consultas
4. **Timeouts**: Establecer timeouts para consultas largas

### Monitoreo
```javascript
const startTime = Date.now();
const results = await dbpediaService.searchScholarships(term, lang);
console.log(`Query took ${Date.now() - startTime}ms`);
```

---

## Conclusiones

Estas consultas SPARQL permiten:
✓ **Búsqueda semántica inteligente** basada en significado
✓ **Multilingüismo** con filtros por idioma
✓ **Seguridad** usando OPTIONAL para evitar errores
✓ **Flexibilidad** con predicados alternativos
✓ **Rendimiento** limitando resultados y usando FILTER

Las funciones implementadas en `dbpediaService.js` encapsulan estas consultas de forma reutilizable y segura.
