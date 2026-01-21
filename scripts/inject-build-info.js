#!/usr/bin/env node
/**
 * Build Info Injector
 * 
 * This script injects commit SHA, build timestamp, and other
 * build metadata into the application for transparency and
 * reproducibility verification.
 * 
 * Usage:
 *   node scripts/inject-build-info.js
 * 
 * Environment variables:
 *   GITHUB_SHA - Git commit SHA (set by GitHub Actions)
 *   GITHUB_REF - Git ref (tag/branch)
 *   GITHUB_RUN_ID - GitHub Actions run ID
 *   GITHUB_REPOSITORY - Repository name
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get build info from environment or git
function getBuildInfo() {
  const info = {
    commitSha: process.env.GITHUB_SHA || getLocalCommitSha(),
    commitShort: '',
    branch: process.env.GITHUB_REF || getLocalBranch(),
    buildTime: new Date().toISOString(),
    buildTimestamp: Date.now(),
    runId: process.env.GITHUB_RUN_ID || 'local',
    repository: process.env.GITHUB_REPOSITORY || 'marixdev/marix',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };

  // Get short SHA
  info.commitShort = info.commitSha.substring(0, 7);

  // Clean up branch name
  if (info.branch.startsWith('refs/heads/')) {
    info.branch = info.branch.replace('refs/heads/', '');
  } else if (info.branch.startsWith('refs/tags/')) {
    info.branch = info.branch.replace('refs/tags/', '');
  }

  return info;
}

function getLocalCommitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getLocalBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// Main
const buildInfo = getBuildInfo();
const outputPath = path.join(__dirname, '..', 'src', 'build-info.json');

// Write JSON file
fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

console.log('='.repeat(60));
console.log('BUILD INFO INJECTED');
console.log('='.repeat(60));
console.log(`Commit:     ${buildInfo.commitSha}`);
console.log(`Short:      ${buildInfo.commitShort}`);
console.log(`Branch:     ${buildInfo.branch}`);
console.log(`Build Time: ${buildInfo.buildTime}`);
console.log(`Run ID:     ${buildInfo.runId}`);
console.log(`Repository: ${buildInfo.repository}`);
console.log(`Node:       ${buildInfo.nodeVersion}`);
console.log(`Platform:   ${buildInfo.platform}/${buildInfo.arch}`);
console.log('='.repeat(60));
console.log(`Output:     ${outputPath}`);
