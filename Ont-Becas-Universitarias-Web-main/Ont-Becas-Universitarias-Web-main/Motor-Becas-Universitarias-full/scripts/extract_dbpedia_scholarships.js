#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Simple utility to pause
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ENDPOINT = 'https://dbpedia.org/sparql';
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const ONTOLOGY_NS = 'http://www.semanticweb.org/ontologia/becas-universitarias#';
const DEFAULT_OUT = path.join(__dirname, '../src/public/data/dbpedia_offline.owl');
const CURATED_DBPEDIA_URIS = [
  'http://dbpedia.org/resource/Scholarship',
  'http://dbpedia.org/resource/Fulbright_Program',
  'http://dbpedia.org/resource/Erasmus_Programme',
  'http://dbpedia.org/resource/DAAD',
  'http://dbpedia.org/resource/Chevening_Scholarship',
  'http://dbpedia.org/resource/Athletic_scholarship'
];
const CURATED_WIKIDATA_URIS = [
  'http://www.wikidata.org/entity/Q5094324',  // Chevening Scholarship
  'http://www.wikidata.org/entity/Q253936',   // Fulbright Scholarship
  'http://www.wikidata.org/entity/Q1151557',  // DAAD Scholarship
  'http://www.wikidata.org/entity/Q1204346',  // Rhodes Scholarship
  'http://www.wikidata.org/entity/Q254168',   // Erasmus Programme
  'http://www.wikidata.org/entity/Q2092820',  // Erasmus Mundus
  'http://www.wikidata.org/entity/Q4813771'   // Athletic scholarship
];
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

async function queryWikidata(q) {
  const res = await axios.get(WIKIDATA_ENDPOINT, {
    params: { query: q, format: 'json' },
    timeout: 20000,
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'BuscadorBecasUniversitarias/1.0' }
  });
  return res.data;
}

async function queryDbpediaJson(uri) {
  const title = String(uri).split('/').pop();
  const res = await axios.get(`https://dbpedia.org/data/${encodeURIComponent(title)}.json`, {
    timeout: 20000,
    headers: { Accept: 'application/json', 'User-Agent': 'BuscadorBecasUniversitarias/1.0' }
  });
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
  FILTER(!STRSTARTS(STR(?s), "http://dbpedia.org/resource/Category:"))
  FILTER(!CONTAINS(LCASE(STR(?s)), "/list_of_"))
  FILTER(!CONTAINS(LCASE(STR(?s)), "_recipients"))
}
LIMIT ${limit}`;

  const data = await querySparql(q);
  return (data.results?.bindings || []).map(b => b.s.value);
}

async function findWikidataCandidates(limit = 80, langs = ['es','en','pt','de','fr']) {
  const langList = langs.join(',');
  const q = `PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX mwapi: <https://www.mediawiki.org/ontology#API/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT DISTINCT ?item ?itemLabel ?itemDescription WHERE {
  VALUES ?needle { "scholarship" "beca" "bolsa de estudos" "bourse" "stipendium" "student grant" }
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                    wikibase:api "EntitySearch";
                    mwapi:search ?needle;
                    mwapi:language "en".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langList},en,es". }
}
LIMIT ${limit}`;

  const data = await queryWikidata(q);
  return (data.results?.bindings || [])
    .map(b => b.item?.value)
    .filter(Boolean);
}

async function fetchWikidataDetailsFor(uri, langs = ['es','en','pt','de','fr']) {
  const entityId = (String(uri).match(/\/(Q[0-9]+)$/) || [])[1];
  if (!entityId) throw new Error(`Invalid Wikidata URI: ${uri}`);

  const labelFilters = langs.map(l => `LANG(?label) = '${l}'`).join(' || ');
  const descFilters = langs.map(l => `LANG(?description) = '${l}'`).join(' || ');
  const q = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT ?label ?description ?image ?website ?article WHERE {
  BIND(wd:${entityId} AS ?item)
  OPTIONAL { ?item rdfs:label ?label . FILTER(${labelFilters}) }
  OPTIONAL { ?item schema:description ?description . FILTER(${descFilters}) }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }
}`;

  const data = await queryWikidata(q);
  const labels = [];
  const abstracts = [];
  let thumbnail = null;
  let website = null;
  let article = null;

  for (const b of data.results?.bindings || []) {
    if (b.label) labels.push({ value: b.label.value, lang: b.label['xml:lang'] || '' });
    if (b.description) abstracts.push({ value: b.description.value, lang: b.description['xml:lang'] || '' });
    if (!thumbnail && b.image) thumbnail = b.image.value;
    if (!website && b.website) website = b.website.value;
    if (!article && b.article) article = b.article.value;
  }

  return {
    uri,
    sourceUrl: uri,
    labels: uniqueLangValues(labels),
    abstracts: uniqueLangValues(abstracts),
    thumbnail,
    seeAlso: website || article || thumbnail || uri
  };
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

async function fetchDbpediaJsonDetailsFor(uri, langs = ['es','en','pt','de','fr']) {
  const data = await queryDbpediaJson(uri);
  const node = data[uri] || {};
  const labels = [];
  const abstracts = [];

  for (const item of node['http://www.w3.org/2000/01/rdf-schema#label'] || []) {
    if (!item.lang || langs.includes(item.lang)) labels.push({ value: item.value, lang: item.lang || '' });
  }

  const textPredicates = [
    'http://dbpedia.org/ontology/abstract',
    'http://www.w3.org/2000/01/rdf-schema#comment',
    'http://dbpedia.org/ontology/description'
  ];
  for (const predicate of textPredicates) {
    for (const item of node[predicate] || []) {
      if (!item.lang || langs.includes(item.lang)) abstracts.push({ value: item.value, lang: item.lang || '' });
    }
  }

  const thumbnail = (node['http://dbpedia.org/ontology/thumbnail'] || [])[0]?.value || null;
  return {
    uri,
    sourceUrl: uri,
    labels: uniqueLangValues(labels),
    abstracts: uniqueLangValues(abstracts),
    thumbnail,
    seeAlso: thumbnail || uri
  };
}

