# Buscador de Becas Universitarias

## 📌 Descripción del Proyecto

Proyecto para buscar y explorar convocatorias de becas universitarias usando una ontología local y consultas a **DBpedia**. Permite:

- 🔍 Buscar becas por nombre, institución, área o nivel académico
- 🌐 Mostrar resultados en múltiples idiomas (es, en, pt, fr, de)

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js + Express
- **Frontend**: Handlebars (templates) + Bootstrap
- **Consultas SPARQL**: Local (Comunica) y remoto (DBpedia)
- **Axios**: Para peticiones a endpoints externos

## 🚀 Cómo Ejecutar el Proyecto

### Requisitos Previos
- Node.js (v16 o superior)
- npm o pnpm

### Pasos de Instalación

1. Clona el repositorio y entra en la carpeta del proyecto:
   ```bash
   git clone <tu-repo-url>
   cd Motor-Medicina-full
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
3. Pulsa "Buscar" para obtener resultados locales y/o desde DBpedia.

### Resultados
- Cada resultado muestra: título, descripción/abstract, posible enlace a DBpedia y fuente (local / dbpedia).

## Notas

- La ontología local se encuentra en `src/public/data/` y puedes actualizarla con tus propias instancias.
- DBpedia se usa para enriquecer resultados y obtener descripciones públicas cuando existen.

Si quieres que renombre el repositorio en el control de versiones o actualice más documentación, dímelo y lo hago.
