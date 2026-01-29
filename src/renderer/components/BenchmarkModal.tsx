/**
 * Benchmark Modal Component
 * 
 * Displays server benchmark results in a beautiful modal:
 * - System Information
 * - Disk Performance
 * - Network Speed
 * 
 * Shows real-time progress during benchmark execution.
 * Supports export to HTML, JSON, PNG, TXT and upload to paste.dev
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

// Types matching BenchmarkService
interface SystemInfo {
  os: string;
  kernel: string;
  arch: string;
  hostname: string;
  uptime: string;
  loadAverage: string;
  cpu: {
    model: string;
    cores: number;
    frequency: string;
    usage: string;
  };
  memory: {
    total: string;
    used: string;
    free: string;
    usagePercent: number;
  };
  swap: {
    total: string;
    used: string;
    free: string;
  };
  disk: {
    total: string;
    used: string;
    free: string;
    usagePercent: number;
    mountPoint: string;
  };
  virtualization: string;
}

interface DiskBenchmark {
  sequentialWrite: { speed: string; rawBytes: number };
  sequentialRead: { speed: string; rawBytes: number };
  ioping: string;
  fio?: {
    readIops: string;
    writeIops: string;
    readBw: string;
    writeBw: string;
  };
}

interface NetworkBenchmark {
  tests: Array<{
    server: string;
    location: string;
    download: string;
    upload: string;
    latency: string;
  }>;
  provider?: string;
  publicIp?: string;
}

interface BenchmarkResult {
  systemInfo: SystemInfo | null;
  diskBenchmark: DiskBenchmark | null;
  networkBenchmark: NetworkBenchmark | null;
  startTime: number;
  endTime: number;
  duration: number;
  errors: string[];
}

interface BenchmarkProgress {
  phase: 'system' | 'disk' | 'network' | 'complete';
  message: string;
  percent: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  serverName: string;
  appTheme: 'dark' | 'light';
}

const BenchmarkModal: React.FC<Props> = ({
  isOpen,
  onClose,
  connectionId,
  serverName,
  appTheme
}) => {
  const { t } = useLanguage();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadToPaste, setUploadToPaste] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pasteUrl, setPasteUrl] = useState<string | null>(null);
  const [isUploadingToPaste, setIsUploadingToPaste] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Paste.dev API Key
  const PASTE_API_KEY = 'aIPR6zVTi2jsA7zoJpl5i9IuGqa4mzhegShiU8h8S';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setError(null);
      setProgress(null);
      setIsRunning(false);
      setExportMessage(null);
      setPasteUrl(null);
    }
  }, [isOpen]);

  // Listen for progress updates
  useEffect(() => {
    if (!isOpen) return;

    const handleProgress = (data: BenchmarkProgress) => {
      setProgress(data);
    };

    ipcRenderer.on('benchmark:progress', handleProgress);

    return () => {
      ipcRenderer.removeListener('benchmark:progress', handleProgress);
    };
  }, [isOpen]);

  // Start benchmark
  const startBenchmark = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgress({ phase: 'system', message: t('benchmarkStarting') || 'Starting benchmark...', percent: 0 });

    try {
      const benchResult = await ipcRenderer.invoke('benchmark:run', connectionId);
      setResult(benchResult);
    } catch (err: any) {
      setError(err.message || 'Benchmark failed');
    } finally {
      setIsRunning(false);
    }
  }, [connectionId, t]);

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Generate TXT content
  const generateTxtContent = useCallback((res: BenchmarkResult): string => {
    const lines: string[] = [];
    const divider = '═'.repeat(60);
    const thinDivider = '─'.repeat(60);

    lines.push(divider);
    lines.push(`  MARIX SERVER BENCHMARK - ${serverName}`);
    lines.push(`  ${new Date(res.startTime).toLocaleString()}`);
    lines.push(divider);
    lines.push('');

    if (res.systemInfo) {
      lines.push('┌────────────────────────────────────────────────────────────┐');
      lines.push('│                    SYSTEM INFORMATION                      │');
      lines.push('└────────────────────────────────────────────────────────────┘');
      lines.push(`  OS            : ${res.systemInfo.os}`);
      lines.push(`  Hostname      : ${res.systemInfo.hostname}`);
      lines.push(`  Kernel        : ${res.systemInfo.kernel}`);
      lines.push(`  Arch          : ${res.systemInfo.arch}`);
      lines.push(`  CPU           : ${res.systemInfo.cpu.model}`);
      lines.push(`  CPU Cores     : ${res.systemInfo.cpu.cores}`);
      lines.push(`  CPU Freq      : ${res.systemInfo.cpu.frequency}`);
      lines.push(`  Memory        : ${res.systemInfo.memory.used} / ${res.systemInfo.memory.total} (${res.systemInfo.memory.usagePercent}%)`);
      lines.push(`  Swap          : ${res.systemInfo.swap.used} / ${res.systemInfo.swap.total}`);
      lines.push(`  Disk          : ${res.systemInfo.disk.used} / ${res.systemInfo.disk.total} (${res.systemInfo.disk.usagePercent}%)`);
      lines.push(`  Uptime        : ${res.systemInfo.uptime}`);
      lines.push(`  Load Average  : ${res.systemInfo.loadAverage}`);
      lines.push(`  Virtualization: ${res.systemInfo.virtualization}`);
      lines.push('');
    }

    if (res.diskBenchmark) {
      lines.push('┌────────────────────────────────────────────────────────────┐');
      lines.push('│                    DISK PERFORMANCE                        │');
      lines.push('└────────────────────────────────────────────────────────────┘');
      lines.push(`  Sequential Write : ${res.diskBenchmark.sequentialWrite.speed}`);
      lines.push(`  Sequential Read  : ${res.diskBenchmark.sequentialRead.speed}`);
      lines.push(`  I/O Latency      : ${res.diskBenchmark.ioping}`);
      if (res.diskBenchmark.fio) {
        lines.push('');
        lines.push('  Random 4K IOPS (fio):');
        lines.push(`    Read IOPS   : ${res.diskBenchmark.fio.readIops}`);
        lines.push(`    Write IOPS  : ${res.diskBenchmark.fio.writeIops}`);
        lines.push(`    Read BW     : ${res.diskBenchmark.fio.readBw}`);
        lines.push(`    Write BW    : ${res.diskBenchmark.fio.writeBw}`);
      }
      lines.push('');
    }

    if (res.networkBenchmark) {
      lines.push('┌────────────────────────────────────────────────────────────┐');
      lines.push('│                    NETWORK SPEED                           │');
      lines.push('└────────────────────────────────────────────────────────────┘');
      if (res.networkBenchmark.publicIp) {
        lines.push(`  Public IP : ${res.networkBenchmark.publicIp}`);
      }
      if (res.networkBenchmark.provider) {
        lines.push(`  Provider  : ${res.networkBenchmark.provider}`);
      }
      lines.push('');
      lines.push(`  ${'Server'.padEnd(25)} ${'Location'.padEnd(25)} ${'Down'.padEnd(12)} ${'Up'.padEnd(12)} Latency`);
      lines.push(thinDivider);
      for (const test of res.networkBenchmark.tests) {
        lines.push(`  ${test.server.substring(0, 24).padEnd(25)} ${test.location.substring(0, 24).padEnd(25)} ${test.download.padEnd(12)} ${test.upload.padEnd(12)} ${test.latency}`);
      }
      lines.push('');
    }

    lines.push(divider);
    lines.push(`  Duration: ${formatDuration(res.duration)}`);
    lines.push('');
    lines.push(`  Website : https://marix.dev`);
    lines.push(`  GitHub  : https://github.com/marixdev/marix`);
    lines.push(`  Generated by Marix SSH Client`);
    lines.push(divider);

    return lines.join('\n');
  }, [serverName]);

  // Generate JSON content
  const generateJsonContent = useCallback((res: BenchmarkResult): string => {
    return JSON.stringify({
      server: serverName,
      timestamp: new Date(res.startTime).toISOString(),
      duration: res.duration,
      systemInfo: res.systemInfo,
      diskBenchmark: res.diskBenchmark,
      networkBenchmark: res.networkBenchmark,
      errors: res.errors,
      meta: {
        generator: 'Marix SSH Client',
        website: 'https://marix.dev',
        github: 'https://github.com/marixdev/marix'
      }
    }, null, 2);
  }, [serverName]);

  // Generate HTML content
  const generateHtmlContent = useCallback((res: BenchmarkResult): string => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Server Benchmark - ${serverName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            color: #e2e8f0;
            padding: 40px 20px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .header h1 { font-size: 28px; margin-bottom: 8px; color: #fff; }
        .header .server-name { color: #14b8a6; font-size: 18px; font-weight: 500; }
        .header .timestamp { color: #94a3b8; font-size: 14px; margin-top: 8px; }
        .header .duration { 
            display: inline-block; 
            background: #14b8a6; 
            color: #fff; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 14px; 
            margin-top: 12px; 
        }
        .section {
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 24px;
            overflow: hidden;
        }
        .section-header {
            background: rgba(255,255,255,0.05);
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-header .icon { font-size: 20px; }
        .section-header h2 { font-size: 16px; font-weight: 600; }
        .section-content { padding: 20px; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #94a3b8; font-size: 13px; }
        .info-value { color: #e2e8f0; font-size: 13px; font-family: 'SF Mono', Monaco, monospace; }
        .speed-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
        }
        .speed-card {
            background: rgba(20,184,166,0.1);
            border: 1px solid rgba(20,184,166,0.3);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }
        .speed-card .icon { font-size: 28px; margin-bottom: 8px; }
        .speed-card .value { font-size: 22px; font-weight: 700; color: #14b8a6; font-family: 'SF Mono', Monaco, monospace; }
        .speed-card .label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
        .fio-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
        .fio-card {
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }
        .fio-card .icon { font-size: 20px; }
        .fio-card .value { font-size: 16px; font-weight: 600; color: #f97316; font-family: 'SF Mono', Monaco, monospace; }
        .fio-card .label { font-size: 11px; color: #94a3b8; }
        .network-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .network-table th {
            text-align: left;
            padding: 12px 8px;
            background: rgba(255,255,255,0.05);
            color: #94a3b8;
            font-weight: 500;
        }
        .network-table td { padding: 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .network-table tr:hover { background: rgba(255,255,255,0.02); }
        .network-info { display: flex; gap: 24px; margin-bottom: 16px; }
        .network-info-item { display: flex; align-items: center; gap: 8px; }
        .network-info-item .label { color: #94a3b8; font-size: 13px; }
        .network-info-item .value { color: #e2e8f0; font-family: 'SF Mono', Monaco, monospace; }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #64748b;
            font-size: 13px;
        }
        .footer a { color: #14b8a6; text-decoration: none; }
        @media (max-width: 768px) {
            .info-grid { grid-template-columns: 1fr; }
            .speed-cards { grid-template-columns: 1fr; }
            .fio-cards { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Server Benchmark</h1>
            <div class="server-name">${serverName}</div>
            <div class="timestamp">${new Date(res.startTime).toLocaleString()}</div>
            <div class="duration">Duration: ${formatDuration(res.duration)}</div>
        </div>

        ${res.systemInfo ? `
        <div class="section">
            <div class="section-header">
                <span class="icon">🖥️</span>
                <h2>System Information</h2>
            </div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-row"><span class="info-label">OS</span><span class="info-value">${res.systemInfo.os}</span></div>
                    <div class="info-row"><span class="info-label">Hostname</span><span class="info-value">${res.systemInfo.hostname}</span></div>
                    <div class="info-row"><span class="info-label">Kernel</span><span class="info-value">${res.systemInfo.kernel}</span></div>
                    <div class="info-row"><span class="info-label">Arch</span><span class="info-value">${res.systemInfo.arch}</span></div>
                    <div class="info-row"><span class="info-label">CPU</span><span class="info-value">${res.systemInfo.cpu.model}</span></div>
                    <div class="info-row"><span class="info-label">CPU Freq</span><span class="info-value">${res.systemInfo.cpu.frequency}</span></div>
                    <div class="info-row"><span class="info-label">Memory</span><span class="info-value">${res.systemInfo.memory.used} / ${res.systemInfo.memory.total}</span></div>
                    <div class="info-row"><span class="info-label">Swap</span><span class="info-value">${res.systemInfo.swap.used} / ${res.systemInfo.swap.total}</span></div>
                    <div class="info-row"><span class="info-label">Disk</span><span class="info-value">${res.systemInfo.disk.used} / ${res.systemInfo.disk.total}</span></div>
                    <div class="info-row"><span class="info-label">Uptime</span><span class="info-value">${res.systemInfo.uptime}</span></div>
                    <div class="info-row"><span class="info-label">Load Average</span><span class="info-value">${res.systemInfo.loadAverage}</span></div>
                    <div class="info-row"><span class="info-label">Virtualization</span><span class="info-value">${res.systemInfo.virtualization}</span></div>
                </div>
            </div>
        </div>
        ` : ''}

        ${res.diskBenchmark ? `
        <div class="section">
            <div class="section-header">
                <span class="icon">💾</span>
                <h2>Disk Performance</h2>
            </div>
            <div class="section-content">
                <div class="speed-cards">
                    <div class="speed-card">
                        <div class="icon">✍️</div>
                        <div class="value">${res.diskBenchmark.sequentialWrite.speed}</div>
                        <div class="label">Sequential Write</div>
                    </div>
                    <div class="speed-card">
                        <div class="icon">📖</div>
                        <div class="value">${res.diskBenchmark.sequentialRead.speed}</div>
                        <div class="label">Sequential Read</div>
                    </div>
                    <div class="speed-card">
                        <div class="icon">⚡</div>
                        <div class="value">${res.diskBenchmark.ioping}</div>
                        <div class="label">I/O Latency</div>
                    </div>
                </div>
                ${res.diskBenchmark.fio ? `
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
                    <div style="font-size: 13px; color: #94a3b8; margin-bottom: 12px;">Random 4K IOPS (fio)</div>
                    <div class="fio-cards">
                        <div class="fio-card">
                            <div class="icon">📥</div>
                            <div class="value">${res.diskBenchmark.fio.readIops}</div>
                            <div class="label">Read IOPS</div>
                        </div>
                        <div class="fio-card">
                            <div class="icon">📤</div>
                            <div class="value">${res.diskBenchmark.fio.writeIops}</div>
                            <div class="label">Write IOPS</div>
                        </div>
                        <div class="fio-card">
                            <div class="icon">⬇️</div>
                            <div class="value">${res.diskBenchmark.fio.readBw}</div>
                            <div class="label">Read BW</div>
                        </div>
                        <div class="fio-card">
                            <div class="icon">⬆️</div>
                            <div class="value">${res.diskBenchmark.fio.writeBw}</div>
                            <div class="label">Write BW</div>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        ${res.networkBenchmark ? `
        <div class="section">
            <div class="section-header">
                <span class="icon">🌐</span>
                <h2>Network Speed</h2>
            </div>
            <div class="section-content">
                <div class="network-info">
                    ${res.networkBenchmark.publicIp ? `<div class="network-info-item"><span class="label">IP:</span><span class="value">${res.networkBenchmark.publicIp}</span></div>` : ''}
                    ${res.networkBenchmark.provider ? `<div class="network-info-item"><span class="label">Provider:</span><span class="value">${res.networkBenchmark.provider}</span></div>` : ''}
                </div>
                <table class="network-table">
                    <thead>
                        <tr>
                            <th>Server</th>
                            <th>Location</th>
                            <th style="text-align:right">↓ Download</th>
                            <th style="text-align:right">↑ Upload</th>
                            <th style="text-align:right">Latency</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${res.networkBenchmark.tests.map(test => `
                        <tr>
                            <td>${test.server}</td>
                            <td>${test.location}</td>
                            <td style="text-align:right; color:#22c55e">${test.download}</td>
                            <td style="text-align:right; color:#3b82f6">${test.upload}</td>
                            <td style="text-align:right">${test.latency}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <a href="https://marix.dev" target="_blank">marix.dev</a> | 
            <a href="https://github.com/marixdev/marix" target="_blank">GitHub</a><br>
            Generated by Marix SSH Client
        </div>
    </div>
</body>
</html>`;
    return html;
  }, [serverName]);

  // Upload to paste.dev (API still uses paste.ee domain)
  const uploadToPasteDev = async (content: string): Promise<string | null> => {
    try {
      const response = await fetch('https://api.paste.ee/v1/pastes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': PASTE_API_KEY
        },
        body: JSON.stringify({
          description: `Marix Benchmark - ${serverName} - ${new Date().toLocaleString()}`,
          sections: [{
            name: 'Benchmark Result',
            syntax: 'text',
            contents: content
          }]
        })
      });

      if (!response.ok) {
        console.error('Paste.dev API error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      if (data.link) {
        // Convert paste.ee to paste.dev in the returned link
        return data.link.replace('paste.ee', 'paste.dev');
      }
      if (data.id) {
        return `https://paste.dev/p/${data.id}`;
      }
      return null;
    } catch (err) {
      console.error('Failed to upload to paste.dev:', err);
      return null;
    }
  };

  // Auto-upload to paste.dev when benchmark completes (if user selected the option)
  useEffect(() => {
    const autoUpload = async () => {
      if (result && uploadToPaste && !pasteUrl && !isUploadingToPaste) {
        setIsUploadingToPaste(true);
        try {
          const content = generateTxtContent(result);
          const url = await uploadToPasteDev(content);
          if (url) {
            setPasteUrl(url);
          }
        } catch (err) {
          console.error('Auto-upload to paste.dev failed:', err);
        } finally {
          setIsUploadingToPaste(false);
        }
      }
    };
    autoUpload();
  }, [result, uploadToPaste, pasteUrl, isUploadingToPaste, generateTxtContent]);

  // Export handlers
  const handleExportTxt = async () => {
    if (!result) return;
    setIsExporting(true);
    setExportMessage(null);
    
    try {
      const content = generateTxtContent(result);
      
      // Download file
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benchmark-${serverName}-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage({ type: 'success', text: 'TXT file downloaded!' });
    } catch (err: any) {
      setExportMessage({ type: 'error', text: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    if (!result) return;
    setIsExporting(true);
    setExportMessage(null);
    
    try {
      const content = generateJsonContent(result);
      
      // Download file
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benchmark-${serverName}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage({ type: 'success', text: 'JSON file downloaded!' });
    } catch (err: any) {
      setExportMessage({ type: 'error', text: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHtml = async () => {
    if (!result) return;
    setIsExporting(true);
    setExportMessage(null);
    
    try {
      const content = generateHtmlContent(result);
      
      // Download file
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benchmark-${serverName}-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage({ type: 'success', text: 'HTML file downloaded!' });
    } catch (err: any) {
      setExportMessage({ type: 'error', text: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPng = async () => {
    if (!result) return;
    setIsExporting(true);
    setExportMessage(null);
    
    try {
      const res = result;
      // Create a styled HTML element with RGB colors (no oklch) for html2canvas compatibility
      const container = document.createElement('div');
      container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 800px;
        padding: 32px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #ffffff;
      `;
      
      // Build the PNG content with inline styles (RGB colors only)
      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
          <div style="font-size: 24px; font-weight: 600; color: #ffffff;">Marix Server Benchmark</div>
          <div style="font-size: 14px; color: #94a3b8; margin-top: 4px;">${serverName}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${new Date().toLocaleString()}</div>
        </div>
        
        ${res.systemInfo ? `
        <div style="background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 20px;">💻</span>
            <span style="font-size: 16px; font-weight: 600; color: #ffffff;">System Information</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">OS</span><span style="color: #ffffff;">${res.systemInfo.os || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">Kernel</span><span style="color: #ffffff;">${res.systemInfo.kernel || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">CPU</span><span style="color: #ffffff;">${res.systemInfo.cpu?.model || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">Cores</span><span style="color: #ffffff;">${res.systemInfo.cpu?.cores || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">RAM</span><span style="color: #ffffff;">${res.systemInfo.memory?.used || 'N/A'} / ${res.systemInfo.memory?.total || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">Disk</span><span style="color: #ffffff;">${res.systemInfo.disk?.used || 'N/A'} / ${res.systemInfo.disk?.total || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">Uptime</span><span style="color: #ffffff;">${res.systemInfo.uptime || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #94a3b8;">Virtualization</span><span style="color: #ffffff;">${res.systemInfo.virtualization || 'N/A'}</span></div>
          </div>
        </div>
        ` : ''}
        
        ${res.diskBenchmark ? `
        <div style="background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 20px;">💾</span>
            <span style="font-size: 16px; font-weight: 600; color: #ffffff;">Disk Performance</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            <div style="background: rgba(34, 197, 94, 0.1); border-radius: 8px; padding: 16px; text-align: center; border: 1px solid rgba(34, 197, 94, 0.3);">
              <div style="font-size: 24px; margin-bottom: 4px;">✍️</div>
              <div style="font-size: 20px; font-weight: 600; color: #22c55e;">${res.diskBenchmark.sequentialWrite.speed}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Seq. Write</div>
            </div>
            <div style="background: rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 16px; text-align: center; border: 1px solid rgba(59, 130, 246, 0.3);">
              <div style="font-size: 24px; margin-bottom: 4px;">📖</div>
              <div style="font-size: 20px; font-weight: 600; color: #3b82f6;">${res.diskBenchmark.sequentialRead.speed}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Seq. Read</div>
            </div>
            <div style="background: rgba(168, 85, 247, 0.1); border-radius: 8px; padding: 16px; text-align: center; border: 1px solid rgba(168, 85, 247, 0.3);">
              <div style="font-size: 24px; margin-bottom: 4px;">⚡</div>
              <div style="font-size: 20px; font-weight: 600; color: #a855f7;">${res.diskBenchmark.ioping}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">I/O Latency</div>
            </div>
          </div>
          ${res.diskBenchmark.fio ? `
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 12px;">Random 4K IOPS (fio)</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 14px; font-weight: 600; color: #22c55e;">${res.diskBenchmark.fio.readIops}</div>
                <div style="font-size: 11px; color: #64748b;">Read IOPS</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 14px; font-weight: 600; color: #3b82f6;">${res.diskBenchmark.fio.writeIops}</div>
                <div style="font-size: 11px; color: #64748b;">Write IOPS</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 14px; font-weight: 600; color: #22c55e;">${res.diskBenchmark.fio.readBw}</div>
                <div style="font-size: 11px; color: #64748b;">Read BW</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 14px; font-weight: 600; color: #3b82f6;">${res.diskBenchmark.fio.writeBw}</div>
                <div style="font-size: 11px; color: #64748b;">Write BW</div>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}
        
        ${res.networkBenchmark ? `
        <div style="background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 20px;">🌐</span>
            <span style="font-size: 16px; font-weight: 600; color: #ffffff;">Network Speed</span>
          </div>
          ${res.networkBenchmark.publicIp ? `
          <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px;">
            <span style="color: #94a3b8;">IP: <span style="color: #ffffff;">${res.networkBenchmark.publicIp}</span></span>
            ${res.networkBenchmark.provider ? `<span style="color: #94a3b8;">Provider: <span style="color: #ffffff;">${res.networkBenchmark.provider}</span></span>` : ''}
          </div>
          ` : ''}
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <th style="text-align: left; padding: 8px 0; color: #64748b; font-weight: 500;">Server</th>
                <th style="text-align: left; padding: 8px 0; color: #64748b; font-weight: 500;">Location</th>
                <th style="text-align: right; padding: 8px 0; color: #64748b; font-weight: 500;">↓ DL</th>
                <th style="text-align: right; padding: 8px 0; color: #64748b; font-weight: 500;">↑ UL</th>
                <th style="text-align: right; padding: 8px 0; color: #64748b; font-weight: 500;">Ping</th>
              </tr>
            </thead>
            <tbody>
              ${res.networkBenchmark.tests.map(test => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 8px 0; color: #ffffff;">${test.server}</td>
                <td style="padding: 8px 0; color: #94a3b8;">${test.location}</td>
                <td style="text-align: right; padding: 8px 0; color: #22c55e;">${test.download}</td>
                <td style="text-align: right; padding: 8px 0; color: #3b82f6;">${test.upload}</td>
                <td style="text-align: right; padding: 8px 0; color: #f59e0b;">${test.latency}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <div style="text-align: center; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #64748b;">
          <a href="https://marix.dev" style="color: #3b82f6; text-decoration: none;">marix.dev</a>
          <span style="margin: 0 8px;">|</span>
          <a href="https://github.com/marixdev/marix" style="color: #3b82f6; text-decoration: none;">GitHub</a>
          <div style="margin-top: 4px;">Generated by Marix SSH Client</div>
        </div>
      `;
      
      document.body.appendChild(container);
      
      // Use html2canvas to capture
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(container, {
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      // Remove the temporary container
      document.body.removeChild(container);
      
      // Convert to blob and download
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `benchmark-${serverName}-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          setExportMessage({ type: 'success', text: 'PNG image downloaded!' });
        }
      }, 'image/png');
    } catch (err: any) {
      setExportMessage({ type: 'error', text: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const isDark = appTheme === 'dark';
  const bgClass = isDark ? 'bg-navy-800' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const borderClass = isDark ? 'border-gray-700' : 'border-gray-300';
  const cardBgClass = isDark ? 'bg-navy-900' : 'bg-gray-50';
  const labelClass = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl ${bgClass} ${textClass} flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderClass}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-lg font-semibold">
                {t('serverBenchmark') || 'Server Benchmark'}
              </h2>
              <p className={`text-sm ${labelClass}`}>{serverName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className={`p-2 rounded-lg transition ${
              isRunning
                ? 'opacity-50 cursor-not-allowed'
                : isDark
                  ? 'hover:bg-gray-700'
                  : 'hover:bg-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Initial state - Start button */}
          {!isRunning && !result && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-6xl mb-6">🚀</div>
              <h3 className="text-xl font-semibold mb-2">
                {t('benchmarkReady') || 'Ready to Benchmark'}
              </h3>
              <p className={`${labelClass} mb-6 max-w-md`}>
                {t('benchmarkDescription') || 'This will test system information, disk speed, and network performance on the remote server.'}
              </p>
              
              {/* Upload to paste.dev option */}
              <label className={`flex items-center gap-2 mb-6 cursor-pointer ${labelClass} hover:${textClass}`}>
                <input
                  type="checkbox"
                  checked={uploadToPaste}
                  onChange={(e) => setUploadToPaste(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                />
                <span className="text-sm">
                  {t('uploadToPaste') || 'Upload results to paste.dev (shareable link)'}
                </span>
              </label>
              
              <button
                onClick={startBenchmark}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('startBenchmark') || 'Start Benchmark'}
              </button>
            </div>
          )}

          {/* Running state - Progress */}
          {isRunning && progress && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative w-32 h-32 mb-6">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className={isDark ? 'text-gray-700' : 'text-gray-200'}
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${progress.percent * 3.52} 352`}
                    className="text-teal-500 transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{progress.percent}%</span>
                </div>
              </div>
              <h3 className="text-lg font-medium mb-2 capitalize">{progress.phase}</h3>
              <p className={`${labelClass} text-center`}>{progress.message}</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-6xl mb-6">❌</div>
              <h3 className="text-xl font-semibold text-red-500 mb-2">
                {t('benchmarkFailed') || 'Benchmark Failed'}
              </h3>
              <p className={`${labelClass} mb-6`}>{error}</p>
              <button
                onClick={startBenchmark}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
              >
                {t('retry') || 'Try Again'}
              </button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6" ref={resultRef}>
              {/* Paste.dev link section */}
              {(pasteUrl || isUploadingToPaste) && (
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                  isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <span className="text-xl">🔗</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      {isUploadingToPaste ? 'Uploading to paste.dev...' : 'Shared on paste.dev'}
                    </div>
                    {pasteUrl && (
                      <div className="flex items-center gap-2 mt-1">
                        <code className={`text-xs px-2 py-1 rounded truncate ${
                          isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {pasteUrl}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pasteUrl);
                            setExportMessage({ type: 'success', text: 'Link copied to clipboard!' });
                          }}
                          className={`px-2 py-1 text-xs rounded transition ${
                            isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                          }`}
                        >
                          📋 Copy
                        </button>
                        <button
                          onClick={() => window.open(pasteUrl, '_blank')}
                          className={`px-2 py-1 text-xs rounded transition ${
                            isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                          }`}
                        >
                          🔗 Open
                        </button>
                      </div>
                    )}
                  </div>
                  {isUploadingToPaste && (
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  )}
                </div>
              )}

              {/* Export message */}
              {exportMessage && (
                <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
                  exportMessage.type === 'success' 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}>
                  <span>{exportMessage.type === 'success' ? '✓' : '✗'}</span>
                  <span className="flex-1">{exportMessage.text}</span>
                </div>
              )}

              {/* Export buttons */}
              <div className={`flex flex-wrap items-center gap-3 p-4 rounded-lg ${cardBgClass}`}>
                <span className={`text-sm ${labelClass}`}>{t('export') || 'Export'}:</span>
                <button
                  onClick={handleExportHtml}
                  disabled={isExporting}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition flex items-center gap-1.5 ${
                    isExporting ? 'opacity-50 cursor-not-allowed' : ''
                  } ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}`}
                >
                  <span>🌐</span> HTML
                </button>
                <button
                  onClick={handleExportJson}
                  disabled={isExporting}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition flex items-center gap-1.5 ${
                    isExporting ? 'opacity-50 cursor-not-allowed' : ''
                  } ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}`}
                >
                  <span>📋</span> JSON
                </button>
                <button
                  onClick={handleExportPng}
                  disabled={isExporting}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition flex items-center gap-1.5 ${
                    isExporting ? 'opacity-50 cursor-not-allowed' : ''
                  } ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}`}
                >
                  <span>🖼️</span> PNG
                </button>
                <button
                  onClick={handleExportTxt}
                  disabled={isExporting}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition flex items-center gap-1.5 ${
                    isExporting ? 'opacity-50 cursor-not-allowed' : ''
                  } ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'}`}
                >
                  <span>📄</span> TXT
                </button>
                {isExporting && (
                  <span className={`text-sm ${labelClass}`}>
                    {t('exporting') || 'Exporting...'}
                  </span>
                )}
              </div>

              {/* Duration banner */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${cardBgClass}`}>
                <span className={labelClass}>{t('benchmarkDuration') || 'Duration'}</span>
                <span className="font-mono font-medium">{formatDuration(result.duration)}</span>
              </div>

              {/* System Information */}
              {result.systemInfo && (
                <div className={`rounded-lg border ${borderClass} overflow-hidden`}>
                  <div className={`px-4 py-3 ${cardBgClass} border-b ${borderClass} flex items-center gap-2`}>
                    <span>🖥️</span>
                    <span className="font-semibold">{t('systemInformation') || 'System Information'}</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <InfoRow label="OS" value={result.systemInfo.os} isDark={isDark} />
                    <InfoRow label="Hostname" value={result.systemInfo.hostname} isDark={isDark} />
                    <InfoRow label="Kernel" value={result.systemInfo.kernel} isDark={isDark} />
                    <InfoRow label="Arch" value={result.systemInfo.arch} isDark={isDark} />
                    <InfoRow label="CPU" value={`${result.systemInfo.cpu.model} (${result.systemInfo.cpu.cores} cores)`} isDark={isDark} />
                    <InfoRow label="CPU Freq" value={result.systemInfo.cpu.frequency} isDark={isDark} />
                    <InfoRow 
                      label="Memory" 
                      value={`${result.systemInfo.memory.used} / ${result.systemInfo.memory.total}`}
                      badge={`${result.systemInfo.memory.usagePercent}%`}
                      badgeColor={result.systemInfo.memory.usagePercent > 80 ? 'red' : result.systemInfo.memory.usagePercent > 60 ? 'yellow' : 'green'}
                      isDark={isDark}
                    />
                    <InfoRow label="Swap" value={`${result.systemInfo.swap.used} / ${result.systemInfo.swap.total}`} isDark={isDark} />
                    <InfoRow 
                      label="Disk" 
                      value={`${result.systemInfo.disk.used} / ${result.systemInfo.disk.total}`}
                      badge={`${result.systemInfo.disk.usagePercent}%`}
                      badgeColor={result.systemInfo.disk.usagePercent > 80 ? 'red' : result.systemInfo.disk.usagePercent > 60 ? 'yellow' : 'green'}
                      isDark={isDark}
                    />
                    <InfoRow label="Uptime" value={result.systemInfo.uptime} isDark={isDark} />
                    <InfoRow label="Load Average" value={result.systemInfo.loadAverage} isDark={isDark} />
                    <InfoRow label="Virtualization" value={result.systemInfo.virtualization} isDark={isDark} />
                  </div>
                </div>
              )}

              {/* Disk Benchmark */}
              {result.diskBenchmark && (
                <div className={`rounded-lg border ${borderClass} overflow-hidden`}>
                  <div className={`px-4 py-3 ${cardBgClass} border-b ${borderClass} flex items-center gap-2`}>
                    <span>💾</span>
                    <span className="font-semibold">{t('diskPerformance') || 'Disk Performance'}</span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <SpeedCard
                        icon="✍️"
                        label={t('sequentialWrite') || 'Sequential Write'}
                        value={result.diskBenchmark.sequentialWrite.speed}
                        isDark={isDark}
                      />
                      <SpeedCard
                        icon="📖"
                        label={t('sequentialRead') || 'Sequential Read'}
                        value={result.diskBenchmark.sequentialRead.speed}
                        isDark={isDark}
                      />
                      <SpeedCard
                        icon="⚡"
                        label={t('ioLatency') || 'I/O Latency'}
                        value={result.diskBenchmark.ioping}
                        isDark={isDark}
                      />
                    </div>
                    {/* FIO Random 4K IOPS */}
                    {result.diskBenchmark.fio && (
                      <>
                        <div className={`text-xs ${labelClass} mb-2 font-medium`}>Random 4K IOPS (fio)</div>
                        <div className="grid grid-cols-4 gap-3">
                          <SpeedCard
                            icon="📥"
                            label="Read IOPS"
                            value={result.diskBenchmark.fio.readIops}
                            isDark={isDark}
                          />
                          <SpeedCard
                            icon="📤"
                            label="Write IOPS"
                            value={result.diskBenchmark.fio.writeIops}
                            isDark={isDark}
                          />
                          <SpeedCard
                            icon="⬇️"
                            label="Read BW"
                            value={result.diskBenchmark.fio.readBw}
                            isDark={isDark}
                          />
                          <SpeedCard
                            icon="⬆️"
                            label="Write BW"
                            value={result.diskBenchmark.fio.writeBw}
                            isDark={isDark}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Network Benchmark */}
              {result.networkBenchmark && (
                <div className={`rounded-lg border ${borderClass} overflow-hidden`}>
                  <div className={`px-4 py-3 ${cardBgClass} border-b ${borderClass} flex items-center gap-2`}>
                    <span>🌐</span>
                    <span className="font-semibold">{t('networkSpeed') || 'Network Speed'}</span>
                    {result.networkBenchmark.publicIp && (
                      <span className={`ml-auto text-xs ${labelClass} font-mono`}>
                        IP: {result.networkBenchmark.publicIp}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    {result.networkBenchmark.provider && (
                      <div className={`text-sm ${labelClass} mb-3`}>
                        Provider: <span className={textClass}>{result.networkBenchmark.provider}</span>
                      </div>
                    )}
                    {result.networkBenchmark.tests.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={`${labelClass} text-left`}>
                              <th className="pb-2 font-medium">Server</th>
                              <th className="pb-2 font-medium">Location</th>
                              <th className="pb-2 font-medium text-right">↓ Download</th>
                              <th className="pb-2 font-medium text-right">↑ Upload</th>
                              <th className="pb-2 font-medium text-right">Latency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.networkBenchmark.tests.map((test, idx) => (
                              <tr key={idx} className={`border-t ${borderClass}`}>
                                <td className="py-2 font-medium">{test.server}</td>
                                <td className={`py-2 ${labelClass}`}>{test.location}</td>
                                <td className="py-2 text-right font-mono text-green-400">{test.download}</td>
                                <td className="py-2 text-right font-mono text-blue-400">{test.upload}</td>
                                <td className="py-2 text-right font-mono">{test.latency}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className={labelClass}>{t('noNetworkData') || 'No network test data available'}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-center gap-2 text-yellow-500 font-medium mb-2">
                    <span>⚠️</span>
                    <span>{t('warnings') || 'Warnings'}</span>
                  </div>
                  <ul className={`text-sm ${labelClass} space-y-1`}>
                    {result.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Run again button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={startBenchmark}
                  className={`px-4 py-2 rounded-lg border ${borderClass} ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  } transition flex items-center gap-2`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('runAgain') || 'Run Again'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Info row component
interface InfoRowProps {
  label: string;
  value: string;
  badge?: string;
  badgeColor?: 'green' | 'yellow' | 'red';
  isDark: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, badge, badgeColor, isDark }) => {
  const labelClass = isDark ? 'text-gray-400' : 'text-gray-500';
  const badgeColors = {
    green: 'bg-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/20 text-red-400'
  };

  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${labelClass}`}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono truncate max-w-[200px]" title={value}>{value}</span>
        {badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${badgeColors[badgeColor || 'green']}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};

// Speed card component
interface SpeedCardProps {
  icon: string;
  label: string;
  value: string;
  isDark: boolean;
}

const SpeedCard: React.FC<SpeedCardProps> = ({ icon, label, value, isDark }) => {
  return (
    <div className={`p-4 rounded-lg text-center ${isDark ? 'bg-navy-900' : 'bg-gray-100'}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-lg font-bold font-mono text-teal-400">{value}</div>
      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</div>
    </div>
  );
};

export default BenchmarkModal;
