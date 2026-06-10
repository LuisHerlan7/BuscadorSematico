# Buscador de Becas Universitarias — Manual de instalación y ejecución

Guía rápida para instalar, configurar y levantar la aplicación localmente.

## Requisitos

- Node.js (recomendado >= 16, probado con Node 18/22)
- npm (se usa el administrador de paquetes por defecto)
- Conexión a Internet para consultas a DBpedia (salvo que uses el modo offline)

## Estructura relevante

- `src/` — código fuente de la aplicación.
- `src/app.js` — punto de entrada del servidor (usa `PORT` o `3000` por defecto).
- `src/public/data/ontologia_becas.owl` — fichero OWL RDF local (opcional) para fallback offline.

## Instalación

1. Abre una terminal.
2. Sitúate en la carpeta del proyecto (donde está este `package.json`):

```powershell
cd "c:\Users\Admin\Desktop\web\BuscadorSematico\Ont-Becas-Universitarias-Web-main\Ont-Becas-Universitarias-Web-main\Motor-Becas-Universitarias-full"
```

3. Instala dependencias:

```powershell
npm install
```

## Variables de entorno (opcionales)

La aplicación funciona sin variables obligatorias, pero puedes personalizar:

- `PORT` — puerto en el que correrá el servidor (por defecto `3000`).
- `DBPEDIA_ENDPOINT` — si quieres apuntar a un endpoint SPARQL distinto al de DBpedia.

Puedes crear un archivo `.env` en la raíz y añadir por ejemplo:

```env
PORT=3000
DBPEDIA_ENDPOINT=https://dbpedia.org/sparql
```

La app usa `process.env.PORT` si está presente.

## Comandos disponibles

- `npm run build` — valida la estructura del proyecto y realiza chequeos (script local `scripts/validate-build.js`).
- `npm start` — arranca el servidor (`node src/app.js`).
- `npm run dev` — arranca el servidor en modo desarrollo con `nodemon` (recarga automática).

Ejemplo (PowerShell):

```powershell
cd "...\Motor-Becas-Universitarias-full"
npm install
npm run dev
```

Al arrancar verás en consola algo como:

```
Server running on http://localhost:3000
```

## Comportamiento del idioma y multilingüalidad

- El middleware `src/middleware/language.js` determina el idioma por (1) query `?lang=es`, (2) cookie `lang`, (3) header `Accept-Language`, o por defecto `en`.
- Para forzar español en la URL añade `?lang=es` (por ejemplo `/search?q=becas&lang=es`).
- Las consultas a DBpedia solicitan preferentemente literales en el idioma seleccionado; si no hay, algunos campos usan fallback a inglés o al RDF local.

## Datos offline y extracción DBpedia (opcional)

- Hay un script de extracción: `scripts/extract_dbpedia_scholarships.js` que puede poblar `src/public/data/ontologia_becas.owl`.
- En la interfaz hay una acción de importación (requiere `dev=1` para seguridad). No se recomienda ejecutar en producción.

## Solución de problemas comunes

- Si ves etiquetas en inglés aún con `?lang=es`, pueden no existir etiquetas en español en DBpedia para esa entidad; revisa el fallback offline.
- Ejecuta `npm run build` para validar sintaxis y detectar errores antes de `npm start`.
- Si `nodemon` no está instalado globalmente, `npm run dev` usa la versión en `node_modules`.

## Contacto y siguientes pasos

Si quieres que prepare un script de despliegue (Dockerfile / docker-compose) o que traduzca nombres de fuentes (`DBpedia`, `DBpedia Offline`) a la interfaz, dímelo y lo añado.

---

Archivo creado: `src/app.js` confirma puerto por defecto `3000`.
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
