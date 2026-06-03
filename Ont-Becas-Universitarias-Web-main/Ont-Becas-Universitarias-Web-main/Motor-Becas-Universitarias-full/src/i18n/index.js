const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname);
const cache = {};

function load(lang) {
  if (cache[lang]) return cache[lang];
  try {
    const file = path.join(i18nDir, `${lang}.json`);
    const content = fs.readFileSync(file, 'utf8');
    cache[lang] = JSON.parse(content);
    return cache[lang];
  } catch (e) {
    return null;
  }
}

module.exports = {
  get: function(lang, key) {
    const data = load(lang) || load('es');
    return data ? data[key] : undefined;
  }
};
