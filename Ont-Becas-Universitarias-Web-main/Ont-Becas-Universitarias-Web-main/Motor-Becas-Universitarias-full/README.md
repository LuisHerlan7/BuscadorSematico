# Buscador de Becas Universitarias

## 📌 Descripción del Proyecto

Proyecto para buscar y explorar convocatorias de becas universitarias usando consultas a **DBpedia**, una ontología local y un respaldo offline en RDF/XML dentro del archivo `.owl`. Permite:

- 🔍 Buscar becas por nombre, institución, área o nivel académico
- 🌐 Mostrar resultados en múltiples idiomas (es, en, pt, fr, de)

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js + Express
- **Frontend**: Handlebars (templates) + Bootstrap
- **Consultas SPARQL**: Ontología local (Comunica) y remoto (DBpedia)
- **Fallback offline**: individuos RDF/XML en `src/public/data/ontologia_becas.owl`
- **Axios**: Para peticiones a endpoints externos

## 🚀 Cómo Ejecutar el Proyecto

### Requisitos Previos
- Node.js (v16 o superior)
- npm o pnpm

### Pasos de Instalación

1. Clona el repositorio y entra en la carpeta del proyecto:
   ```bash
   git clone <tu-repo-url>
   cd Motor-Becas-Universitarias-full
   ```

2. Instala dependencias:
   ```bash
   npm install
   # o pnpm install
   ```

3. Ejecuta el servidor:
   ```bash
   npm start
   # o npx nodemon src/app.js
   ```

4. Abre en el navegador:
   ```
   http://localhost:3000
   ```

## 🌍 Uso del Sistema

### Interfaz de Búsqueda
1. Escribe el nombre de la beca, institución o un término relacionado en el campo de búsqueda.
2. Selecciona el idioma desde el selector (opcional).
3. Pulsa "Buscar" para obtener resultados desde DBpedia. Si DBpedia no responde o no devuelve coincidencias, el sistema usa el respaldo offline.

### Resultados
- Cada resultado muestra: título, descripción/abstract, posible enlace a DBpedia y fuente (`dbpedia`, `dbpedia-offline` o `local`).

### DBpedia Offline
- El respaldo offline se encuentra como población RDF/XML dentro de `src/public/data/ontologia_becas.owl`.
- La población offline se marca con `esRespaldoDBpedia=true` y se guarda separada por tipo de beca (`BecaDeExcelencia`, `BecaDeMovilidad`, `BecaCompleta`, etc.), nivel, área, institución, requisitos y beneficios.
- No se usa JSON ni TTL para resolver el fallback cuando DBpedia no responde.

## Notas

- La ontología local `.owl` se encuentra en `src/public/data/`.
- DBpedia se usa para enriquecer resultados y obtener descripciones públicas cuando existen.

Si quieres que renombre el repositorio en el control de versiones o actualice más documentación, dímelo y lo hago.
