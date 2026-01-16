"use strict";
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
exports.OAuth2CallbackServer = void 0;
const http = __importStar(require("http"));
class OAuth2CallbackServer {
    constructor() {
        this.server = null;
        this.port = 3000;
    }
    /**
     * Start HTTP server to listen for OAuth callback
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                const url = new URL(req.url, `http://localhost:${this.port}`);
                if (url.pathname === '/oauth2callback') {
                    const code = url.searchParams.get('code');
                    const error = url.searchParams.get('error');
                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
              <html>
                <head>
                  <title>Authentication Failed</title>
                  <style>
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                      text-align: center; 
                      padding: 60px 20px;
                      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                      min-height: 100vh;
                      margin: 0;
                      box-sizing: border-box;
                    }
                    .container {
                      max-width: 400px;
                      margin: 0 auto;
                      background: rgba(30, 41, 59, 0.8);
                      border-radius: 16px;
                      padding: 40px;
                      border: 1px solid rgba(100, 116, 139, 0.3);
                    }
                    .icon {
                      width: 64px;
                      height: 64px;
                      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin: 0 auto 24px;
                    }
                    .icon svg {
                      width: 32px;
                      height: 32px;
                      color: white;
                    }
                    h1 { 
                      color: #f1f5f9; 
                      font-size: 24px;
                      font-weight: 600;
                      margin: 0 0 12px;
                    }
                    p { 
                      color: #94a3b8; 
                      font-size: 14px;
                      margin: 0 0 8px;
                    }
                    .error-msg {
                      color: #f87171;
                      font-size: 13px;
                      background: rgba(239, 68, 68, 0.1);
                      padding: 8px 12px;
                      border-radius: 8px;
                      margin-top: 16px;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </div>
                    <h1>Authentication Failed</h1>
                    <p>You can close this window.</p>
                    <div class="error-msg">${error}</div>
                  </div>
                </body>
              </html>
            `);
                        this.stop();
                        reject(new Error(error));
                        return;
                    }
                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
              <html>
                <head>
                  <title>Authentication Successful</title>
                  <style>
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                      text-align: center; 
                      padding: 60px 20px;
                      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                      min-height: 100vh;
                      margin: 0;
                      box-sizing: border-box;
                    }
                    .container {
                      max-width: 400px;
                      margin: 0 auto;
                      background: rgba(30, 41, 59, 0.8);
                      border-radius: 16px;
                      padding: 40px;
                      border: 1px solid rgba(100, 116, 139, 0.3);
                    }
                    .icon {
                      width: 64px;
                      height: 64px;
                      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin: 0 auto 24px;
                    }
                    .icon svg {
                      width: 32px;
                      height: 32px;
                      color: white;
                    }
                    h1 { 
                      color: #f1f5f9; 
                      font-size: 24px;
                      font-weight: 600;
                      margin: 0 0 12px;
                    }
                    p { 
                      color: #94a3b8; 
                      font-size: 14px;
                      margin: 0;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <h1>Authentication Successful</h1>
                    <p>You can close this window and return to Marix.</p>
                  </div>
                  <script>
                    setTimeout(() => window.close(), 2000);
                  </script>
                </body>
              </html>
            `);
                        this.stop();
                        resolve(code);
                        return;
                    }
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Missing authorization code');
                    this.stop();
                    reject(new Error('Missing authorization code'));
                }
                else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not found');
                }
            });
            this.server.listen(this.port, () => {
                console.log(`[OAuth2CallbackServer] Listening on http://localhost:${this.port}`);
            });
            this.server.on('error', (err) => {
                console.error('[OAuth2CallbackServer] Server error:', err);
                reject(err);
            });
        });
    }
    /**
     * Stop the server
     */
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('[OAuth2CallbackServer] Server stopped');
        }
    }
}
exports.OAuth2CallbackServer = OAuth2CallbackServer;
//# sourceMappingURL=OAuth2CallbackServer.js.map