function uniqueLangValues(values) {
  const seen = new Set();
  return values.filter(item => {
    const key = `${item.lang}:${item.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRelevantScholarshipDetail(detail) {
  const labelText = (detail.labels || []).map(item => item.value).join(' ');
  const text = `${labelText} ${(detail.abstracts || []).map(item => item.value).join(' ')}`.toLowerCase();
  const scholarshipSignal = /\b(scholarship|fellowship|grant|bursary|beca|bourse|stipendium|bolsa)\b|bolsa\s+de\s+estud/i;
  const programSignal = /\b(program|programme|programa|mobility|exchange|academic|student|university|master|doctoral|research|financial aid|tuition)\b/i;
  const knownAcademicProgram = /chevening|fulbright|erasmus|daad|rhodes/i.test(labelText);
  const noisySignal = /\b(singer|cantante|journal|book section|football club|school examination|romanticism|teaching and learning|generic concept)\b/i;

  return (knownAcademicProgram || scholarshipSignal.test(labelText))
    && (programSignal.test(text) || /chevening|fulbright|erasmus|daad|rhodes/i.test(labelText))
    && !noisySignal.test(text);
}

function buildNamedIndividual(detail) {
  // Use tags expected by rdfService: rdfs:label, descripción, requisitosTexto, beneficiosTexto, montoCubierto, fechaLímitePostulación, institucionTexto, nivelTexto, areaTexto, paisTexto, owl:sameAs
  const { uri, labels = [], abstracts = [], eligibility, requirements, criteria, thumbnail, sourceUrl, seeAlso } = detail;

  const about = rdfEscape(uri);
  const fragment = uri.split('/').pop() || uri.split('#').pop() || 'Scholarship';

  const labelTags = labels.map(l => `    <rdfs:label xml:lang="${rdfEscape(l.lang || '')}">${rdfEscape(l.value)}</rdfs:label>`).join('\n');
  const descTags = abstracts.map(a => `    <descripción xml:lang="${rdfEscape(a.lang || '')}">${rdfEscape(a.value)}</descripción>`).join('\n');
  const reqText = requirements || eligibility || criteria || 'Requisitos: promedio academico, documentos de postulacion, carta de motivacion y cumplimiento de elegibilidad segun convocatoria.';

  const parts = [];
  parts.push(`  <owl:NamedIndividual rdf:about="${about}">`);
  parts.push(`    <rdf:type rdf:resource="${ONTOLOGY_NS}Beca"/>`);
  parts.push(labelTags || `    <rdfs:label>${rdfEscape(fragment)}</rdfs:label>`);
  if (descTags) parts.push(descTags);
  parts.push(`    <requisitosTexto xml:lang="es">${rdfEscape(reqText)}</requisitosTexto>`);
  parts.push(`    <beneficiosTexto xml:lang="es">Beneficios: matricula, manutencion, apoyo academico, movilidad, seguro medico o materiales segun disponibilidad del programa.</beneficiosTexto>`);
  parts.push(`    <montoCubierto>Segun convocatoria oficial</montoCubierto>`);
  parts.push(`    <fechaLímitePostulación>Segun convocatoria oficial</fechaLímitePostulación>`);
  parts.push(`    <institucionTexto>Institucion u organismo financiador del programa</institucionTexto>`);
  parts.push(`    <nivelTexto>Pregrado; Maestria; Doctorado; Investigacion; Intercambio</nivelTexto>`);
  parts.push(`    <areaTexto>Todas las areas; investigacion; tecnologia; educacion; ciencias sociales</areaTexto>`);
  parts.push(`    <paisTexto>Internacional</paisTexto>`);
  parts.push(`    <owl:sameAs rdf:resource="${rdfEscape(sourceUrl || uri)}"/>`);
  parts.push(`    <rdfs:seeAlso rdf:resource="${rdfEscape(seeAlso || thumbnail || sourceUrl || uri)}"/>`);
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
  let uris = [];
  try {
    uris = await findCandidateUris(limit, langs);
  } catch (e) {
    console.error('DBpedia SPARQL candidate fetch failed:', e.message || e);
    uris = CURATED_DBPEDIA_URIS.slice(0, limit);
  }
  try {
    const wikiUris = await findWikidataCandidates(Math.max(20, Math.floor(limit / 3)), langs);
    uris = Array.from(new Set([...CURATED_WIKIDATA_URIS, ...uris, ...wikiUris])).slice(0, limit);
    console.log(`Added Wikidata candidates. Total candidates: ${uris.length}.`);
  } catch (e) {
    console.error('Wikidata candidate fetch failed:', e.message || e);
  }
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
      const detail = u.includes('wikidata.org/entity/')
        ? await fetchWikidataDetailsFor(u, langs)
        : await fetchDetailsFor(u, langs).catch(() => fetchDbpediaJsonDetailsFor(u, langs));
      detail.sourceUrl = detail.sourceUrl || u;
      if (!isRelevantScholarshipDetail(detail)) continue;
      const indiv = buildNamedIndividual(detail);
      individuals.push(indiv);
      // be nice to endpoint
      await sleep(200);
    } catch (err) {
      console.error(`\nError fetching ${u}: ${err.message}`);
    }
  }

  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF xmlns="${ONTOLOGY_NS}" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:owl="http://www.w3.org/2002/07/owl#">\n`;
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
