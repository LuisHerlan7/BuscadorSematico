const rdfService = require('../src/services/rdfService');

async function test() {
  try {
    const results = await rdfService.searchDiseases('Excelencia');
    console.log('Resultados para "Excelencia":', JSON.stringify(results, null, 2));

    const results2 = await rdfService.searchDiseases('Movilidad');
    console.log('Resultados para "Movilidad":', JSON.stringify(results2, null, 2));
  } catch (err) {
    console.error('Error en prueba:', err);
  }
}

test();
