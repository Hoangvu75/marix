/**
 * Server Benchmark Service
 * 
 * Runs performance benchmarks on remote servers via SSH:
 * - System Information (OS, CPU, RAM, Disk)
 * - Disk Speed (sequential write/read)
 * - Network Speed (download/upload test)
 * 
 * Inspired by codetay.com benchmark but fully independent implementation.
 */

import { SSHConnectionManager } from './SSHConnectionManager';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Speedtest server cache interface
interface SpeedtestServer {
  id: string;
  host: string;
  name: string;
  country: string;
  sponsor: string;
  url: string;
  lat: string;
  lon: string;
  region: string; // Search region used to find this server
  failCount: number; // Track download/upload failures
  latencyFailCount: number; // Track latency/ping failures
  lastTested?: number;
}

interface SpeedtestCache {
  servers: SpeedtestServer[];
  lastUpdated: number;
}

export interface SystemInfo {
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

export interface DiskBenchmark {
  sequentialWrite: {
    speed: string;
    rawBytes: number;
  };
  sequentialRead: {
    speed: string;
    rawBytes: number;
  };
  ioping: string;
  fio?: {
    readIops: string;
    writeIops: string;
    readBw: string;
    writeBw: string;
  };
}

export interface NetworkBenchmark {
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

export interface BenchmarkResult {
  systemInfo: SystemInfo | null;
  diskBenchmark: DiskBenchmark | null;
  networkBenchmark: NetworkBenchmark | null;
  startTime: number;
  endTime: number;
  duration: number;
  errors: string[];
}

export interface BenchmarkProgress {
  phase: 'system' | 'disk' | 'network' | 'complete';
  message: string;
  percent: number;
}

type ProgressCallback = (progress: BenchmarkProgress) => void;

// Cache file path for speedtest servers
const getCachePath = () => {
  try {
    return path.join(app.getPath('userData'), 'speedtest-servers-cache.json');
  } catch {
    return path.join(process.cwd(), 'speedtest-servers-cache.json');
  }
};

export class BenchmarkService {
  private sshManager: SSHConnectionManager;
  private static serverCache: SpeedtestCache | null = null;

  // Regions to search for multi-region coverage (40+ regions)
  private static readonly SEARCH_REGIONS = [
    // === VIETNAM ===
    'Hanoi', 'Ho Chi Minh', 'Da Nang',
    // === SOUTHEAST ASIA ===
    'Singapore', 'Bangkok', 'Jakarta', 'Kuala Lumpur', 'Manila', 'Phnom Penh', 'Yangon',
    // === EAST ASIA ===
    'Tokyo', 'Hong Kong', 'Seoul', 'Taipei', 'Beijing', 'Shanghai', 'Shenzhen',
    // === SOUTH ASIA ===
    'Mumbai', 'Delhi', 'Bangalore',
    // === OCEANIA ===
    'Sydney', 'Melbourne', 'Auckland', 'Brisbane',
    // === EUROPE ===
    'London', 'Frankfurt', 'Paris', 'Amsterdam', 'Moscow', 'Stockholm', 'Madrid', 'Milan',
    // === NORTH AMERICA ===
    'Los Angeles', 'New York', 'Chicago', 'Toronto', 'Vancouver', 'Miami', 'Seattle', 'Dallas',
    // === SOUTH AMERICA ===
    'Sao Paulo', 'Buenos Aires', 'Santiago', 'Lima', 'Bogota',
    // === AFRICA ===
    'Johannesburg', 'Cape Town', 'Lagos', 'Cairo', 'Nairobi',
    // === MIDDLE EAST ===
    'Dubai', 'Tel Aviv', 'Riyadh',
    // === RUSSIA & CIS ===
    'Moscow', 'Saint Petersburg', 'Almaty',
  ];

  constructor(sshManager: SSHConnectionManager) {
    this.sshManager = sshManager;
  }

  /**
   * Load server cache from disk
   */
  private static loadCache(): SpeedtestCache | null {
    try {
      const cachePath = getCachePath();
      if (fs.existsSync(cachePath)) {
        const data = fs.readFileSync(cachePath, 'utf-8');
        const cache = JSON.parse(data) as SpeedtestCache;
        // Filter out servers with too many failures
        cache.servers = cache.servers.filter(s => s.failCount < 3);
        return cache;
      }
    } catch (err) {
      console.error('[Benchmark] Failed to load server cache:', err);
    }
    return null;
  }

  /**
   * Save server cache to disk
   */
  private static saveCache(cache: SpeedtestCache): void {
    try {
      const cachePath = getCachePath();
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    } catch (err) {
      console.error('[Benchmark] Failed to save server cache:', err);
    }
  }

