const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requiredPaths = [
  'src/app.js',
  'src/config/express.js',
  'src/controllers/search.controller.js',
  'src/services/dbpediaService.js',
  'src/services/rdfService.js',
  'src/public/data/ontologia_becas.owl',
  'src/views/layouts/main.hbs',
  'src/views/search-results.hbs',
  'src/views/disease-detail.hbs'
];

function collectJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

for (const relativePath of requiredPaths) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing required file: ${relativePath}`);
    process.exit(1);
  }
}

const jsFiles = [
  ...collectJsFiles(path.join(root, 'src')),
  ...collectJsFiles(path.join(root, 'scripts'))
];

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Build validation completed.');
