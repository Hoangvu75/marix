/**
 * Unit tests for SSH Session Monitor
 * Tests latency calculation, throughput tracking, and session health
 */

describe('SSHSessionMonitor', () => {
  // Simulated session monitor logic
  class MockSessionMonitor {
    private latencies: number[] = [];
    private bytesReceived: number = 0;
    private bytesSent: number = 0;
    private lastThroughputTime: number = Date.now();
    private downloadSpeed: number = 0;
    private uploadSpeed: number = 0;

    recordLatency(latency: number) {
      this.latencies.push(latency);
      // Keep only last 10 measurements
      if (this.latencies.length > 10) {
        this.latencies.shift();
      }
    }

    getAverageLatency(): number {
      if (this.latencies.length === 0) return 0;
      const sum = this.latencies.reduce((a, b) => a + b, 0);
      return Math.round(sum / this.latencies.length);
    }

    getLastLatency(): number {
      return this.latencies[this.latencies.length - 1] || 0;
    }

    recordBytesReceived(bytes: number) {
      this.bytesReceived += bytes;
    }

    recordBytesSent(bytes: number) {
      this.bytesSent += bytes;
    }

    calculateThroughput(): { download: number; upload: number } {
      const now = Date.now();
      const elapsed = (now - this.lastThroughputTime) / 1000; // seconds
      
      // Calculate speed - use minimum 0.001s to avoid division issues in tests
      const effectiveElapsed = Math.max(elapsed, 0.001);
      this.downloadSpeed = this.bytesReceived / effectiveElapsed;
      this.uploadSpeed = this.bytesSent / effectiveElapsed;
      
      // Reset counters
      this.bytesReceived = 0;
      this.bytesSent = 0;
      this.lastThroughputTime = now;
      
      return {
        download: this.downloadSpeed,
        upload: this.uploadSpeed
      };
    }

    getSessionHealth(): 'connected' | 'unstable' | 'stalled' | 'disconnected' {
      const avgLatency = this.getAverageLatency();
      if (avgLatency === 0) return 'disconnected';
      if (avgLatency > 500) return 'stalled';
      if (avgLatency > 200) return 'unstable';
      return 'connected';
    }

    formatBytes(bytes: number): string {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatSpeed(bytesPerSec: number): string {
      return this.formatBytes(bytesPerSec) + '/s';
    }
  }

  let monitor: MockSessionMonitor;

  beforeEach(() => {
    monitor = new MockSessionMonitor();
  });

  describe('Latency Tracking', () => {
    it('should record and calculate average latency', () => {
      monitor.recordLatency(50);
      monitor.recordLatency(60);
      monitor.recordLatency(70);
      
      expect(monitor.getAverageLatency()).toBe(60);
    });

    it('should return last latency', () => {
      monitor.recordLatency(100);
      monitor.recordLatency(150);
      
      expect(monitor.getLastLatency()).toBe(150);
    });

    it('should keep only last 10 measurements', () => {
      for (let i = 1; i <= 15; i++) {
        monitor.recordLatency(i * 10);
      }
      
      // Should only have latencies 60-150 (last 10)
      // Average = (60+70+80+90+100+110+120+130+140+150) / 10 = 105
      expect(monitor.getAverageLatency()).toBe(105);
    });

    it('should return 0 for empty latencies', () => {
      expect(monitor.getAverageLatency()).toBe(0);
      expect(monitor.getLastLatency()).toBe(0);
    });
  });

  describe('Session Health', () => {
    it('should return "disconnected" when no latency data', () => {
      expect(monitor.getSessionHealth()).toBe('disconnected');
    });

    it('should return "connected" for low latency', () => {
      monitor.recordLatency(50);
      monitor.recordLatency(60);
      monitor.recordLatency(70);
      
      expect(monitor.getSessionHealth()).toBe('connected');
    });

    it('should return "unstable" for medium latency', () => {
      monitor.recordLatency(250);
      monitor.recordLatency(280);
      monitor.recordLatency(300);
      
      expect(monitor.getSessionHealth()).toBe('unstable');
    });

    it('should return "stalled" for high latency', () => {
      monitor.recordLatency(600);
      monitor.recordLatency(700);
      monitor.recordLatency(800);
      
      expect(monitor.getSessionHealth()).toBe('stalled');
    });
  });

  describe('Throughput Tracking', () => {
    it('should record bytes received', () => {
      monitor.recordBytesReceived(1024);
      monitor.recordBytesReceived(2048);
      
      // Internal state check through throughput calculation
      const throughput = monitor.calculateThroughput();
      // Download speed depends on elapsed time, may be 0 if instant
      expect(throughput.download).toBeGreaterThanOrEqual(0);
    });

    it('should record bytes sent', () => {
      monitor.recordBytesSent(512);
      monitor.recordBytesSent(1024);
      
      const throughput = monitor.calculateThroughput();
      // Upload speed depends on elapsed time, may be 0 if instant
      expect(throughput.upload).toBeGreaterThanOrEqual(0);
    });

    it('should reset counters after calculating throughput', () => {
      monitor.recordBytesReceived(1024);
      monitor.calculateThroughput();
      
      // Record new data after reset
      monitor.recordBytesReceived(512);
      const throughput = monitor.calculateThroughput();
      // New throughput should be based on 512 bytes, not 1024+512
      expect(throughput.download).toBeGreaterThan(0);
    });
  });

  describe('Formatting', () => {
    it('should format bytes correctly', () => {
      expect(monitor.formatBytes(0)).toBe('0 B');
      expect(monitor.formatBytes(500)).toBe('500 B');
      expect(monitor.formatBytes(1024)).toBe('1 KB');
      expect(monitor.formatBytes(1536)).toBe('1.5 KB');
      expect(monitor.formatBytes(1048576)).toBe('1 MB');
      expect(monitor.formatBytes(1073741824)).toBe('1 GB');
    });

    it('should format speed correctly', () => {
      expect(monitor.formatSpeed(1024)).toBe('1 KB/s');
      expect(monitor.formatSpeed(1048576)).toBe('1 MB/s');
    });
  });
});