  /**
   * Mark a server as failed (download/upload failure)
   */
  private static markServerFailed(serverId: string): void {
    if (!this.serverCache) return;
    
    const server = this.serverCache.servers.find(s => s.id === serverId);
    if (server) {
      server.failCount = (server.failCount || 0) + 1;
      this.saveCache(this.serverCache);
    }
  }

  /**
   * Mark a server as latency failed (ping failure)
   */
  private static markLatencyFailed(serverId: string): void {
    if (!this.serverCache) return;
    
    const server = this.serverCache.servers.find(s => s.id === serverId);
    if (server) {
      server.latencyFailCount = (server.latencyFailCount || 0) + 1;
      // Don't save immediately, will save after all tests
    }
  }

  /**
   * Get cached servers or fetch new ones
   */
  private static getServerCache(): SpeedtestCache | null {
    if (!this.serverCache) {
      this.serverCache = this.loadCache();
    }
    return this.serverCache;
  }

  /**
   * Run full benchmark suite
   */
  async runBenchmark(
    connectionId: string,
    onProgress?: ProgressCallback
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let systemInfo: SystemInfo | null = null;
    let diskBenchmark: DiskBenchmark | null = null;
    let networkBenchmark: NetworkBenchmark | null = null;

    // Phase 1: System Information
    onProgress?.({ phase: 'system', message: 'Collecting system information...', percent: 0 });
    try {
      systemInfo = await this.getSystemInfo(connectionId, onProgress);
    } catch (err: any) {
      errors.push(`System info error: ${err.message}`);
    }

    // Phase 2: Disk Benchmark
    onProgress?.({ phase: 'disk', message: 'Running disk benchmark...', percent: 40 });
    try {
      diskBenchmark = await this.runDiskBenchmark(connectionId, onProgress);
    } catch (err: any) {
      errors.push(`Disk benchmark error: ${err.message}`);
    }

    // Phase 3: Network Benchmark
    onProgress?.({ phase: 'network', message: 'Running network speed test...', percent: 70 });
    try {
      networkBenchmark = await this.runNetworkBenchmark(connectionId, onProgress);
    } catch (err: any) {
      errors.push(`Network benchmark error: ${err.message}`);
    }

    const endTime = Date.now();
    onProgress?.({ phase: 'complete', message: 'Benchmark complete!', percent: 100 });

    return {
      systemInfo,
      diskBenchmark,
      networkBenchmark,
      startTime,
      endTime,
      duration: endTime - startTime,
      errors
    };
  }

