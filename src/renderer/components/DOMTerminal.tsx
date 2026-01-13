import React, { useEffect, useRef, useState } from 'react';
import { ipcRenderer } from 'electron';

interface Props {
  connectionId: string;
}

const DOMTerminal: React.FC<Props> = ({ connectionId }) => {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [isShellReady, setIsShellReady] = useState(false);
  const bufferRef = useRef('');

  useEffect(() => {
    console.log('[DOMTerminal] Initializing for', connectionId);

    // Setup IPC listeners
    const handleData = (_: any, connId: string, data: string) => {
      if (connId !== connectionId) return;
      
      const output = outputRef.current;
      if (!output) return;

      // Convert \r\n to <br>, escape HTML for safety
      const lines = data.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.trim() || index < lines.length - 1) {
          const lineDiv = document.createElement('div');
          lineDiv.className = 'terminal-line';
          lineDiv.style.margin = '0';
          lineDiv.style.fontFamily = 'JetBrains Mono, monospace';
          lineDiv.style.fontSize = '14px';
          lineDiv.style.whiteSpace = 'pre-wrap';
          lineDiv.style.wordBreak = 'break-all';
          
          // Basic ANSI color support
          let processedLine = line
            .replace(/\x1b\[0m/g, '</span>')
            .replace(/\x1b\[31m/g, '<span style="color:#cd3131">')
            .replace(/\x1b\[32m/g, '<span style="color:#0dbc79">')
            .replace(/\x1b\[33m/g, '<span style="color:#e5e510">')
            .replace(/\x1b\[34m/g, '<span style="color:#2472c8">')
            .replace(/\x1b\[35m/g, '<span style="color:#bc3fbc">')
            .replace(/\x1b\[36m/g, '<span style="color:#11a8cd">')
            .replace(/\x1b\[37m/g, '<span style="color:#e5e5e5">')
            .replace(/\x1b\[91m/g, '<span style="color:#f14c4c">')
            .replace(/\x1b\[92m/g, '<span style="color:#23d18b">')
            .replace(/\x1b\[93m/g, '<span style="color:#f5f543">')
            .replace(/\x1b\[94m/g, '<span style="color:#3b8eea">')
            .replace(/\x1b\[95m/g, '<span style="color:#d670d6">')
            .replace(/\x1b\[96m/g, '<span style="color:#29b8db">')
            .replace(/\x1b\[[0-9;]*m/g, ''); // Remove other ANSI codes

          lineDiv.innerHTML = processedLine || '&nbsp;';
          output.appendChild(lineDiv);
        }
      });

      // Auto-scroll to bottom
      output.scrollTop = output.scrollHeight;
    };

    const handleClose = (_: any, connId: string) => {
      if (connId === connectionId) {
        const output = outputRef.current;
        if (output) {
          const line = document.createElement('div');
          line.className = 'terminal-line';
          line.style.color = '#e5e510';
          line.textContent = '--- Connection closed ---';
          output.appendChild(line);
        }
        setIsShellReady(false);
      }
    };

    ipcRenderer.on('ssh:shellData', handleData);
    ipcRenderer.on('ssh:shellClose', handleClose);

    // Initialize shell
    const initShell = async () => {
      try {
        const result = await ipcRenderer.invoke('ssh:createShell', connectionId, 80, 24);
        
        if (result.success) {
          setIsShellReady(true);
          console.log('[DOMTerminal] Shell ready');
        } else {
          const output = outputRef.current;
          if (output) {
            const line = document.createElement('div');
            line.style.color = '#cd3131';
            line.textContent = `Failed to create shell: ${result.error}`;
            output.appendChild(line);
          }
        }
      } catch (err: any) {
        const output = outputRef.current;
        if (output) {
          const line = document.createElement('div');
          line.style.color = '#cd3131';
          line.textContent = `Error: ${err.message}`;
          output.appendChild(line);
        }
      }
    };

    setTimeout(initShell, 100);

    // Handle resize
    const handleResize = () => {
      if (isShellReady) {
        const cols = Math.floor((window.innerWidth - 300) / 9); // Rough estimate
        const rows = Math.floor(window.innerHeight / 20);
        ipcRenderer.invoke('ssh:resizeShell', connectionId, cols, rows);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      ipcRenderer.removeListener('ssh:shellData', handleData);
      ipcRenderer.removeListener('ssh:shellClose', handleClose);
      window.removeEventListener('resize', handleResize);
    };
  }, [connectionId]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isShellReady) return;

    // Ctrl+C
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x03');
      setCurrentInput('');
      return;
    }

    // Ctrl+D
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x04');
      return;
    }

    // Ctrl+L - clear
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      if (outputRef.current) {
        outputRef.current.innerHTML = '';
      }
      return;
    }

    // Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\r');
      setCurrentInput('');
      return;
    }

    // Backspace
    if (e.key === 'Backspace') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x7f');
      return;
    }

    // Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\t');
      return;
    }

    // Arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const codes: Record<string, string> = {
        'ArrowUp': '\x1b[A',
        'ArrowDown': '\x1b[B',
        'ArrowRight': '\x1b[C',
        'ArrowLeft': '\x1b[D'
      };
      await ipcRenderer.invoke('ssh:writeShell', connectionId, codes[e.key]);
      return;
    }

    // Regular characters
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, e.key);
    }
  };

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
      className="w-full h-full flex flex-col bg-[#1e1e2e] text-[#cdd6f4] font-mono"
      onClick={handleClick}
    >
      <div 
        ref={outputRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#45475a #1e1e2e'
        }}
      />
      <div className="flex items-center px-3 pb-2">
        <span className="text-[#23d18b] mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-[#cdd6f4] font-mono"
          style={{ fontSize: '14px' }}
          placeholder={isShellReady ? '' : 'Connecting...'}
          disabled={!isShellReady}
          autoFocus
        />
      </div>
    </div>
  );
};

export default DOMTerminal;
