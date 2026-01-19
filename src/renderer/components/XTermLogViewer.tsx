import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface XTermLogViewerRef {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
}

interface Props {
  height?: string;
  className?: string;
}

const XTermLogViewer = forwardRef<XTermLogViewerRef, Props>(({ height = '300px', className = '' }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useImperativeHandle(ref, () => ({
    write: (text: string) => {
      terminalRef.current?.write(text);
    },
    writeln: (text: string) => {
      terminalRef.current?.writeln(text);
    },
    clear: () => {
      terminalRef.current?.clear();
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    // Create terminal with dark theme optimized for logs
    const terminal = new Terminal({
      cursorBlink: false,
      cursorStyle: 'underline',
      disableStdin: true, // Read-only
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
      lineHeight: 1.2,
      scrollback: 5000,
      convertEol: true,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#c9d1d9',
        cursorAccent: '#0d1117',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`bg-[#0d1117] rounded-lg overflow-hidden ${className}`}
      style={{ height, padding: '8px' }}
    />
  );
});

XTermLogViewer.displayName = 'XTermLogViewer';

export default XTermLogViewer;