  /**
   * Collect system information
   */
  private async getSystemInfo(
    connectionId: string,
    onProgress?: ProgressCallback
  ): Promise<SystemInfo> {
    const exec = (cmd: string) => this.sshManager.executeCommand(connectionId, cmd);

    onProgress?.({ phase: 'system', message: 'Getting OS info...', percent: 5 });
    
    // OS Info
    let os = 'Unknown';
    try {
      const osRelease = await exec('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'');
      os = osRelease.trim() || 'Unknown';
    } catch {
      try {
        os = (await exec('uname -o')).trim();
      } catch {}
    }

    onProgress?.({ phase: 'system', message: 'Getting kernel info...', percent: 10 });
    
    // Kernel
    const kernel = (await exec('uname -r')).trim();
    const arch = (await exec('uname -m')).trim();
    const hostname = (await exec('hostname')).trim();

    onProgress?.({ phase: 'system', message: 'Getting uptime...', percent: 15 });
    
    // Uptime
    let uptime = 'Unknown';
    try {
      const uptimeSec = (await exec('cat /proc/uptime | cut -d. -f1')).trim();
      const seconds = parseInt(uptimeSec, 10);
      if (!isNaN(seconds)) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        uptime = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;
      }
    } catch {}

    // Load average
    const loadAverage = (await exec('cat /proc/loadavg | cut -d\' \' -f1-3')).trim();

    onProgress?.({ phase: 'system', message: 'Getting CPU info...', percent: 20 });
    
    // CPU Info
    let cpuModel = 'Unknown';
    let cpuCores = 1;
    let cpuFreq = 'Unknown';
    let cpuUsage = '0%';
    try {
      cpuModel = (await exec('cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2')).trim();
      const coresStr = (await exec('nproc')).trim();
      cpuCores = parseInt(coresStr, 10) || 1;
      
      // CPU frequency
      const freqMhz = (await exec('cat /proc/cpuinfo | grep "cpu MHz" | head -1 | cut -d: -f2')).trim();
      if (freqMhz) {
        const freq = parseFloat(freqMhz);
        cpuFreq = freq > 1000 ? `${(freq / 1000).toFixed(2)} GHz` : `${freq.toFixed(0)} MHz`;
      }
      
      // CPU usage (quick sample)
      const usage = await exec('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\'');
      cpuUsage = usage.trim() ? `${parseFloat(usage.trim()).toFixed(1)}%` : '0%';
    } catch {}

    onProgress?.({ phase: 'system', message: 'Getting memory info...', percent: 25 });
    
    // Memory Info
    let memTotal = '0';
    let memUsed = '0';
    let memFree = '0';
    let memUsagePercent = 0;
    try {
      const memInfo = await exec('free -b | grep Mem');
      const parts = memInfo.trim().split(/\s+/);
      if (parts.length >= 3) {
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        const free = parseInt(parts[3], 10);
        memTotal = this.formatBytes(total);
        memUsed = this.formatBytes(used);
        memFree = this.formatBytes(free);
        memUsagePercent = Math.round((used / total) * 100);
      }
    } catch {}

    // Swap Info
    let swapTotal = '0';
    let swapUsed = '0';
    let swapFree = '0';
    try {
      const swapInfo = await exec('free -b | grep Swap');
      const parts = swapInfo.trim().split(/\s+/);
      if (parts.length >= 3) {
        swapTotal = this.formatBytes(parseInt(parts[1], 10));
        swapUsed = this.formatBytes(parseInt(parts[2], 10));
        swapFree = this.formatBytes(parseInt(parts[3], 10));
      }
    } catch {}

    onProgress?.({ phase: 'system', message: 'Getting disk info...', percent: 30 });
    
    // Disk Info
    let diskTotal = '0';
    let diskUsed = '0';
    let diskFree = '0';
    let diskUsagePercent = 0;
    let mountPoint = '/';
    try {
      const diskInfo = await exec('df -B1 / | tail -1');
      const parts = diskInfo.trim().split(/\s+/);
      if (parts.length >= 5) {
        diskTotal = this.formatBytes(parseInt(parts[1], 10));
        diskUsed = this.formatBytes(parseInt(parts[2], 10));
        diskFree = this.formatBytes(parseInt(parts[3], 10));
        diskUsagePercent = parseInt(parts[4], 10);
        mountPoint = parts[5] || '/';
      }
    } catch {}

    onProgress?.({ phase: 'system', message: 'Getting virtualization info...', percent: 35 });
    
    // Virtualization
    let virtualization = 'Bare Metal';
    try {
      const virt = await exec('systemd-detect-virt 2>/dev/null || cat /sys/class/dmi/id/product_name 2>/dev/null | head -1');
      const virtType = virt.trim().toLowerCase();
      if (virtType === 'kvm' || virtType.includes('kvm')) virtualization = 'KVM';
      else if (virtType === 'vmware' || virtType.includes('vmware')) virtualization = 'VMware';
      else if (virtType === 'xen') virtualization = 'Xen';
      else if (virtType === 'lxc') virtualization = 'LXC';
      else if (virtType === 'docker') virtualization = 'Docker';
      else if (virtType === 'openvz') virtualization = 'OpenVZ';
      else if (virtType === 'microsoft' || virtType.includes('hyper-v')) virtualization = 'Hyper-V';
      else if (virtType.includes('virtual')) virtualization = virtType;
      else if (virtType !== 'none' && virtType !== '') virtualization = virtType;
    } catch {}

    return {
      os,
      kernel,
      arch,
      hostname,
      uptime,
      loadAverage,
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        frequency: cpuFreq,
        usage: cpuUsage
      },
      memory: {
        total: memTotal,
        used: memUsed,
        free: memFree,
        usagePercent: memUsagePercent
      },
      swap: {
        total: swapTotal,
        used: swapUsed,
        free: swapFree
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        free: diskFree,
        usagePercent: diskUsagePercent,
        mountPoint
      },
      virtualization
    };
  }

