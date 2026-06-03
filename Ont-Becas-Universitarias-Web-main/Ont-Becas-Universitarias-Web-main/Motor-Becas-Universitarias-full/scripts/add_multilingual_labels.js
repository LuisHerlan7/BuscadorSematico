const fs = require('fs');
const path = require('path');
const translationService = require('../src/services/translationService');

const owlPath = path.join(__dirname, '../src/public/data/ontologia_becas.owl');
const backupPath = owlPath + '.bak';

async function run(langs = ['en','pt','fr','de']) {
  if (!fs.existsSync(owlPath)) {
    console.error('Archivo ontología no encontrado en', owlPath);
    process.exit(1);
  }

  const content = fs.readFileSync(owlPath, 'utf8');
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log('Backup creado en', backupPath);

  // Encontrar cada bloque de NamedIndividual para procesar internamente
  const individualPattern = /(<owl:NamedIndividual[\s\S]*?<\/owl:NamedIndividual>)/g;
  let out = content;
  const matches = content.matchAll(individualPattern);

  for (const m of matches) {
    const block = m[1];
    // buscar etiquetas en español
    const esLabelPattern = /<rdfs:label[^>]*xml:lang="es"[^>]*>([\s\S]*?)<\/rdfs:label>/g;
    let esMatch;
    let newBlock = block;
    while ((esMatch = esLabelPattern.exec(block)) !== null) {
      const esText = esMatch[1].trim();
      for (const target of langs) {
        if (target === 'es') continue;
        // si ya existe etiqueta en target dentro del bloque, omitir
        const exist = newBlock.includes(`xml:lang="${target}"`);
        if (exist) continue;

        try {
          // traducir
          // usar 'pt'|'fr'|'de'|'en' directamente con translationService
          // se asume que translationService maneja la red
          // nota: esto puede ser lento para muchos individuos
          // si falla, se deja el texto en español
          // eslint-disable-next-line no-await-in-loop
          const translated = await translationService.translateText(esText, target, 'es');
          const insert = `<rdfs:label xml:lang="${target}">${escapeXml(translated)}</rdfs:label>`;
          // insertar luego de la etiqueta en español
          newBlock = newBlock.replace(esMatch[0], esMatch[0] + '\n        ' + insert);
        } catch (err) {
          console.error('Error traduciendo', esText, '->', target, err.message || err);
        }
      }
    }

    // reemplazar en el contenido
    out = out.replace(block, newBlock);
  }

  fs.writeFileSync(owlPath, out, 'utf8');
  console.log('Archivo ontología actualizado con etiquetas multilingües');
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

if (require.main === module) {
  const arg = process.argv.find(a => a.startsWith('--langs='));
  let langs = ['en','pt','fr','de'];
  if (arg) langs = arg.replace('--langs=', '').split(',').map(s => s.trim()).filter(Boolean);
  run(langs).catch(err => {
    console.error('Fallo:', err);
    process.exit(1);
  });
}
