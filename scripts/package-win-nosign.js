#!/usr/bin/env node
const { spawnSync } = require('child_process');

const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
delete env.WIN_CSC_LINK;
delete env.WIN_CSC_KEY_PASSWORD;
delete env.CSC_LINK;
delete env.CSC_KEY_PASSWORD;

const cliPath = require.resolve('electron-builder/out/cli/cli.js');
const result = spawnSync(process.execPath, [cliPath, '--win'], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