  /**
   * Run disk benchmark
   */
  private async runDiskBenchmark(
    connectionId: string,
    onProgress?: ProgressCallback
  ): Promise<DiskBenchmark> {
    const exec = (cmd: string) => this.sshManager.executeCommand(connectionId, cmd);

    onProgress?.({ phase: 'disk', message: 'Installing fio & ioping...', percent: 42 });
    
    // Install fio and ioping if not available
    try {
      // Check and install fio
      const hasFio = await exec('command -v fio >/dev/null 2>&1 && echo "yes" || echo "no"');
      if (hasFio.trim() !== 'yes') {
        // Detect package manager and install
        await exec(`
          if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -qq && sudo apt-get install -y -qq fio ioping 2>/dev/null || true
          elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y -q fio ioping 2>/dev/null || sudo yum install -y -q epel-release && sudo yum install -y -q fio ioping 2>/dev/null || true
          elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y -q fio ioping 2>/dev/null || true
          elif command -v pacman >/dev/null 2>&1; then
            sudo pacman -S --noconfirm fio ioping 2>/dev/null || true
          elif command -v apk >/dev/null 2>&1; then
            sudo apk add --quiet fio ioping 2>/dev/null || true
          elif command -v zypper >/dev/null 2>&1; then
            sudo zypper install -y -q fio ioping 2>/dev/null || true
          fi
        `);
      }
      // Check and install ioping separately if needed
      const hasIoping = await exec('command -v ioping >/dev/null 2>&1 && echo "yes" || echo "no"');
      if (hasIoping.trim() !== 'yes') {
        await exec(`
          if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get install -y -qq ioping 2>/dev/null || true
          elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y -q ioping 2>/dev/null || true
          elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y -q ioping 2>/dev/null || true
          fi
        `);
      }
    } catch {
      // Installation failed, continue anyway
    }

    onProgress?.({ phase: 'disk', message: 'Testing sequential write speed (dd)...', percent: 45 });
    
    // Determine test directory - avoid /tmp if it's tmpfs (RAM)
    // Use home directory or a directory on real disk
    let testDir = '/tmp';
    try {
      const tmpFsType = await exec("df /tmp 2>/dev/null | tail -1 | awk '{print $1}'");
      if (tmpFsType.trim() === 'tmpfs' || tmpFsType.trim().includes('tmpfs')) {
        // /tmp is RAM, use home directory or root
        const homeDir = await exec('echo $HOME');
        testDir = homeDir.trim() || '/root';
      }
    } catch {
      testDir = '/root';
    }
    
    // Cleanup any leftover test files first
    try {
      await exec(`rm -f ${testDir}/arix_test_dd ${testDir}/arix_test_read ${testDir}/arix_fio_test /tmp/arix_fio_test 2>/dev/null`);
    } catch {}
    
    // Sequential Write using tocdo.net method: LANG=C dd bs=64k count=16k (1GB)
    // Run 3 times and average
    let writeSpeed = 'N/A';
    let writeBytes = 0;
    try {
      // Use tocdo.net method: LANG=C dd bs=64k count=16k = 1GB, run 3 times
      const ddCmd = `cd ${testDir} && LANG=C dd if=/dev/zero of=arix_test_dd bs=64k count=16k conv=fdatasync 2>&1 | awk -F, '{io=$NF} END { print io}'`;
      
      const io1 = await exec(ddCmd);
      await exec(`rm -f ${testDir}/arix_test_dd`); // Cleanup after each run
      const io2 = await exec(ddCmd);
      await exec(`rm -f ${testDir}/arix_test_dd`);
      const io3 = await exec(ddCmd);
      await exec(`rm -f ${testDir}/arix_test_dd`);
      
      // Parse results (e.g., "430 MB/s" or "1.2 GB/s")
      const parseSpeed = (s: string): number => {
        const trimmed = s.trim();
        const match = trimmed.match(/^([\d.]+)\s*(GB|MB|KB)\/s$/i);
        if (match) {
          const val = parseFloat(match[1]);
          const unit = match[2].toUpperCase();
          if (unit === 'GB') return val * 1024;
          if (unit === 'KB') return val / 1024;
          return val; // MB
        }
        return 0;
      };
      
      const speed1 = parseSpeed(io1);
      const speed2 = parseSpeed(io2);
      const speed3 = parseSpeed(io3);
      
      if (speed1 > 0 || speed2 > 0 || speed3 > 0) {
        const avgSpeed = (speed1 + speed2 + speed3) / 3;
        writeBytes = 64 * 1024 * 16 * 1024; // 1GB
        if (avgSpeed >= 1024) {
          writeSpeed = `${(avgSpeed / 1024).toFixed(1)} GB/s`;
        } else {
          writeSpeed = `${avgSpeed.toFixed(1)} MB/s`;
        }
      }
    } catch {
      // Cleanup on error
      try { await exec(`rm -f ${testDir}/arix_test_dd`); } catch {}
    }

    onProgress?.({ phase: 'disk', message: 'Testing sequential read speed (dd)...', percent: 55 });
    
    // Sequential Read - create test file on real disk, clear cache, then read
    let readSpeed = 'N/A';
    let readBytes = 0;
    try {
      // Create test file first on real disk
      await exec(`cd ${testDir} && dd if=/dev/zero of=arix_test_read bs=64k count=16k conv=fdatasync 2>/dev/null`);
      // Clear cache - this is critical for accurate read test
      await exec('sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true');
      // Read test
      const readResult = await exec(`cd ${testDir} && LANG=C dd if=arix_test_read of=/dev/null bs=64k 2>&1 | awk -F, '{io=$NF} END { print io}'`);
      // Cleanup immediately after read
      await exec(`rm -f ${testDir}/arix_test_read`);
      
      const trimmed = readResult.trim();
      const match = trimmed.match(/^([\d.]+)\s*(GB|MB|KB)\/s$/i);
      if (match) {
        readBytes = 64 * 1024 * 16 * 1024; // 1GB
        const val = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        if (unit === 'GB') {
          readSpeed = `${val.toFixed(1)} GB/s`;
        } else if (unit === 'KB') {
          readSpeed = `${(val / 1024).toFixed(1)} MB/s`;
        } else {
          readSpeed = `${val.toFixed(1)} MB/s`;
        }
      }
    } catch {
      // Cleanup on error
      try { await exec(`rm -f ${testDir}/arix_test_read`); } catch {}
    }

    onProgress?.({ phase: 'disk', message: 'Testing I/O latency (ioping)...', percent: 60 });
    
    // IOPing for latency - test on root filesystem (real disk), not /tmp (may be tmpfs/RAM)
    let ioping = 'N/A';
    try {
      // Get the mount point of root filesystem
      const mountPoint = await exec("df / | tail -1 | awk '{print $NF}'");
      const testDir = mountPoint.trim() || '/';
      
      const iopingResult = await exec(`ioping -c 10 -q ${testDir} 2>&1 | tail -1`);
      // Parse: "min/avg/max/mdev = 188.4 us / 227.1 us / 261.6 us / 19.3 us"
      const avgMatch = iopingResult.match(/\/\s*([\d.]+)\s*(ms|us)\s*\//);
      if (avgMatch) {
        ioping = `${avgMatch[1]} ${avgMatch[2]}`;
      } else {
        // Alternative: just get any latency number
        const anyMatch = iopingResult.match(/([\d.]+)\s*(ms|us)/);
        if (anyMatch) {
          ioping = `${anyMatch[1]} ${anyMatch[2]}`;
        }
      }
    } catch {}

    onProgress?.({ phase: 'disk', message: 'Testing random 4K IOPS (fio)...', percent: 65 });
    
    // FIO random 4K read/write test (like tocdo.net)
    // Uses text output parsing compatible with fio v2 and v3
    let fio: DiskBenchmark['fio'] = undefined;
    try {
      // Check if fio is available
      const hasFio = await exec('command -v fio >/dev/null 2>&1 && echo "yes" || echo "no"');
      if (hasFio.trim() === 'yes') {
        // Run fio on real disk (use testDir determined earlier, or home directory)
        const fioResult = await exec(`
          cd ${testDir} && fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 \
          --name=fio_test --filename=arix_fio_test --bs=4k --numjobs=1 \
          --iodepth=64 --size=256M --readwrite=randrw --rwmixread=75 \
          --runtime=30 --time_based 2>&1
        `);
        
        // Cleanup fio test file immediately
        await exec(`rm -f ${testDir}/arix_fio_test`);
        
        // Check fio version for parsing
        const fioVersion = await exec('fio -v 2>/dev/null | cut -d "." -f 1');
        const isFio2 = fioVersion.trim() === 'fio-2';
        
        if (isFio2) {
          // fio v2: read : io=XXX, bw=XXX, iops=XXX
          const readIopsMatch = fioResult.match(/read\s*:.*iops=(\d+)/i);
          const writeIopsMatch = fioResult.match(/write\s*:.*iops=(\d+)/i);
          const readBwMatch = fioResult.match(/read\s*:.*bw=(\d+\.?\d*\s*\w+\/s)/i);
          const writeBwMatch = fioResult.match(/write\s*:.*bw=(\d+\.?\d*\s*\w+\/s)/i);
          
          fio = {
            readIops: readIopsMatch?.[1] || 'N/A',
            writeIops: writeIopsMatch?.[1] || 'N/A',
            readBw: readBwMatch?.[1] || 'N/A',
            writeBw: writeBwMatch?.[1] || 'N/A'
          };
        } else {
          // fio v3: read: IOPS=12.3k, BW=48.1MiB/s
          const readMatch = fioResult.match(/read:\s*IOPS=([\d.]+k?),\s*BW=([\d.]+\s*\w+\/s)/i);
          const writeMatch = fioResult.match(/write:\s*IOPS=([\d.]+k?),\s*BW=([\d.]+\s*\w+\/s)/i);
          
          fio = {
            readIops: readMatch?.[1] || 'N/A',
            writeIops: writeMatch?.[1] || 'N/A',
            readBw: readMatch?.[2] || 'N/A',
            writeBw: writeMatch?.[2] || 'N/A'
          };
        }
      }
    } catch {
      // Cleanup on error
      try { await exec(`rm -f ${testDir}/arix_fio_test`); } catch {}
    }

    // Final cleanup - ensure all test files are removed
    try {
      await exec(`rm -f ${testDir}/arix_test_dd ${testDir}/arix_test_read ${testDir}/arix_fio_test /tmp/arix_fio_test 2>/dev/null`);
    } catch {}

    return {
      sequentialWrite: { speed: writeSpeed, rawBytes: writeBytes },
      sequentialRead: { speed: readSpeed, rawBytes: readBytes },
      ioping,
      fio
    };
  }

  /**
   * Run network benchmark
   */
  private async runNetworkBenchmark(
    connectionId: string,
    onProgress?: ProgressCallback
  ): Promise<NetworkBenchmark> {
    const exec = (cmd: string) => this.sshManager.executeCommand(connectionId, cmd);
    const tests: NetworkBenchmark['tests'] = [];
    let provider: string | undefined;
    let publicIp: string | undefined;

    onProgress?.({ phase: 'network', message: 'Getting public IP...', percent: 72 });
    
    // Get public IP and provider
    try {
      publicIp = (await exec('curl -s -4 ifconfig.me 2>/dev/null || curl -s -4 icanhazip.com 2>/dev/null')).trim();
    } catch {}

    // Try to detect provider from IP info
    try {
      const ipInfo = await exec(`curl -s "http://ip-api.com/json/${publicIp}" 2>/dev/null`);
      const info = JSON.parse(ipInfo);
      provider = info.org || info.isp || undefined;
    } catch {}

    onProgress?.({ phase: 'network', message: 'Loading speedtest servers...', percent: 75 });
    
    // Get server list - use cache if available
    let speedtestServers: SpeedtestServer[] = [];
    const cache = BenchmarkService.getServerCache();
    
    if (cache && cache.servers.length > 0) {
      // Use cached servers (filter out failed ones - both download and latency failures)
      speedtestServers = cache.servers.filter(s => 
        (s.failCount || 0) < 3 && (s.latencyFailCount || 0) < 5
      );
      onProgress?.({ phase: 'network', message: `Using ${speedtestServers.length} cached servers...`, percent: 76 });
    }
    
    // If no cache or not enough servers, fetch from API
    if (speedtestServers.length < 20) {
      onProgress?.({ phase: 'network', message: 'Fetching servers from Speedtest.net API...', percent: 77 });
      
      const seenIds = new Set<string>(speedtestServers.map(s => s.id));
      const newServers: SpeedtestServer[] = [];
      
      // Fetch servers from multiple regions in parallel (batch of 5)
      // DO NOT limit by server count - fetch ALL regions for global coverage
      const regions = BenchmarkService.SEARCH_REGIONS;
      const batchSize = 5;
      
      for (let i = 0; i < regions.length; i += batchSize) {
        const batch = regions.slice(i, i + batchSize);
        const batchPromises = batch.map(async (region) => {
          try {
            const searchParam = `&search=${encodeURIComponent(region)}`;
            const serversJson = await exec(
              `curl -s --connect-timeout 3 --max-time 5 'https://www.speedtest.net/api/js/servers?engine=js&limit=2${searchParam}' 2>/dev/null`
            );
            const parsed = JSON.parse(serversJson);
            if (Array.isArray(parsed)) {
              return parsed.map(server => ({
                ...server,
                region: region,
                failCount: 0,
                latencyFailCount: 0,
                lastTested: undefined
              }));
            }
          } catch {}
          return [];
        });
        
        const results = await Promise.all(batchPromises);
        for (const servers of results) {
          for (const server of servers) {
            if (!seenIds.has(server.id)) {
              seenIds.add(server.id);
              newServers.push(server);
            }
          }
        }
      }
      
      console.log(`[Benchmark] Fetched ${newServers.length} new servers from Speedtest.net API`);
      
      // Merge with existing cached servers
      speedtestServers = [...speedtestServers, ...newServers];
      
      // Save to cache
      BenchmarkService.serverCache = {
        servers: speedtestServers,
        lastUpdated: Date.now()
      };
      BenchmarkService.saveCache(BenchmarkService.serverCache);
      
      onProgress?.({ phase: 'network', message: `Cached ${speedtestServers.length} servers from ${BenchmarkService.SEARCH_REGIONS.length} regions`, percent: 78 });
    }

    // Fallback: try alternative API if no servers found
    if (speedtestServers.length === 0) {
      try {
        const serversXml = await exec(
          `curl -s 'https://c.speedtest.net/speedtest-servers-static.php' 2>/dev/null | grep -oP '<server[^>]+>' | head -20`
        );
        // Parse XML servers
        const serverMatches = serversXml.matchAll(
          /url="([^"]+)".*?lat="([^"]+)".*?lon="([^"]+)".*?name="([^"]+)".*?country="([^"]+)".*?sponsor="([^"]+)".*?id="([^"]+)"/g
        );
        for (const match of serverMatches) {
          speedtestServers.push({
            id: match[7],
            url: match[1],
            lat: match[2],
            lon: match[3],
            name: match[4],
            country: match[5],
            sponsor: match[6],
            host: new URL(match[1]).host,
            region: 'global',
            failCount: 0,
            latencyFailCount: 0
          });
        }
      } catch {}
    }

