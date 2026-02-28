#!/usr/bin/env node
/**
 * sync-locales.js
 * Finds all keys in en.json that are missing from other locale files and adds them
 * with the English value as fallback. Also removes duplicate keys.
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'renderer', 'locales');
const enPath = path.join(localesDir, 'en.json');

// Read en.json as reference - parse raw to preserve key order
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = Object.keys(enData);

const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');

let totalAdded = 0;
let totalDupsRemoved = 0;

for (const file of localeFiles) {
  const filePath = path.join(localesDir, file);
  const rawContent = fs.readFileSync(filePath, 'utf8');

  // Parse and deduplicate: read file manually to handle duplicate keys
  // (JSON.parse silently takes the last value for duplicates)
  let localData;
  try {
    localData = JSON.parse(rawContent);
  } catch (e) {
    console.error(`[ERROR] Failed to parse ${file}: ${e.message}`);
    continue;
  }

  // Find missing keys
  const missingKeys = enKeys.filter(k => !(k in localData));

  // Detect duplicate keys by parsing the raw text
  const keyMatches = [...rawContent.matchAll(/"([^"]+)"\s*:/g)];
  const seenKeys = new Set();
  const dupKeys = new Set();
  for (const m of keyMatches) {
    const key = m[1];
    if (seenKeys.has(key)) dupKeys.add(key);
    seenKeys.add(key);
  }

  if (missingKeys.length === 0 && dupKeys.size === 0) {
    console.log(`[OK] ${file} - complete, no duplicates`);
    continue;
  }

  // Build clean output: use en.json key order, keep existing translations
  const output = {};
  for (const key of enKeys) {
    if (key in localData) {
      output[key] = localData[key];
    } else {
      // Use English as fallback
      output[key] = enData[key];
    }
  }

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`[UPDATED] ${file}: +${missingKeys.length} keys added, ${dupKeys.size} dup key groups resolved`);
  if (missingKeys.length > 0) {
    console.log(`  Added: ${missingKeys.slice(0, 10).join(', ')}${missingKeys.length > 10 ? ` ... +${missingKeys.length - 10} more` : ''}`);
  }

  totalAdded += missingKeys.length;
  totalDupsRemoved += dupKeys.size;
}

console.log(`\nDone! Total: +${totalAdded} keys added across all locales, ${totalDupsRemoved} duplicate sets resolved.`);
