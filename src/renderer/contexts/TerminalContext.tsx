import React, { createContext, useContext, useRef, ReactNode } from 'react';
import { Terminal as XTerm, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { getThemeSync, getTheme } from '../themeService';

const { ipcRenderer } = window.electron;

interface TerminalInstance {
  xterm: XTerm;
  fitAddon: FitAddon;
  element: HTMLDivElement;
  isReady: boolean;
  config?: any;  // Store config for reconnect
  pendingPassword?: string;  // For JS SSH: password to auto-send when prompted
  passwordSent?: boolean;  // Track if password was already sent
}

interface TerminalContextType {
  getTerminal: (connectionId: string) => TerminalInstance | undefined;
  createTerminal: (connectionId: string, container: HTMLDivElement, themeName?: string, config?: any, fontFamily?: string, pendingPassword?: string, fontSize?: number) => TerminalInstance;
  destroyTerminal: (connectionId: string) => void;
  applyTheme: (connectionId: string, themeName: string) => void;
  applyThemeToAll: (themeName: string) => void;
  applyFontToAll: (fontFamily: string) => void;
  applyFontSizeToAll: (fontSize: number) => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());
  const listenersRef = useRef<Map<string, { data: any; close: any }>>(new Map());

  const getTerminal = (connectionId: string): TerminalInstance | undefined => {
    return terminalsRef.current.get(connectionId);
  };

  // Apply theme to a specific terminal (async for non-inline themes)
  const applyTheme = async (connectionId: string, themeName: string) => {
    const instance = terminalsRef.current.get(connectionId);
    if (instance) {
      // First apply sync (instant for inline themes)
      const syncTheme = getThemeSync(themeName);
      instance.xterm.options.theme = syncTheme;

      // Then load full theme async if needed
      const asyncTheme = await getTheme(themeName);
      instance.xterm.options.theme = asyncTheme;
      console.log('[TerminalContext] Applied theme:', themeName, 'to', connectionId);
    }
  };

  // Apply theme to all terminals
  const applyThemeToAll = async (themeName: string) => {
    const theme = await getTheme(themeName);
    terminalsRef.current.forEach((instance, connId) => {
      instance.xterm.options.theme = theme;
      console.log('[TerminalContext] Applied theme:', themeName, 'to', connId);
    });
  };

  // Apply font to all terminals
  const applyFontToAll = (fontFamily: string) => {
    const fontString = `"${fontFamily}", "JetBrains Mono", "Fira Code", monospace`;
    terminalsRef.current.forEach((instance, connId) => {
      instance.xterm.options.fontFamily = fontString;
      instance.fitAddon.fit(); // Refit after font change
      console.log('[TerminalContext] Applied font:', fontFamily, 'to', connId);
    });
  };

  // Apply font size to all terminals
  const applyFontSizeToAll = (fontSize: number) => {
    terminalsRef.current.forEach((instance, connId) => {
      instance.xterm.options.fontSize = fontSize;
      instance.fitAddon.fit(); // Refit after size change
      console.log('[TerminalContext] Applied fontSize:', fontSize, 'to', connId);
    });
  };

  const createTerminal = (connectionId: string, container: HTMLDivElement, themeName: string = 'Dracula', config?: any, fontFamily?: string, pendingPassword?: string, fontSize?: number): TerminalInstance => {
    // Check if already exists
    let instance = terminalsRef.current.get(connectionId);
    if (instance) {
      console.log('[TerminalContext] Reusing terminal:', connectionId);
      return instance;
    }

    console.log('[TerminalContext] Creating new terminal:', connectionId, 'with theme:', themeName);

    // Get theme (sync for instant startup, async will update later)
    const theme = getThemeSync(themeName);

    // Create new terminal with copy/paste support (optimized for performance)
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: fontSize ?? 14,
      fontFamily: fontFamily ? `"${fontFamily}", "JetBrains Mono", "Fira Code", monospace` : '"JetBrains Mono", "Fira Code", monospace',
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
        navigator.clipboard.writeText(selection).catch(() => { });
      }
    });

    // Track if we're pasting to prevent duplicate
    let isPasting = false;

    // Handle keyboard shortcuts for copy/paste
    // Important: Only return false for keydown events we explicitly handle
    // to prevent modifier keys from getting stuck
    xterm.attachCustomKeyEventHandler((event) => {
      // Only handle keydown events
      if (event.type !== 'keydown') {
        return true;  // Let keyup events pass through normally
      }

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
        isPasting = true;
        navigator.clipboard.readText().then(text => {
          if (text) {
            ipcRenderer.invoke('ssh:writeShell', connectionId, text);
          }
          // Reset flag after a short delay
          setTimeout(() => { isPasting = false; }, 50);
        }).catch(() => { isPasting = false; });
        return false;
      }

      return true;
    });

    // Setup IPC listeners
    // Note: preload strips the event parameter, so we receive (connId, data) directly
    const handleData = (connId: string, data: string) => {
      if (connId === connectionId) {
        xterm.write(data);

        // Get the terminal instance for this connection
        const inst = terminalsRef.current.get(connectionId);

        // Detect SSH binary connection errors in terminal output.
        // NativeSSH (node-pty) always spawns immediately and returns success, so
        // actual connect failures appear as text written to the PTY by the SSH binary.
        const isSshError = (
          data.includes('ssh: connect to host') ||
          (data.includes('Connection timed out') && data.includes('port'))
        );
        if (isSshError && inst?.config) {
          const { host, port } = inst.config;
          // Stop auto-reconnect loop by clearing config
          inst.config = undefined;
          // Strip ANSI/VT100 escape sequences that the PTY injects before the error text
          // e.g. \x1b[?25l\x1b[2J\x1b[m\x1b[H → removed, leaving plain text
          // eslint-disable-next-line no-control-regex
          const cleanData = data.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/[\r\n]+/g, ' ').trim();
          // Dispatch event so App shows the error popup
          window.dispatchEvent(new CustomEvent('ssh:reconnectFailed', {
            detail: {
              host,
              port,
              error: cleanData,
            },
          }));
        }

        // Auto-send pending password when prompted (for JS SSH)
        if (inst?.pendingPassword && !inst.passwordSent) {
          const lowerData = data.toLowerCase();
          const hasPasswordPrompt =
            lowerData.includes('password:') ||
            lowerData.includes("'s password:") ||
            lowerData.includes('password for');

          if (hasPasswordPrompt) {
            console.log('[TerminalContext] Password prompt detected, auto-sending password');
            inst.passwordSent = true;
            // Small delay to ensure prompt is fully rendered
            setTimeout(() => {
              ipcRenderer.invoke('ssh:writeShell', connectionId, inst.pendingPassword + '\r');
              // Clear password after sending for security
              inst.pendingPassword = undefined;
            }, 100);
          }
        }
      }
    };

    const handleClose = (connId: string) => {
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
                // NativeSSH always returns {success:true} immediately (process is spawned
                // but not yet connected). Actual connect failures are detected in handleData
                // via SSH error text. So we just re-spawn here; handleData will catch failures.
                const result = await ipcRenderer.invoke('ssh:connect', inst.config);
                if (!result.success) {
                  // Only reaches here for non-NativeSSH paths (e.g. JS SSH)
                  xterm.writeln(`\x1b[31m[Reconnect failed: ${result.error}]\x1b[0m`);
                  window.dispatchEvent(new CustomEvent('ssh:reconnectFailed', {
                    detail: {
                      host: inst.config?.host,
                      port: inst.config?.port,
                      error: result.error || 'Unknown error',
                    },
                  }));
                }
              } catch (err: any) {
                xterm.writeln(`\x1b[31m[Reconnect error: ${err.message}]\x1b[0m`);
                window.dispatchEvent(new CustomEvent('ssh:reconnectFailed', {
                  detail: {
                    host: inst.config?.host,
                    port: inst.config?.port,
                    error: err.message || 'Unknown error',
                  },
                }));
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
      pendingPassword: pendingPassword,  // For JS SSH auto-send
      passwordSent: false,
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

      // Remove listeners first
      const listeners = listenersRef.current.get(connectionId);
      if (listeners) {
        ipcRenderer.removeListener('ssh:shellData', listeners.data);
        ipcRenderer.removeListener('ssh:shellClose', listeners.close);
        listenersRef.current.delete(connectionId);
      }

      // Get element reference before dispose
      const element = instance.xterm.element;
      const parentElement = element?.parentElement;

      // Find and disable the hidden textarea that xterm uses for keyboard input
      const textarea = element?.querySelector('textarea.xterm-helper-textarea') as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.disabled = true;
        textarea.readOnly = true;
        textarea.blur();
        // Remove all event listeners by replacing with clone
        const newTextarea = textarea.cloneNode(true) as HTMLTextAreaElement;
        textarea.parentNode?.replaceChild(newTextarea, textarea);
      }

      // Detach custom key event handler
      try {
        instance.xterm.attachCustomKeyEventHandler(() => true);
      } catch (e) {
        console.log('[TerminalContext] Error detaching key handler:', e);
      }

      // Blur terminal before disposing to release focus
      try {
        instance.xterm.blur();
        // Clear all selections
        instance.xterm.clearSelection();
      } catch (e) {
        console.log('[TerminalContext] Error blurring terminal:', e);
      }

      // Dispose fitAddon first
      try {
        instance.fitAddon.dispose();
      } catch (e) {
        console.log('[TerminalContext] Error disposing fitAddon:', e);
      }

      // Dispose terminal
      try {
        instance.xterm.dispose();
      } catch (e) {
        console.log('[TerminalContext] Error disposing terminal:', e);
      }

      // Remove element from DOM completely
      // Use the wrapper element (instance.element) instead of xterm.element
      // because xterm.element may already be detached after dispose()
      const wrapperElement = instance.element;
      const wrapperParent = wrapperElement?.parentElement;
      if (wrapperParent && wrapperElement) {
        try {
          wrapperParent.removeChild(wrapperElement);
        } catch (e) {
          console.log('[TerminalContext] Error removing element:', e);
        }
      }

      // Remove from map
      terminalsRef.current.delete(connectionId);

      console.log('[TerminalContext] Terminal destroyed:', connectionId);
    }
  };

  return (
    <TerminalContext.Provider value={{
      getTerminal,
      createTerminal,
      destroyTerminal,
      applyTheme,
      applyThemeToAll,
      applyFontToAll,
      applyFontSizeToAll,
    }}>
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
