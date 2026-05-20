const path = require('path');
const fs = require('fs');

function loadOntologyFilePath() {
    return path.join(__dirname, '../public/data/ontologia_becas.owl');
}

module.exports = { loadOntologyFilePath };
