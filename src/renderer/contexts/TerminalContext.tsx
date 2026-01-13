import React, { createContext, useContext, useRef, ReactNode } from 'react';
import { Terminal as XTerm, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ipcRenderer } from 'electron';
import { terminalThemes } from '../themes';

interface TerminalInstance {
  xterm: XTerm;
  fitAddon: FitAddon;
  element: HTMLDivElement;
  isReady: boolean;
  config?: any;  // Store config for reconnect
}

interface TerminalContextType {
  getTerminal: (connectionId: string) => TerminalInstance | undefined;
  createTerminal: (connectionId: string, container: HTMLDivElement, themeName?: string, config?: any) => TerminalInstance;
  destroyTerminal: (connectionId: string) => void;
  applyTheme: (connectionId: string, themeName: string) => void;
  applyThemeToAll: (themeName: string) => void;
}

// Helper to get theme by name
const getThemeByName = (name: string): ITheme => {
  const found = terminalThemes.find(t => t.name === name);
  return found?.theme || terminalThemes[0].theme;
};

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());
  const listenersRef = useRef<Map<string, { data: any; close: any }>>(new Map());

  const getTerminal = (connectionId: string): TerminalInstance | undefined => {
    return terminalsRef.current.get(connectionId);
  };

  // Apply theme to a specific terminal
  const applyTheme = (connectionId: string, themeName: string) => {
    const instance = terminalsRef.current.get(connectionId);
    if (instance) {
      const theme = getThemeByName(themeName);
      instance.xterm.options.theme = theme;
      console.log('[TerminalContext] Applied theme:', themeName, 'to', connectionId);
    }
  };

  // Apply theme to all terminals
  const applyThemeToAll = (themeName: string) => {
    const theme = getThemeByName(themeName);
    terminalsRef.current.forEach((instance, connId) => {
      instance.xterm.options.theme = theme;
      console.log('[TerminalContext] Applied theme:', themeName, 'to', connId);
    });
  };

  const createTerminal = (connectionId: string, container: HTMLDivElement, themeName: string = 'Dracula', config?: any): TerminalInstance => {
    // Check if already exists
    let instance = terminalsRef.current.get(connectionId);
    if (instance) {
      console.log('[TerminalContext] Reusing terminal:', connectionId);
      return instance;
    }

    console.log('[TerminalContext] Creating new terminal:', connectionId, 'with theme:', themeName);

    // Get theme
    const theme = getThemeByName(themeName);

    // Create new terminal with copy/paste support (optimized for performance)
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      lineHeight: 1.2,
      theme: theme,
      scrollback: 3000,  // Reduced from 10000 for memory savings
      allowTransparency: false,
      // Enable right-click paste
      rightClickSelectsWord: true,
      // Add padding around content
      scrollOnUserInput: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Create persistent element
    const element = document.createElement('div');
    element.style.width = '100%';
    element.style.height = '100%';
    container.appendChild(element);

    xterm.open(element);
    
    // Fit and send size to SSH server
    const doFitAndResize = () => {
      fitAddon.fit();
      const { cols, rows } = xterm;
      console.log('[TerminalContext] Terminal size:', cols, 'x', rows);
      ipcRenderer.invoke('ssh:resizeShell', connectionId, cols, rows);
    };
    
    // Initial fit with small delay
    setTimeout(doFitAndResize, 100);
    // Second fit to ensure accuracy after layout stabilizes
    setTimeout(doFitAndResize, 300);

    // Copy on selection (auto copy when text is selected)
    xterm.onSelectionChange(() => {
      const selection = xterm.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    // Track if we're pasting to prevent duplicate
    let isPasting = false;

    // Handle keyboard shortcuts for copy/paste
    xterm.attachCustomKeyEventHandler((event) => {
      // Ctrl+Shift+C for copy
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        const selection = xterm.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
        return false;
      }
      
      // Ctrl+Shift+V or Ctrl+V for paste
      if ((event.ctrlKey && event.shiftKey && event.key === 'V') || 
          (event.ctrlKey && !event.shiftKey && event.key === 'v')) {
        if (event.type === 'keydown') {
          isPasting = true;
          navigator.clipboard.readText().then(text => {
            if (text) {
              ipcRenderer.invoke('ssh:writeShell', connectionId, text);
            }
            // Reset flag after a short delay
            setTimeout(() => { isPasting = false; }, 50);
          }).catch(() => { isPasting = false; });
        }
        return false;
      }
      
      return true;
    });

    // Setup IPC listeners
    const handleData = (_: any, connId: string, data: string) => {
      if (connId === connectionId) {
        xterm.write(data);
      }
    };

    const handleClose = (_: any, connId: string) => {
      if (connId === connectionId) {
        const inst = terminalsRef.current.get(connectionId);
        if (inst) {
          inst.isReady = false;
          
          // Auto reconnect if we have config
          if (inst.config) {
            xterm.writeln('\r\n\x1b[33m[Connection lost. Reconnecting...]\x1b[0m');
            
            // Attempt reconnect after 2 seconds
            setTimeout(async () => {
              try {
                const result = await ipcRenderer.invoke('ssh:connect', inst.config);
                if (result.success) {
                  inst.isReady = true;
                  xterm.writeln('\x1b[32m[Reconnected]\x1b[0m\r\n');
                } else {
                  xterm.writeln(`\x1b[31m[Reconnect failed: ${result.error}]\x1b[0m`);
                }
              } catch (err: any) {
                xterm.writeln(`\x1b[31m[Reconnect error: ${err.message}]\x1b[0m`);
              }
            }, 2000);
          } else {
            xterm.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m');
          }
        }
      }
    };

    ipcRenderer.on('ssh:shellData', handleData);
    ipcRenderer.on('ssh:shellClose', handleClose);

    // Store listeners for cleanup
    listenersRef.current.set(connectionId, { data: handleData, close: handleClose });

    // Handle user input - send immediately (but skip if pasting)
    xterm.onData(async (data) => {
      if (isPasting) return;  // Skip - already sent via paste handler
      const inst = terminalsRef.current.get(connectionId);
      if (inst) {
        await ipcRenderer.invoke('ssh:writeShell', connectionId, data);
      }
    });

    // Shell is already created during ssh:connect, just mark as ready
    const initShell = async () => {
      try {
        const { cols, rows } = xterm;
        // This just confirms shell exists (already created in connect)
        const result = await ipcRenderer.invoke('ssh:createShell', connectionId, cols, rows);
        
        if (result.success) {
          const inst = terminalsRef.current.get(connectionId);
          if (inst) {
            inst.isReady = true;
          }
          console.log('[TerminalContext] Shell ready:', connectionId);
        } else {
          xterm.writeln(`\x1b[31mShell error: ${result.error}\x1b[0m`);
        }
      } catch (err: any) {
        xterm.writeln(`\x1b[31mError: ${err.message}\x1b[0m`);
      }
    };
    
    // Mark ready immediately since native SSH already has shell
    instance = {
      xterm,
      fitAddon,
      element,
      isReady: true,  // Ready immediately with native SSH
      config: config,  // Store for auto-reconnect
    };

    terminalsRef.current.set(connectionId, instance);
    
    // Confirm shell in background
    initShell();
    
    return instance;
  };

  const destroyTerminal = (connectionId: string) => {
    const instance = terminalsRef.current.get(connectionId);
    if (instance) {
      console.log('[TerminalContext] Destroying terminal:', connectionId);
      
      // Remove listeners
      const listeners = listenersRef.current.get(connectionId);
      if (listeners) {
        ipcRenderer.removeListener('ssh:shellData', listeners.data);
        ipcRenderer.removeListener('ssh:shellClose', listeners.close);
        listenersRef.current.delete(connectionId);
      }

      // Dispose terminal
      instance.xterm.dispose();
      
      // Remove from map
      terminalsRef.current.delete(connectionId);
    }
  };

  return (
    <TerminalContext.Provider value={{ getTerminal, createTerminal, destroyTerminal, applyTheme, applyThemeToAll }}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminalContext = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminalContext must be used within TerminalProvider');
  }
  return context;
};
