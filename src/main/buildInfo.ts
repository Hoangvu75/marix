// Build information injected at build time
// See scripts/inject-build-info.js

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface BuildInfo {
  commitSha: string;
  commitShort: string;
  branch: string;
  buildTime: string;
  buildTimestamp: number;
  runId: string;
  repository: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

// Default build info for development
const defaultBuildInfo: BuildInfo = {
  commitSha: 'development',
  commitShort: 'dev',
  branch: 'local',
  buildTime: new Date().toISOString(),
  buildTimestamp: Date.now(),
  runId: 'local',
  repository: 'marixdev/marix',
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
};

let buildInfo: BuildInfo = defaultBuildInfo;

try {
  // Get the app path - works in both dev and packaged
  const appPath = app?.getAppPath?.() || process.cwd();
  
  // Try multiple paths for build-info.json
  const possiblePaths = [
    path.join(__dirname, 'build-info.json'),                      // Same directory as compiled code (dist/main/)
    path.join(appPath, 'dist', 'main', 'build-info.json'),        // Packaged app: app.asar/dist/main/
    path.join(__dirname, '..', '..', 'src', 'build-info.json'),   // Development: dist/main -> src
    path.join(process.cwd(), 'src', 'build-info.json'),           // From cwd
    path.join(process.cwd(), 'dist', 'main', 'build-info.json'),  // From cwd dist
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      buildInfo = JSON.parse(content);
      console.log('[BuildInfo] Loaded from:', filePath);
      break;
    }
  }
} catch (err) {
  // Fall back to default for development
  console.log('[BuildInfo] Using default:', err);
  buildInfo = defaultBuildInfo;
}

export default buildInfo;
