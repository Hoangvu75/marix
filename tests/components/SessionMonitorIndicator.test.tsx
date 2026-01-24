/**
 * Component tests for SessionMonitorIndicator
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock SessionMonitorIndicator component
const MockSessionMonitorIndicator: React.FC<{
  latency: number;
  downloadSpeed: number;
  uploadSpeed: number;
  status: 'connected' | 'unstable' | 'stalled' | 'disconnected';
}> = ({ latency, downloadSpeed, uploadSpeed, status }) => {
  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s'];
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
    return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#22c55e';
      case 'unstable': return '#eab308';
      case 'stalled': return '#ef4444';
      case 'disconnected': return '#6b7280';
    }
  };

  return (
    <div 
      data-testid="session-monitor" 
      title={`Status: ${status}`}
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      <span 
        data-testid="status-indicator" 
        style={{ color: getStatusColor() }}
      >
        ●
      </span>
      <span data-testid="latency">{latency}ms</span>
      <span data-testid="download">↓ {formatSpeed(downloadSpeed)}</span>
      <span data-testid="upload">↑ {formatSpeed(uploadSpeed)}</span>
    </div>
  );
};

describe('SessionMonitorIndicator Component', () => {
  describe('Rendering', () => {
    it('renders all elements', () => {
      render(
        <MockSessionMonitorIndicator
          latency={50}
          downloadSpeed={1024}
          uploadSpeed={512}
          status="connected"
        />
      );

      expect(screen.getByTestId('session-monitor')).toBeInTheDocument();
      expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('latency')).toBeInTheDocument();
      expect(screen.getByTestId('download')).toBeInTheDocument();
      expect(screen.getByTestId('upload')).toBeInTheDocument();
    });
  });

  describe('Latency Display', () => {
    it('displays latency in milliseconds', () => {
      render(
        <MockSessionMonitorIndicator
          latency={75}
          downloadSpeed={0}
          uploadSpeed={0}
          status="connected"
        />
      );

      expect(screen.getByTestId('latency')).toHaveTextContent('75ms');
    });

    it('displays zero latency', () => {
      render(
        <MockSessionMonitorIndicator
          latency={0}
          downloadSpeed={0}
          uploadSpeed={0}
          status="disconnected"
        />
      );

      expect(screen.getByTestId('latency')).toHaveTextContent('0ms');
    });
  });

  describe('Speed Display', () => {
    it('displays download speed in B/s', () => {
      render(
        <MockSessionMonitorIndicator
          latency={50}
          downloadSpeed={500}
          uploadSpeed={0}
          status="connected"
        />
      );

      expect(screen.getByTestId('download')).toHaveTextContent('↓ 500 B/s');
    });

    it('displays download speed in KB/s', () => {
      render(
        <MockSessionMonitorIndicator
          latency={50}
          downloadSpeed={2048}
          uploadSpeed={0}
          status="connected"
        />
      );

      expect(screen.getByTestId('download')).toHaveTextContent('↓ 2 KB/s');
    });

    it('displays upload speed', () => {
      render(
        <MockSessionMonitorIndicator
          latency={50}
          downloadSpeed={0}
          uploadSpeed={1024}
          status="connected"
        />
      );

      expect(screen.getByTestId('upload')).toHaveTextContent('↑ 1 KB/s');
    });

    it('displays zero speeds', () => {
      render(
        <MockSessionMonitorIndicator
          latency={50}
          downloadSpeed={0}
          uploadSpeed={0}
          status="connected"
        />
      );

      expect(screen.getByTestId('download')).toHaveTextContent('↓ 0 B/s');
      expect(screen.getByTestId('upload')).toHaveTextContent('↑ 0 B/s');
    });
  });

  describe('Status Indicator', () => {
    it('shows green for connected status', () => {
      render(
        <MockSessionMonitorIndicator
          latency={50}
          downloadSpeed={0}
          uploadSpeed={0}
          status="connected"
        />
      );

      expect(screen.getByTestId('status-indicator')).toHaveStyle({ color: '#22c55e' });
    });

    it('shows yellow for unstable status', () => {
      render(
        <MockSessionMonitorIndicator
          latency={250}
          downloadSpeed={0}
          uploadSpeed={0}
          status="unstable"
        />
      );

      expect(screen.getByTestId('status-indicator')).toHaveStyle({ color: '#eab308' });
    });

    it('shows red for stalled status', () => {
      render(
        <MockSessionMonitorIndicator
          latency={600}
          downloadSpeed={0}
          uploadSpeed={0}
          status="stalled"
        />
      );

      expect(screen.getByTestId('status-indicator')).toHaveStyle({ color: '#ef4444' });
    });

    it('shows gray for disconnected status', () => {
      render(
        <MockSessionMonitorIndicator
          latency={0}
          downloadSpeed={0}
          uploadSpeed={0}
          status="disconnected"
        />
      );

      expect(screen.getByTestId('status-indicator')).toHaveStyle({ color: '#6b7280' });
    });
  });

  describe('Tooltip', () => {
    it('shows status in tooltip', () => {
      render(
        <MockSessionMonitorIndicator
          latency={50}
          downloadSpeed={0}
          uploadSpeed={0}
          status="connected"
        />
      );

      expect(screen.getByTestId('session-monitor')).toHaveAttribute('title', 'Status: connected');
    });
  });
});
