const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../src/views');
const i18nDir = path.join(__dirname, '../src/i18n');

function findViewFiles(dir) {
  const files = fs.readdirSync(dir);
  let res = [];
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      res = res.concat(findViewFiles(full));
    } else if (f.endsWith('.hbs')) {
      res.push(full);
    }
  }
  return res;
}

function extractKeysFromFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const re = /\{\{t '\\?([^'\\]+)'/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(content)) !== null) keys.add(m[1]);
  return Array.from(keys);
}

function loadI18nFiles() {
  const files = fs.readdirSync(i18nDir).filter(f => f.endsWith('.json'));
  const data = {};
  for (const f of files) data[f] = JSON.parse(fs.readFileSync(path.join(i18nDir, f), 'utf8'));
  return data;
}

function run() {
  const viewFiles = findViewFiles(viewsDir);
  const keys = new Set();
  for (const vf of viewFiles) extractKeysFromFile(vf).forEach(k => keys.add(k));

  const i18n = loadI18nFiles();
  const missing = {};
  for (const [file, map] of Object.entries(i18n)) {
    missing[file] = [];
    for (const k of keys) if (!(k in map)) missing[file].push(k);
  }

  let anyMissing = false;
  for (const [file, list] of Object.entries(missing)) {
    if (list.length) {
      anyMissing = true;
      console.log(`Missing keys in ${file}:`, list.join(', '));
    }
  }
  if (!anyMissing) console.log('All i18n keys present in all JSON files.');
}

if (require.main === module) run();
