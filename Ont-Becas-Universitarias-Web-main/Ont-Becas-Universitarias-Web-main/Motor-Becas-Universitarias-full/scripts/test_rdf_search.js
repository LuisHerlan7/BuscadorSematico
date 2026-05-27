const rdfService = require('../src/services/rdfService');

async function test() {
  try {
    const results = await rdfService.getScholarshipDetails('http://www.semanticweb.org/ontologia/becas-universitarias#BECA_Movilidad_2026');
    console.log('Detalle Beca Movilidad:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error en prueba:', err);
  }
}

test();

