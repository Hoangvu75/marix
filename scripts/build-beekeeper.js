#!/usr/bin/env node
/**
 * build-beekeeper.js
 *
 * Builds BeeKeeper Studio for production embedding in Marix.
 * Outputs to: third_party/beekeeper-studio/apps/studio/dist-web/  (Vite SPA)
 *             third_party/beekeeper-studio/apps/studio/dist/       (preload + utility)
 *
 * After this script, electron-builder copies:
 *   third_party/beekeeper-studio/apps/studio/dist-web/ → <resources>/beekeeper-dist/web/
 *   third_party/beekeeper-studio/apps/studio/dist/     → <resources>/beekeeper-dist/dist/
 *
 *   third_party/beekeeper-studio/apps/studio/runtime_node_modules/ (runtime deps)
 *
 * Run with: npm run build:beekeeper
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BKS_ROOT = path.join(__dirname, '..', 'third_party', 'beekeeper-studio');
const STUDIO_DIR = path.join(BKS_ROOT, 'apps', 'studio');

function run(cmd, cwd = BKS_ROOT) {
  console.log(`\n▶  ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, SASS_SILENCE_DEPRECATIONS: 'legacy-js-api,import,global-builtin,color-functions' } });
}

console.log('═══════════════════════════════════════════════════');
console.log('  Building BeeKeeper Studio for Marix production   ');
console.log('═══════════════════════════════════════════════════');

// 1. Install dependencies if missing
if (!fs.existsSync(path.join(BKS_ROOT, 'node_modules'))) {
  console.log('\n[1/4] Installing BeeKeeper dependencies...');
  run('yarn install --ignore-scripts');
} else {
  console.log('\n[1/4] Dependencies already installed, skipping yarn install.');
}

// 2. Build ui-kit if not already built
const uiKitDist = path.join(BKS_ROOT, 'apps', 'ui-kit', 'dist', 'index.js');
if (!fs.existsSync(uiKitDist)) {
  console.log('\n[2/4] Building @beekeeperstudio/ui-kit...');
  run('yarn workspace @beekeeperstudio/ui-kit build');
} else {
  console.log('\n[2/4] ui-kit already built, skipping.');
}

// 3. Build preload + utility with esbuild
console.log('\n[3/4] Building preload & utility (esbuild)...');
run('yarn workspace beekeeper-studio build:esbuild');

// 4. Build frontend SPA with Vite → dist-web/
console.log('\n[4/4] Building frontend SPA (vite) → dist-web/...');
run('yarn workspace beekeeper-studio build:vite');

// 5. Prepare runtime node_modules closure for packaged utility/preload
run('node scripts/prepare-beekeeper-runtime.js', path.join(__dirname, '..'));

console.log('\n✅  BeeKeeper production build complete!');
console.log(`    SPA    → ${path.join(STUDIO_DIR, 'dist-web')}`);
console.log(`    Preload/Utility → ${path.join(STUDIO_DIR, 'dist')}`);
console.log(`    Runtime deps → ${path.join(STUDIO_DIR, 'runtime_node_modules')}`);