    onProgress?.({ phase: 'network', message: 'Testing latency to servers...', percent: 78 });

    // Pre-select servers from each region to ensure global coverage
    // Instead of testing first 40 servers (which may all be from nearby regions)
    const serversToTest: typeof speedtestServers = [];
    const regionServerCount: { [region: string]: number } = {};
    
    // First, pick 2-3 servers from each search region
    for (const server of speedtestServers) {
      const region = server.region || 'Other';
      regionServerCount[region] = (regionServerCount[region] || 0) + 1;
      if (regionServerCount[region] <= 3) {
        serversToTest.push(server);
      }
    }
    
    console.log(`[Benchmark] Pre-selected ${serversToTest.length} servers from ${Object.keys(regionServerCount).length} regions for latency test`);

    // Test latency to each server and pick best ones per region
    const serverLatencies: Array<{
      server: typeof speedtestServers[0];
      latency: number;
    }> = [];

    for (const server of serversToTest) {
      try {
        // Extract hostname from URL (more reliable than host field)
        // host field may have ooklaserver.net domain which may not resolve
        let hostname = '';
        try {
          const urlObj = new URL(server.url);
          hostname = urlObj.hostname;
        } catch {
          // Fallback to host field, strip port
          hostname = (server.host || '').split(':')[0];
        }
        
        if (!hostname) {
          BenchmarkService.markLatencyFailed(server.id);
          continue;
        }
        
        const pingResult = await exec(`ping -c 1 -W 1 ${hostname} 2>/dev/null | grep 'time=' | sed 's/.*time=\\([0-9.]*\\).*/\\1/'`);
        const latency = parseFloat(pingResult.trim());
        if (!isNaN(latency) && latency > 0) {
          serverLatencies.push({ server, latency });
        } else {
          // Ping failed - mark latency failure
          BenchmarkService.markLatencyFailed(server.id);
        }
      } catch {
        // Ping exception - mark latency failure  
        BenchmarkService.markLatencyFailed(server.id);
      }
    }
    
