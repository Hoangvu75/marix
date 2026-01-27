#!/usr/bin/env node
/**
 * Copy credential files from src to dist after TypeScript compilation
 * 
 * TypeScript compiler only compiles .ts files, not .json files.
 * This script copies credential files (google-credentials.json, box-credentials.json)
 * from src/main/services to dist/main/services so they are available at runtime.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src', 'main', 'services');
const DIST_DIR = path.join(__dirname, '..', 'dist', 'main', 'services');

const CREDENTIAL_FILES = [
  'google-credentials.json',
  'box-credentials.json',
  'onedrive-credentials.json',
];

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

let copiedCount = 0;

for (const file of CREDENTIAL_FILES) {
  const srcPath = path.join(SRC_DIR, file);
  const distPath = path.join(DIST_DIR, file);

  if (fs.existsSync(srcPath)) {
    try {
      fs.copyFileSync(srcPath, distPath);
      console.log(`[CopyCredentials] ✅ Copied ${file} to dist`);
      copiedCount++;
    } catch (err) {
      console.error(`[CopyCredentials] ❌ Failed to copy ${file}:`, err.message);
    }
  } else {
    console.log(`[CopyCredentials] ⚠️  ${file} not found in src, skipping`);
  }
}

if (copiedCount > 0) {
  console.log(`[CopyCredentials] ✅ Copied ${copiedCount} credential file(s) to dist`);
} else {
  console.log('[CopyCredentials] ⚠️  No credential files copied');
}
