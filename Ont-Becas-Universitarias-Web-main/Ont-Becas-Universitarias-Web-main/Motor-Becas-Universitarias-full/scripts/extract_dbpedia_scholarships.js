#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Simple utility to pause
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ENDPOINT = 'https://dbpedia.org/sparql';
const DEFAULT_OUT = path.join(__dirname, '../src/public/data/dbpedia_offline.owl');
// Attempt to reuse existing DBpedia service for better candidate discovery
let dbpediaService = null;
try { dbpediaService = require('../src/services/dbpediaService'); } catch (e) { dbpediaService = null; }

function rdfEscape(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function querySparql(q) {
  const res = await axios.get(ENDPOINT, { params: { query: q, format: 'json' }, timeout: 20000 });
  return res.data;
}

async function findCandidateUris(limit = 300, langs = ['es','en','pt','de','fr']) {
  // Build language filter for LANG(?label)
  const langFilter = langs.map(l => `LANG(?label) = '${l}'`).join(' || ');

  // Keywords across supported languages to improve recall (used in regex on abstract)
  const keywords = ['scholarship','beca','bolsa','fellowship','award','prize','bourse','stipendium','bolsa de estudios'];
  const regex = keywords.map(k => k.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1')).join('|');

  const q = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT DISTINCT ?s WHERE {
  ?s rdfs:label ?label .
  ?s dbo:abstract ?abstract .
  FILTER(${langFilter})
  FILTER regex(str(?abstract), "(${regex})", "i")
  FILTER NOT EXISTS { ?s a dbo:Person }
  FILTER NOT EXISTS { ?s a dbo:Place }
  FILTER NOT EXISTS { ?s a dbo:Settlement }
  FILTER NOT EXISTS { ?s a dbo:Location }
}
LIMIT ${limit}`;

  const data = await querySparql(q);
  return (data.results?.bindings || []).map(b => b.s.value);
}

async function fetchDetailsFor(uri, langs = ['es','en','pt','de','fr']) {
  const langFilter = langs.map(l => `LANG(?label) = '${l}'`).join(' || ');
  const langFilterA = langs.map(l => `LANG(?abstract) = '${l}'`).join(' || ');

  const q = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>
SELECT ?label ?labelLang ?abstract ?abstractLang ?eligibility ?requirements ?criteria ?thumbnail WHERE {
  OPTIONAL { <${uri}> rdfs:label ?label . BIND(lang(?label) AS ?labelLang) FILTER(${langFilter}) }
  OPTIONAL { <${uri}> dbo:abstract ?abstract . BIND(lang(?abstract) AS ?abstractLang) FILTER(${langFilterA}) }
  OPTIONAL { <${uri}> dbp:eligibility ?eligibility }
  OPTIONAL { <${uri}> dbp:requirements ?requirements }
  OPTIONAL { <${uri}> dbp:criteria ?criteria }
  OPTIONAL { <${uri}> dbo:thumbnail ?thumbnail }
}
`;

  const data = await querySparql(q);
  const bindings = data.results?.bindings || [];

  const labels = [];
  const abstracts = [];
  let eligibility = null;
  let requirements = null;
  let criteria = null;
  let thumbnail = null;

  for (const b of bindings) {
    if (b.label) labels.push({ value: b.label.value, lang: b.labelLang?.value || '' });
    if (b.abstract) abstracts.push({ value: b.abstract.value, lang: b.abstractLang?.value || '' });
    if (!eligibility && b.eligibility) eligibility = b.eligibility.value;
    if (!requirements && b.requirements) requirements = b.requirements.value;
    if (!criteria && b.criteria) criteria = b.criteria.value;
    if (!thumbnail && b.thumbnail) thumbnail = b.thumbnail.value;
  }

  return { uri, labels, abstracts, eligibility, requirements, criteria, thumbnail };
}

function buildNamedIndividual(detail) {
  // Use tags expected by rdfService: rdfs:label, descripción, requisitosTexto, beneficiosTexto, montoCubierto, fechaLímitePostulación, institucionTexto, nivelTexto, areaTexto, paisTexto, owl:sameAs
  const { uri, labels, abstracts, eligibility, requirements, criteria, thumbnail } = detail;

  const about = rdfEscape(uri);

  const labelTags = labels.map(l => `    <rdfs:label xml:lang="${rdfEscape(l.lang || '')}">${rdfEscape(l.value)}</rdfs:label>`).join('\n');
  const descTags = abstracts.map(a => `    <descripción xml:lang="${rdfEscape(a.lang || '')}">${rdfEscape(a.value)}</descripción>`).join('\n');

  const parts = [];
  parts.push(`  <owl:NamedIndividual rdf:about="${about}">`);
  parts.push(labelTags || `    <rdfs:label>${rdfEscape(fragment)}</rdfs:label>`);
  if (descTags) parts.push(descTags);
  if (eligibility) parts.push(`    <requisitosTexto>${rdfEscape(eligibility)}</requisitosTexto>`);
  if (requirements) parts.push(`    <requisitosTexto>${rdfEscape(requirements)}</requisitosTexto>`);
  if (criteria) parts.push(`    <requisitosTexto>${rdfEscape(criteria)}</requisitosTexto>`);
  if (thumbnail) parts.push(`    <rdfs:seeAlso rdf:resource="${rdfEscape(thumbnail)}"/>`);
  // mark as backup
  parts.push(`    <esRespaldoDBpedia>true</esRespaldoDBpedia>`);
  parts.push(`  </owl:NamedIndividual>`);

  return parts.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const outPath = outIndex >= 0 && args[outIndex+1] ? path.resolve(args[outIndex+1]) : DEFAULT_OUT;
  const merge = args.includes('--merge');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 300;
  const langsArg = args.find(a => a.startsWith('--langs='));
  const langs = langsArg ? String(langsArg.split('=')[1]).split(',').map(s => s.trim()).filter(Boolean) : ['es','en','pt','de','fr'];

  console.log('Finding candidate URIs from DBpedia...');
  let uris = await findCandidateUris(limit, langs);
  // If SPARQL approach returned nothing, try the higher-level service which has better heuristics
  if ((!uris || uris.length === 0) && dbpediaService) {
    console.log('No candidates from SPARQL. Falling back to dbpediaService searchScholarships per language.');
    const seen = new Set();
    for (const l of langs) {
      try {
        const results = await dbpediaService.searchScholarships('scholarship', l);
        for (const r of results) {
          if (seen.size >= limit) break;
          if (r.uri && !seen.has(r.uri)) {
            seen.add(r.uri);
          }
        }
        if (seen.size >= limit) break;
      } catch (e) {
        console.error('Fallback search error', e.message || e);
      }
    }
    uris = Array.from(seen).slice(0, limit);
  }
  console.log(`Found ${uris.length} candidates (limit ${limit}).`);

  const individuals = [];
  let i = 0;
  for (const u of uris) {
    try {
      i++;
      process.stdout.write(`Fetching ${i}/${uris.length} ${u}\r`);
      const detail = await fetchDetailsFor(u, langs);
      const indiv = buildNamedIndividual(detail);
      individuals.push(indiv);
      // be nice to endpoint
      await sleep(200);
    } catch (err) {
      console.error(`\nError fetching ${u}: ${err.message}`);
    }
  }

  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:owl="http://www.w3.org/2002/07/owl#">\n`;
  const footer = '\n</rdf:RDF>\n';

  const content = header + individuals.join('\n\n') + footer;

  // ensure directory exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (merge && fs.existsSync(outPath)) {
    // insert before last </rdf:RDF>
    const existing = fs.readFileSync(outPath, 'utf8');
    const idx = existing.lastIndexOf('</rdf:RDF>');
    if (idx === -1) {
      console.error('Existing file does not look like RDF/XML, aborting merge.');
      process.exit(1);
    }
    const merged = existing.slice(0, idx) + '\n' + individuals.join('\n\n') + '\n' + existing.slice(idx);
    fs.writeFileSync(outPath, merged, 'utf8');
    console.log(`Merged ${individuals.length} individuals into ${outPath}`);
  } else {
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`Wrote ${individuals.length} individuals to ${outPath}`);
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