    console.log(`[Benchmark] Got latency for ${serverLatencies.length} servers out of ${serversToTest.length} tested`);

    onProgress?.({ phase: 'network', message: 'Running speed tests on multi-region servers...', percent: 82 });

    // Group servers by geographic region based on their search region
    const regionGroups: { [region: string]: typeof serverLatencies } = {
      'Vietnam': [],
      'Southeast Asia': [],
      'East Asia': [],
      'South Asia': [],
      'Oceania': [],
      'Europe': [],
      'North America': [],
      'South America': [],
      'Africa': [],
      'Middle East': [],
      'Russia': [],
    };
    
    // Map search regions to geographic groups
    const regionMapping: { [key: string]: string } = {
      'Hanoi': 'Vietnam', 'Ho Chi Minh': 'Vietnam', 'Da Nang': 'Vietnam',
      'Singapore': 'Southeast Asia', 'Bangkok': 'Southeast Asia', 'Jakarta': 'Southeast Asia',
      'Kuala Lumpur': 'Southeast Asia', 'Manila': 'Southeast Asia', 'Phnom Penh': 'Southeast Asia', 'Yangon': 'Southeast Asia',
      'Tokyo': 'East Asia', 'Hong Kong': 'East Asia', 'Seoul': 'East Asia', 'Taipei': 'East Asia',
      'Beijing': 'East Asia', 'Shanghai': 'East Asia', 'Shenzhen': 'East Asia',
      'Mumbai': 'South Asia', 'Delhi': 'South Asia', 'Bangalore': 'South Asia',
      'Sydney': 'Oceania', 'Melbourne': 'Oceania', 'Auckland': 'Oceania', 'Brisbane': 'Oceania',
      'London': 'Europe', 'Frankfurt': 'Europe', 'Paris': 'Europe', 'Amsterdam': 'Europe',
      'Stockholm': 'Europe', 'Madrid': 'Europe', 'Milan': 'Europe',
      'Los Angeles': 'North America', 'New York': 'North America', 'Chicago': 'North America',
      'Toronto': 'North America', 'Vancouver': 'North America', 'Miami': 'North America',
      'Seattle': 'North America', 'Dallas': 'North America',
      'Sao Paulo': 'South America', 'Buenos Aires': 'South America', 'Santiago': 'South America',
      'Lima': 'South America', 'Bogota': 'South America',
      'Johannesburg': 'Africa', 'Cape Town': 'Africa', 'Lagos': 'Africa', 'Cairo': 'Africa', 'Nairobi': 'Africa',
      'Dubai': 'Middle East', 'Tel Aviv': 'Middle East', 'Riyadh': 'Middle East',
      'Moscow': 'Russia', 'Saint Petersburg': 'Russia', 'Almaty': 'Russia',
    };
    
