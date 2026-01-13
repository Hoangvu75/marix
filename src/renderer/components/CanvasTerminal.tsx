import React, { useEffect, useRef, useState } from 'react';
import { ipcRenderer } from 'electron';

interface Props {
  connectionId: string;
  theme?: 'dark' | 'light';
}

interface TerminalLine {
  text: string;
  color?: string;
}

// ANSI color codes mapping
const ANSI_COLORS: Record<string, string> = {
  '30': '#000000', '31': '#cd3131', '32': '#0dbc79', '33': '#e5e510',
  '34': '#2472c8', '35': '#bc3fbc', '36': '#11a8cd', '37': '#e5e5e5',
  '90': '#666666', '91': '#f14c4c', '92': '#23d18b', '93': '#f5f543',
  '94': '#3b8eea', '95': '#d670d6', '96': '#29b8db', '97': '#ffffff',
};

const CanvasTerminal: React.FC<Props> = ({ connectionId, theme = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [isShellReady, setIsShellReady] = useState(false);
  
  const scrollPositionRef = useRef(0);
  const bufferRef = useRef('');
  
  const FONT_SIZE = 14;
  const FONT_FAMILY = 'JetBrains Mono, Fira Code, monospace';
  const LINE_HEIGHT = 20;
  const PADDING = 10;
  
  const bgColor = theme === 'dark' ? '#1e1e2e' : '#ffffff';
  const fgColor = theme === 'dark' ? '#cdd6f4' : '#000000';
  const cursorColor = theme === 'dark' ? '#f5e0dc' : '#000000';

  // Parse ANSI codes and strip them
  const parseANSI = (text: string): string => {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  };

  // Draw terminal content on canvas
  const drawTerminal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set font
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = fgColor;

    // Calculate visible lines
    const maxVisibleLines = Math.floor((canvas.height - PADDING * 2) / LINE_HEIGHT);
    const startLine = Math.max(0, lines.length - maxVisibleLines + scrollPositionRef.current);
    const visibleLines = lines.slice(startLine, startLine + maxVisibleLines);

    // Draw lines
    visibleLines.forEach((line, index) => {
      const y = PADDING + (index + 1) * LINE_HEIGHT;
      const cleanText = parseANSI(line.text);
      ctx.fillStyle = line.color || fgColor;
      ctx.fillText(cleanText, PADDING, y);
    });

    // Draw current input with prompt
    const promptY = PADDING + (visibleLines.length + 1) * LINE_HEIGHT;
    ctx.fillStyle = '#23d18b';
    ctx.fillText('$ ', PADDING, promptY);
    
    ctx.fillStyle = fgColor;
    const inputX = PADDING + ctx.measureText('$ ').width;
    ctx.fillText(currentInput, inputX, promptY);

    // Draw cursor
    if (cursorVisible && isShellReady) {
      const cursorX = inputX + ctx.measureText(currentInput).width;
      ctx.fillStyle = cursorColor;
      ctx.fillRect(cursorX, promptY - FONT_SIZE, 2, FONT_SIZE + 2);
    }
  };

  // Handle canvas resize
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    drawTerminal();

    // Notify backend of terminal size
    if (isShellReady) {
      const cols = Math.floor((rect.width - PADDING * 2) / (FONT_SIZE * 0.6));
      const rows = Math.floor((rect.height - PADDING * 2) / LINE_HEIGHT);
      ipcRenderer.invoke('ssh:resizeShell', connectionId, cols, rows);
    }
  };

  // Initialize terminal
  useEffect(() => {
    console.log('[CanvasTerminal] Initializing for', connectionId);

    // Setup IPC listeners
    const handleData = (_: any, connId: string, data: string) => {
      if (connId !== connectionId) return;

      bufferRef.current += data;
      
      // Split by newlines
      const newLines = bufferRef.current.split(/\r?\n/);
      bufferRef.current = newLines.pop() || '';

      setLines(prev => {
        const updated = [...prev];
        newLines.forEach(line => {
          if (line.trim()) {
            updated.push({ text: line });
          }
        });
        // Keep last 1000 lines
        return updated.slice(-1000);
      });
    };

    const handleClose = (_: any, connId: string) => {
      if (connId === connectionId) {
        setLines(prev => [...prev, { text: '--- Connection closed ---', color: '#e5e510' }]);
        setIsShellReady(false);
      }
    };

    ipcRenderer.on('ssh:shellData', handleData);
    ipcRenderer.on('ssh:shellClose', handleClose);

    // Create shell
    const initShell = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const cols = Math.floor((canvas.width - PADDING * 2) / (FONT_SIZE * 0.6));
        const rows = Math.floor((canvas.height - PADDING * 2) / LINE_HEIGHT);

        const result = await ipcRenderer.invoke('ssh:createShell', connectionId, cols, rows);
        
        if (result.success) {
          setIsShellReady(true);
          console.log('[CanvasTerminal] Shell ready');
        } else {
          setLines([{ text: `Failed to create shell: ${result.error}`, color: '#cd3131' }]);
        }
      } catch (err: any) {
        setLines([{ text: `Error: ${err.message}`, color: '#cd3131' }]);
      }
    };

    // Delay to ensure canvas is sized
    const timer = setTimeout(() => {
      resizeCanvas();
      initShell();
    }, 100);

    return () => {
      clearTimeout(timer);
      ipcRenderer.removeListener('ssh:shellData', handleData);
      ipcRenderer.removeListener('ssh:shellClose', handleClose);
    };
  }, [connectionId]);

  // Redraw on lines or input change
  useEffect(() => {
    drawTerminal();
  }, [lines, currentInput, cursorVisible, isShellReady]);

  // Handle resize
  useEffect(() => {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isShellReady]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 530);

    return () => clearInterval(interval);
  }, []);

  // Handle keyboard input
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (!isShellReady) return;

    // Ctrl+C - interrupt
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x03');
      setCurrentInput('');
      return;
    }

    // Ctrl+D - EOF
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x04');
      return;
    }

    // Ctrl+Z - suspend
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x1a');
      return;
    }

    // Ctrl+L - clear (just send, terminal will handle)
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x0c');
      setLines([]);
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
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

    // Home/End
    if (e.key === 'Home') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x1b[H');
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x1b[F');
      return;
    }

    // Page Up/Down
    if (e.key === 'PageUp') {
      e.preventDefault();
      scrollPositionRef.current = Math.min(scrollPositionRef.current + 10, lines.length);
      drawTerminal();
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      scrollPositionRef.current = Math.max(scrollPositionRef.current - 10, 0);
      drawTerminal();
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
      if (currentInput.length > 0) {
        setCurrentInput(prev => prev.slice(0, -1));
      }
      return;
    }

    // Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\t');
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, '\x1b');
      return;
    }

    // Regular printable characters
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      await ipcRenderer.invoke('ssh:writeShell', connectionId, e.key);
      setCurrentInput(prev => prev + e.key);
    }
  };

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
      ref={wrapperRef}
      className="w-full h-full relative"
      onClick={handleClick}
      style={{ backgroundColor: bgColor }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      <input
        ref={inputRef}
        type="text"
        className="absolute opacity-0 pointer-events-none"
        onKeyDown={handleKeyDown}
        autoFocus
      />
    </div>
  );
};

export default CanvasTerminal;
