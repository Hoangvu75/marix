/**
 * Session Monitor Indicator Component
 * 
 * Displays SSH session health information in a compact format:
 * - Latency indicator (RTT)
 * - Connection status
 * - Warning messages when issues detected
 * 
 * Design: Minimal, non-intrusive, only highlights problems
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

// Types matching main process
type LatencyStatus = 'stable' | 'high' | 'very-high' | 'unknown';
type ConnectionStatus = 'connected' | 'unstable' | 'stalled' | 'disconnected';

interface SessionMonitorData {
  connectionId: string;
  latency: number;
  latencyStatus: LatencyStatus;
  latencyAverage: number;
  connectionStatus: ConnectionStatus;
  shellStatus: string;
  keepaliveFailures: number;
  reconnectAttempts: number;
  lastActivity: number;
  isMonitoring: boolean;
  warning?: string;
  // Throughput data
  downloadSpeed: number;
  uploadSpeed: number;
  totalDownload: number;
  totalUpload: number;
}

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Format speed (bytes per second)
const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec === 0) return '--';
  return formatBytes(bytesPerSec) + '/s';
};

interface Props {
  connectionId: string;
  className?: string;
}

const SessionMonitorIndicator: React.FC<Props> = ({ connectionId, className = '' }) => {
  const { t } = useLanguage();
  const [monitorData, setMonitorData] = useState<SessionMonitorData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Fetch initial data and listen for updates
  useEffect(() => {
    // Skip for local terminal or undefined connectionId
    if (!connectionId || connectionId === 'local' || connectionId.startsWith('local-')) {
      return;
    }

    // Get initial data
    ipcRenderer.invoke('session-monitor:getData', connectionId).then((data: SessionMonitorData | null) => {
      if (data) setMonitorData(data);
    }).catch(() => {
      // Ignore errors - session may not be monitored yet
    });

    // Listen for updates
    const handleUpdate = (data: SessionMonitorData) => {
      if (data && data.connectionId === connectionId) {
        setMonitorData(data);
      }
    };

    const handleClosed = (closedId: string) => {
      if (closedId === connectionId) {
        setMonitorData(null);
      }
    };

    ipcRenderer.on('session-monitor:update', handleUpdate);
    ipcRenderer.on('session-monitor:closed', handleClosed);

    return () => {
      ipcRenderer.removeListener('session-monitor:update', handleUpdate);
      ipcRenderer.removeListener('session-monitor:closed', handleClosed);
    };
  }, [connectionId]);

  // Don't render for local terminal
  if (!connectionId || connectionId === 'local' || connectionId.startsWith('local-')) {
    return null;
  }

  // Show loading state while waiting for first data
  if (!monitorData) {
    return (
      <span className={`text-gray-500 text-xs ${className}`} title="Measuring...">
        ○
      </span>
    );
  }

  // Status color based on latency
  const getStatusColor = (status: LatencyStatus): string => {
    switch (status) {
      case 'stable': return 'text-green-400';
      case 'high': return 'text-yellow-400';
      case 'very-high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  // Status icon
  const getStatusIcon = (status: LatencyStatus): string => {
    switch (status) {
      case 'stable': return '●';
      case 'high': return '●';
      case 'very-high': return '●';
      default: return '○';
    }
  };

  // Connection status text
  const getConnectionText = (): string => {
    if (monitorData.warning) {
      return monitorData.warning;
    }
    switch (monitorData.connectionStatus) {
      case 'connected': return t('sessionConnected') || 'Connected';
      case 'unstable': return t('sessionUnstable') || 'Unstable';
      case 'stalled': return t('sessionStalled') || 'Stalled';
      case 'disconnected': return t('sessionDisconnected') || 'Disconnected';
      default: return '';
    }
  };

  const hasWarning = monitorData.connectionStatus !== 'connected' || monitorData.warning;
  const hasActivity = monitorData.downloadSpeed > 0 || monitorData.uploadSpeed > 0;

  return (
    <div 
      className={`relative inline-flex items-center gap-2 text-xs select-none ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Status indicator dot + Latency */}
      <div className="flex items-center gap-1">
        <span className={`${getStatusColor(monitorData.latencyStatus)} text-[10px]`}>
          {getStatusIcon(monitorData.latencyStatus)}
        </span>
        <span className={`font-mono ${monitorData.latency > 0 ? getStatusColor(monitorData.latencyStatus) : 'text-gray-500'}`}>
          {monitorData.latency > 0 ? `${monitorData.latency}ms` : '--'}
        </span>
      </div>

      {/* Throughput indicators */}
      {(hasActivity || monitorData.totalDownload > 0) && (
        <div className="flex items-center gap-1.5 text-gray-400">
          {/* Download */}
          <span className="flex items-center gap-0.5" title={`↓ ${formatBytes(monitorData.totalDownload)} total`}>
            <span className="text-green-400">↓</span>
            <span className={`font-mono ${monitorData.downloadSpeed > 0 ? 'text-green-400' : ''}`}>
              {formatSpeed(monitorData.downloadSpeed)}
            </span>
          </span>
          {/* Upload */}
          <span className="flex items-center gap-0.5" title={`↑ ${formatBytes(monitorData.totalUpload)} total`}>
            <span className="text-blue-400">↑</span>
            <span className={`font-mono ${monitorData.uploadSpeed > 0 ? 'text-blue-400' : ''}`}>
              {formatSpeed(monitorData.uploadSpeed)}
            </span>
          </span>
        </div>
      )}

      {/* Warning indicator */}
      {hasWarning && (
        <span className="text-yellow-400 animate-pulse" title={getConnectionText()}>
          ⚠
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 z-50 min-w-[220px]">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-3 text-xs">
            <div className="space-y-1.5">
              {/* Latency */}
              <div className="flex justify-between">
                <span className="text-gray-400">{t('sessionLatency') || 'Latency'}:</span>
                <span className={getStatusColor(monitorData.latencyStatus)}>
                  {monitorData.latency > 0 ? `${monitorData.latency}ms` : '--'}
                </span>
              </div>

              {/* Average latency */}
              <div className="flex justify-between">
                <span className="text-gray-400">{t('sessionLatencyAvg') || 'Average'}:</span>
                <span className="text-gray-300">
                  {monitorData.latencyAverage > 0 ? `${monitorData.latencyAverage}ms` : '--'}
                </span>
              </div>

              {/* Download speed */}
              <div className="flex justify-between">
                <span className="text-gray-400">↓ {t('sessionDownload') || 'Download'}:</span>
                <span className="text-green-400">
                  {formatSpeed(monitorData.downloadSpeed)} ({formatBytes(monitorData.totalDownload)})
                </span>
              </div>

              {/* Upload speed */}
              <div className="flex justify-between">
                <span className="text-gray-400">↑ {t('sessionUpload') || 'Upload'}:</span>
                <span className="text-blue-400">
                  {formatSpeed(monitorData.uploadSpeed)} ({formatBytes(monitorData.totalUpload)})
                </span>
              </div>

              {/* Connection status */}
              <div className="flex justify-between">
                <span className="text-gray-400">{t('sessionStatus') || 'Status'}:</span>
                <span className={hasWarning ? 'text-yellow-400' : 'text-green-400'}>
                  {getConnectionText()}
                </span>
              </div>

              {/* Keepalive failures */}
              {monitorData.keepaliveFailures > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('sessionKeepaliveFailures') || 'Keepalive Failures'}:</span>
                  <span className="text-yellow-400">{monitorData.keepaliveFailures}</span>
                </div>
              )}

              {/* Warning message */}
              {monitorData.warning && (
                <div className="pt-1.5 mt-1.5 border-t border-gray-700">
                  <span className="text-yellow-400">⚠ {monitorData.warning}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SessionMonitorIndicator);
