#!/usr/bin/env node
/**
 * Prepare a minimal BeeKeeper runtime node_modules set for packaged Marix.
 *
 * We parse require() specifiers from BeeKeeper's built preload/utility entries,
 * resolve package-level dependencies transitively from BeeKeeper's root
 * node_modules, then copy that closure into apps/studio/runtime_node_modules.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const BKS_ROOT = path.join(ROOT, 'third_party', 'beekeeper-studio');
const BKS_STUDIO = path.join(BKS_ROOT, 'apps', 'studio');
const SRC_NODE_MODULES = path.join(BKS_ROOT, 'node_modules');
const OUT_NODE_MODULES = path.join(BKS_STUDIO, 'runtime_node_modules');
const DIST_PRELOAD = path.join(BKS_STUDIO, 'dist', 'preload.js');
const DIST_UTILITY = path.join(BKS_STUDIO, 'dist', 'utility.js');

const BUILTIN = new Set(
  Module.builtinModules
    .map((m) => (m.startsWith('node:') ? m.slice(5) : m))
    .concat(['electron']),
);

function getPackageName(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('node:')) return null;
  const parts = specifier.split('/');
  if (!parts.length) return null;
  if (parts[0].startsWith('@')) {
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

function collectRequirePackages(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`BeeKeeper dist file not found: ${filePath}`);
  }

  const src = fs.readFileSync(filePath, 'utf8');
  const packages = new Set();
  const pattern = /require\((['"])([^'"()]+)\1\)/g;
  let match = pattern.exec(src);
  while (match) {
    const spec = match[2];
    const pkg = getPackageName(spec);
    if (pkg && !isBuiltinOnlyPackage(pkg)) {
      packages.add(pkg);
    }
    match = pattern.exec(src);
  }
  return packages;
}

function listSourceTopLevelPackages() {
  const names = [];
  if (!fs.existsSync(SRC_NODE_MODULES)) return names;
  const entries = fs.readdirSync(SRC_NODE_MODULES, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      const scopeDir = path.join(SRC_NODE_MODULES, entry.name);
      if (!fs.existsSync(scopeDir)) continue;
      const scopedEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (!scopedEntry.isDirectory() || scopedEntry.name.startsWith('.')) continue;
        names.push(`${entry.name}/${scopedEntry.name}`);
      }
      continue;
    }
    names.push(entry.name);
  }

  return names;
}

function collectTemplateRequirePackages(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`BeeKeeper dist file not found: ${filePath}`);
  }

  const src = fs.readFileSync(filePath, 'utf8');
  const packages = new Set();
  const allTopLevel = listSourceTopLevelPackages();

  // Match: require(`prefix${expr}suffix`)
  const pattern = /require\(\s*`([^`$]*)\$\{[^}]+\}([^`]*)`\s*\)/g;
  let match = pattern.exec(src);
  while (match) {
    const prefix = match[1] || '';
    const suffix = match[2] || '';

    if (
      !prefix ||
      prefix.startsWith('.') ||
      prefix.startsWith('/') ||
      prefix.startsWith('node:')
    ) {
      match = pattern.exec(src);
      continue;
    }

    for (const pkgName of allTopLevel) {
      if (!pkgName.startsWith(prefix)) continue;
      if (suffix && !pkgName.endsWith(suffix)) continue;
      if (!isBuiltinOnlyPackage(pkgName)) {
        packages.add(pkgName);
      }
    }

    match = pattern.exec(src);
  }

  return packages;
}

function resolvePackageDir(pkgName) {
  return path.join(SRC_NODE_MODULES, ...pkgName.split('/'));
}

function hasSourcePackage(pkgName) {
  if (!pkgName) return false;
  return fs.existsSync(resolvePackageDir(pkgName));
}

function isBuiltinOnlyPackage(pkgName) {
  return BUILTIN.has(pkgName) && !hasSourcePackage(pkgName);
}

function isBuiltinSpecifier(specifier) {
  if (!specifier) return false;
  const normalized = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
  return BUILTIN.has(normalized);
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function collectDependencyClosure(seedPackages) {
  const queue = Array.from(seedPackages);
  const visited = new Set();
  const missing = new Set();

  while (queue.length) {
    const pkgName = queue.shift();
    if (!pkgName || visited.has(pkgName) || isBuiltinOnlyPackage(pkgName)) continue;
    visited.add(pkgName);

    const pkgDir = resolvePackageDir(pkgName);
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    const pkgJson = readJsonSafe(pkgJsonPath);
    if (!pkgJson) {
      missing.add(pkgName);
      continue;
    }

    const deps = new Set([
      ...Object.keys(pkgJson.dependencies || {}),
      ...Object.keys(pkgJson.optionalDependencies || {}),
      ...Object.keys(pkgJson.peerDependencies || {}),
    ]);

    for (const dep of deps) {
      if (!visited.has(dep) && !isBuiltinOnlyPackage(dep)) {
        queue.push(dep);
      }
    }
  }

  return { packages: visited, missing };
}

function collectDeclaredDeps(pkgJson) {
  return new Set([
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.optionalDependencies || {}),
    ...Object.keys(pkgJson.peerDependencies || {}),
  ]);
}

function packagePathInOutRoot(pkgName) {
  return path.join(OUT_NODE_MODULES, ...pkgName.split('/'));
}

function copyPackage(pkgName, overwrite = true) {
  const fromDir = resolvePackageDir(pkgName);
  if (!fs.existsSync(fromDir)) return false;

  const toDir = packagePathInOutRoot(pkgName);
  if (!overwrite && fs.existsSync(toDir)) return false;
  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  fs.cpSync(fromDir, toDir, { recursive: true, dereference: true });
  return true;
}

function listPackageDirs(nodeModulesDir) {
  const result = [];
  const stack = [nodeModulesDir];

  while (stack.length) {
    const currentNodeModules = stack.pop();
    if (!currentNodeModules || !fs.existsSync(currentNodeModules)) continue;

    const entries = fs.readdirSync(currentNodeModules, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      if (entry.name.startsWith('@')) {
        const scopeDir = path.join(currentNodeModules, entry.name);
        const scopedEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
        for (const scopedEntry of scopedEntries) {
          if (!scopedEntry.isDirectory()) continue;
          const pkgDir = path.join(scopeDir, scopedEntry.name);
          if (fs.existsSync(path.join(pkgDir, 'package.json'))) {
            result.push(pkgDir);
          }
          const nestedNodeModules = path.join(pkgDir, 'node_modules');
          if (fs.existsSync(nestedNodeModules)) {
            stack.push(nestedNodeModules);
          }
        }
      } else {
        const pkgDir = path.join(currentNodeModules, entry.name);
        if (fs.existsSync(path.join(pkgDir, 'package.json'))) {
          result.push(pkgDir);
        }
        const nestedNodeModules = path.join(pkgDir, 'node_modules');
        if (fs.existsSync(nestedNodeModules)) {
          stack.push(nestedNodeModules);
        }
      }
    }
  }

  return result;
}

function canResolveFromPackage(pkgDir, depName) {
  try {
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    const req = Module.createRequire(pkgJsonPath);
    const resolved = req.resolve(depName);
    if (isBuiltinSpecifier(resolved) || isBuiltinSpecifier(depName)) {
      return true;
    }
    const outRoot = path.resolve(OUT_NODE_MODULES) + path.sep;
    const resolvedPath = path.resolve(resolved);
    return resolvedPath.startsWith(outRoot);
  } catch {
    return false;
  }
}

function listJsFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.bin') continue;
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function collectLiteralRequireSpecifiers(sourceCode) {
  const specs = new Set();
  const pattern = /require\(\s*(['"])([^'"()]+)\1\s*\)/g;
  let match = pattern.exec(sourceCode);
  while (match) {
    specs.add(match[2]);
    match = pattern.exec(sourceCode);
  }
  return specs;
}

function canResolveSpecifierFromFile(filePath, specifier) {
  try {
    const req = Module.createRequire(filePath);
    const resolved = req.resolve(specifier);

    if (isBuiltinSpecifier(resolved) || isBuiltinSpecifier(specifier)) {
      return true;
    }

    if (typeof resolved === 'string' && path.isAbsolute(resolved)) {
      const outRoot = path.resolve(OUT_NODE_MODULES) + path.sep;
      const resolvedPath = path.resolve(resolved);
      return resolvedPath.startsWith(outRoot);
    }

    return true;
  } catch {
    return false;
  }
}

function repairMissingDependencies(maxPasses = 8) {
  let addedTotal = 0;
  const unresolved = new Set();

  for (let pass = 1; pass <= maxPasses; pass++) {
    let addedThisPass = 0;
    const packageDirs = listPackageDirs(OUT_NODE_MODULES);

    for (const pkgDir of packageDirs) {
      const pkgJson = readJsonSafe(path.join(pkgDir, 'package.json'));
      if (!pkgJson) continue;

      for (const depName of collectDeclaredDeps(pkgJson)) {
        if (!depName || isBuiltinOnlyPackage(depName)) continue;
        if (canResolveFromPackage(pkgDir, depName)) continue;

        const copied = copyPackage(depName, false);
        if (copied) {
          addedThisPass++;
          addedTotal++;
          unresolved.delete(depName);
          continue;
        }

        // If package doesn't exist in source root, it's likely optional platform-specific dependency.
        if (!fs.existsSync(resolvePackageDir(depName))) {
          unresolved.add(depName);
        }
      }
    }

    if (addedThisPass === 0) {
      break;
    }
  }

  return { addedTotal, unresolved };
}

function repairMissingFromRequireScan(maxPasses = 6) {
  let addedTotal = 0;
  const unresolved = new Set();

  for (let pass = 1; pass <= maxPasses; pass++) {
    let addedThisPass = 0;
    const jsFiles = listJsFiles(OUT_NODE_MODULES);

    for (const filePath of jsFiles) {
      let sourceCode = '';
      try {
        sourceCode = fs.readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }
      if (!sourceCode.includes('require(')) continue;

      for (const specifier of collectLiteralRequireSpecifiers(sourceCode)) {
        const pkgName = getPackageName(specifier);
        if (!pkgName || isBuiltinOnlyPackage(pkgName)) continue;
        if (canResolveSpecifierFromFile(filePath, specifier)) continue;

        const copied = copyPackage(pkgName, false);
        if (copied) {
          addedThisPass++;
          addedTotal++;
          unresolved.delete(pkgName);
          continue;
        }

        if (!hasSourcePackage(pkgName)) {
          unresolved.add(pkgName);
        }
      }
    }

    if (addedThisPass === 0) {
      break;
    }
  }

  return { addedTotal, unresolved };
}

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, ms);
}

function clearDirWithRetry(dirPath, attempts = 8) {
  let lastError = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      fs.rmSync(dirPath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 120,
      });
      return;
    } catch (err) {
      lastError = err;
      const code = err && err.code ? err.code : '';
      if (!['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(code) || i === attempts) {
        break;
      }
      sleepSync(150 * i);
    }
  }
  throw lastError;
}

function main() {
  console.log('\n[5/5] Preparing BeeKeeper runtime node_modules for packaged app...');

  const seed = new Set([
    ...collectRequirePackages(DIST_PRELOAD),
    ...collectRequirePackages(DIST_UTILITY),
    ...collectTemplateRequirePackages(DIST_PRELOAD),
    ...collectTemplateRequirePackages(DIST_UTILITY),
    '@electron/remote',
  ]);

  const { packages, missing: closureMissing } = collectDependencyClosure(seed);

  clearDirWithRetry(OUT_NODE_MODULES);
  fs.mkdirSync(OUT_NODE_MODULES, { recursive: true });

  let copied = 0;
  for (const pkgName of Array.from(packages).sort()) {
    if (copyPackage(pkgName)) copied++;
  }

  const { addedTotal: repairedCount, unresolved } = repairMissingDependencies();
  const { addedTotal: scanRepairCount, unresolved: scanUnresolved } = repairMissingFromRequireScan();

  if (closureMissing.size) {
    console.warn(`[BeeKeeper Runtime] Missing package metadata for ${closureMissing.size} package(s):`);
    console.warn(Array.from(closureMissing).sort().join(', '));
  }

  if (unresolved.size) {
    console.warn(`[BeeKeeper Runtime] Unresolved deps after repair (${unresolved.size}):`);
    console.warn(Array.from(unresolved).sort().join(', '));
  }
  if (scanUnresolved.size) {
    console.warn(`[BeeKeeper Runtime] Unresolved deps after require-scan repair (${scanUnresolved.size}):`);
    console.warn(Array.from(scanUnresolved).sort().join(', '));
  }

  console.log(`[BeeKeeper Runtime] Seed packages: ${seed.size}`);
  console.log(`[BeeKeeper Runtime] Dependency closure: ${packages.size}`);
  console.log(`[BeeKeeper Runtime] Packages copied: ${copied}`);
  console.log(`[BeeKeeper Runtime] Packages added by repair: ${repairedCount}`);
  console.log(`[BeeKeeper Runtime] Packages added by require-scan repair: ${scanRepairCount}`);
  console.log(`[BeeKeeper Runtime] Output: ${OUT_NODE_MODULES}`);
}

main();