    // Sort all servers by latency first
    serverLatencies.sort((a, b) => a.latency - b.latency);
    
    // Group servers into regions
    for (const entry of serverLatencies) {
      const geoRegion = regionMapping[entry.server.region] || 'Other';
      if (regionGroups[geoRegion]) {
        regionGroups[geoRegion].push(entry);
      }
    }
    
    // Select servers: 1-2 best from each region (sorted by latency within region)
    const selectedServers: typeof serverLatencies = [];
    const seenCountries = new Set<string>();
    
    // Priority order: nearby regions first, then far regions
    const regionOrder = [
      'Vietnam', 'Southeast Asia', 'East Asia', 'South Asia', 'Oceania',
      'Europe', 'North America', 'South America', 'Africa', 'Middle East', 'Russia'
    ];
    
    for (const region of regionOrder) {
      const regionServers = regionGroups[region] || [];
      let addedFromRegion = 0;
      
      for (const entry of regionServers) {
        // Add up to 2 servers per region (prefer different countries)
        if (addedFromRegion < 2 && !seenCountries.has(entry.server.country)) {
          selectedServers.push(entry);
          seenCountries.add(entry.server.country);
          addedFromRegion++;
        }
        if (addedFromRegion >= 2) break;
      }
    }
    
    // If we still need more, add any remaining servers
    if (selectedServers.length < 15) {
      for (const entry of serverLatencies) {
        if (!selectedServers.includes(entry) && selectedServers.length < 20) {
          selectedServers.push(entry);
        }
      }
    }

