"use strict";
// Build information injected at build time
// See scripts/inject-build-info.js
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
// Default build info for development
const defaultBuildInfo = {
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
let buildInfo = defaultBuildInfo;
try {
    // Get the app path - works in both dev and packaged
    const appPath = electron_1.app?.getAppPath?.() || process.cwd();
    // Try multiple paths for build-info.json
    const possiblePaths = [
        path.join(__dirname, 'build-info.json'), // Same directory as compiled code (dist/main/)
        path.join(appPath, 'dist', 'main', 'build-info.json'), // Packaged app: app.asar/dist/main/
        path.join(__dirname, '..', '..', 'src', 'build-info.json'), // Development: dist/main -> src
        path.join(process.cwd(), 'src', 'build-info.json'), // From cwd
        path.join(process.cwd(), 'dist', 'main', 'build-info.json'), // From cwd dist
    ];
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            buildInfo = JSON.parse(content);
            console.log('[BuildInfo] Loaded from:', filePath);
            break;
        }
    }
}
catch (err) {
    // Fall back to default for development
    console.log('[BuildInfo] Using default:', err);
    buildInfo = defaultBuildInfo;
}
exports.default = buildInfo;
//# sourceMappingURL=buildInfo.js.map