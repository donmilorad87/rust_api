import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const SCHEMA_URL = 'https://schema.org/version/latest/schemaorg-current-https.jsonld';

const DATA_TYPES = new Set([
  'Boolean',
  'Date',
  'DateTime',
  'Number',
  'Float',
  'Integer',
  'Text',
  'Time',
  'URL'
]);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function toLocalName(id) {
  if (!id) return null;
  if (typeof id === 'string') {
    if (id.startsWith('schema:')) return id.slice('schema:'.length);
    if (id.startsWith('http://schema.org/')) return id.slice('http://schema.org/'.length);
    if (id.startsWith('https://schema.org/')) return id.slice('https://schema.org/'.length);
    return id;
  }
  if (typeof id === 'object' && id['@id']) {
    return toLocalName(id['@id']);
  }
  return null;
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function extractTypes(graph) {
  const types = {};
  for (const node of graph) {
    const nodeTypes = normalizeList(node['@type']);
    if (!nodeTypes.includes('rdfs:Class')) continue;
    const name = toLocalName(node['@id']);
    if (!name || name.includes(':')) continue;

    const parents = normalizeList(node['rdfs:subClassOf'])
      .map(toLocalName)
      .filter(Boolean);

    types[name] = {
      label: node['rdfs:label'] || name,
      comment: node['rdfs:comment'] || '',
      parents,
      properties: []
    };
  }
  return types;
}

function extractProperties(graph) {
  const properties = {};
  for (const node of graph) {
    const nodeTypes = normalizeList(node['@type']);
    if (!nodeTypes.includes('rdf:Property')) continue;
    const name = toLocalName(node['@id']);
    if (!name || name.includes(':')) continue;

    const domains = normalizeList(node['schema:domainIncludes'] || node['domainIncludes'])
      .map(toLocalName)
      .filter(Boolean);
    const ranges = normalizeList(node['schema:rangeIncludes'] || node['rangeIncludes'])
      .map(toLocalName)
      .filter(Boolean);

    properties[name] = {
      label: node['rdfs:label'] || name,
      comment: node['rdfs:comment'] || '',
      domains,
      ranges
    };
  }
  return properties;
}

function buildAncestorMap(types) {
  const cache = new Map();

  function collect(type) {
    if (cache.has(type)) return cache.get(type);
    const entry = types[type];
    if (!entry) {
      cache.set(type, []);
      return [];
    }
    const parents = entry.parents || [];
    const full = [...parents];
    for (const parent of parents) {
      full.push(...collect(parent));
    }
    const unique = Array.from(new Set(full));
    cache.set(type, unique);
    return unique;
  }

  const map = {};
  Object.keys(types).forEach((type) => {
    map[type] = collect(type);
  });
  return map;
}

function buildTypeProperties(types, properties) {
  const ancestors = buildAncestorMap(types);
  const typeProps = {};

  for (const [typeName] of Object.entries(types)) {
    const validDomains = new Set([typeName, ...(ancestors[typeName] || [])]);
    const props = [];

    for (const [propName, prop] of Object.entries(properties)) {
      if (prop.domains.some((domain) => validDomains.has(domain))) {
        props.push(propName);
      }
    }

    typeProps[typeName] = props.sort();
  }

  return typeProps;
}

function buildRangeSummary(properties) {
  const summary = {};
  for (const [propName, prop] of Object.entries(properties)) {
    const rangeTypes = prop.ranges || [];
    const dataTypes = rangeTypes.filter((range) => DATA_TYPES.has(range));
    const entityTypes = rangeTypes.filter((range) => !DATA_TYPES.has(range));

    summary[propName] = {
      data_types: dataTypes,
      entity_types: entityTypes
    };
  }
  return summary;
}

async function main() {
  const jsonld = await fetchJson(SCHEMA_URL);
  const graph = jsonld['@graph'] || [];

  const types = extractTypes(graph);
  const properties = extractProperties(graph);
  const typeProperties = buildTypeProperties(types, properties);
  const rangeSummary = buildRangeSummary(properties);

  const output = {
    generated_at: new Date().toISOString(),
    source: SCHEMA_URL,
    types,
    properties,
    type_properties: typeProperties,
    property_ranges: rangeSummary,
    data_types: Array.from(DATA_TYPES)
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outPath = path.resolve(__dirname, '../../src/resources/schema/schema_catalog.json');

  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Schema catalog written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