    console.log(`[Benchmark] Selected ${selectedServers.length} servers for testing:`, 
      selectedServers.map(s => `${s.server.sponsor} (${s.server.country})`).join(', '));

    // Test download/upload on selected servers
    for (const { server, latency } of selectedServers) {
      try {
        // Build download URL - Speedtest uses /download?size=xxx or /random4000x4000.jpg
        const baseUrl = server.url.replace(/\/upload.*$/, '');
        const downloadUrl = `${baseUrl}/random4000x4000.jpg`;
        
        // Download test (4000x4000 ~= 30MB image)
        const downloadResult = await exec(
          `curl -o /dev/null -w '%{speed_download}' -s --connect-timeout 5 --max-time 15 '${downloadUrl}' 2>/dev/null`
        );
        const downloadBps = parseFloat(downloadResult.trim());
        
        // If download failed, mark server as failed
        if (isNaN(downloadBps) || downloadBps === 0) {
          BenchmarkService.markServerFailed(server.id);
          continue;
        }
        
        const downloadMbps = (downloadBps * 8 / 1000000).toFixed(0);

        // Upload test (POST data to upload.php)
        let uploadMbps = 'N/A';
        try {
          const uploadUrl = server.url; // Already ends with /upload.php
          // Generate random data and upload using multipart form
          // Speedtest upload uses form data with content0, content1, etc.
          const uploadResult = await exec(
            `dd if=/dev/urandom bs=256K count=4 2>/dev/null | curl -o /dev/null -w '%{speed_upload}' -s --connect-timeout 5 --max-time 15 -X POST -F "content0=<-" '${uploadUrl}' 2>/dev/null`
          );
          const uploadBps = parseFloat(uploadResult.trim());
          if (!isNaN(uploadBps) && uploadBps > 0) {
            uploadMbps = `${(uploadBps * 8 / 1000000).toFixed(0)} Mbps`;
          }
        } catch {}

        // Update last tested time
        server.lastTested = Date.now();

        tests.push({
          server: server.sponsor || server.name,
          location: `${server.name}, ${server.country}`,
          download: `${downloadMbps} Mbps`,
          upload: uploadMbps,
          latency: `${latency.toFixed(2)} ms`
        });
      } catch {
        // Mark server as failed
        BenchmarkService.markServerFailed(server.id);
      }
    }
    
    // Save updated cache with test results
    if (BenchmarkService.serverCache) {
      BenchmarkService.saveCache(BenchmarkService.serverCache);
    }

    return { tests, provider, publicIp };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
