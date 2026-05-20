const express = require('express');
const path = require('path');
const { QueryEngine } = require('@comunica/query-sparql');

const app = express();
const port = 3000;
const queryEngine = new QueryEngine();

app.get('/enfermedades', async (req, res) => {
  try {
    // Ruta absoluta del archivo ontológico (becas)
    const filePath = path.resolve(__dirname, '../public/data/ontologia_becas.owl');
    // Convertir a URL tipo file://
    const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;

    const query = `
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?beca ?nombre ?fecha WHERE {
        ?beca a becas:Beca .
        OPTIONAL { ?beca becas:nombreBeca ?nombre }
        OPTIONAL { ?beca becas:fechaInicio ?fecha }
        OPTIONAL { ?beca rdfs:label ?label }
      } LIMIT 100
    `;

    const bindingsStream = await queryEngine.queryBindings(query, {
      sources: [fileUrl]
    });

    const resultados = [];

    bindingsStream.on('data', (binding) => {
      resultados.push({
        uri: binding.get('beca')?.value,
        nombre: binding.get('nombre')?.value || binding.get('label')?.value,
        fecha: binding.get('fecha')?.value || 'Desconocido'
      });
    });

    bindingsStream.on('end', () => res.json(resultados));

    bindingsStream.on('error', (err) => {
      console.error('Error en el stream:', err);
      res.status(500).send('Error al procesar los resultados');
    });

  } catch (error) {
    console.error("Error general:", error);
    res.status(500).send("Error: " + error.message);
  }
});

app.listen(port, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${port}`);
});
