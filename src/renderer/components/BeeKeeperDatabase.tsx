import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const { ipcRenderer } = window.electron;

interface DatabaseServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  protocol: 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'sqlite';
  database?: string;
  sslEnabled?: boolean;
  mongoUri?: string;
  sqliteFile?: string;
}

interface Props {
  server: DatabaseServer;
  connectionId: string;
  theme?: 'dark' | 'light';
  runtimeManaged?: boolean;
  onClose?: () => void;
}

interface BeeKeeperStatus {
  success: boolean;
  running: boolean;
  reachable: boolean;
  url: string;
  embedUrl?: string;
  embedPreload?: string;
  pid?: number;
  logs?: string[];
  error?: string;
}

const getBeeKeeperTheme = (theme: 'dark' | 'light'): 'dark' | 'light' =>
  theme === 'light' ? 'light' : 'dark';

const buildBeeKeeperThemeScript = (theme: 'dark' | 'light'): string => {
  const targetTheme = getBeeKeeperTheme(theme);
  return `
(() => {
  const nextTheme = ${JSON.stringify(targetTheme)};
  return (async () => {
    try {
      const appEl = document.getElementById('app');
      const vm = appEl && appEl.__vue__;
      const store = vm && vm.$store;
      let savedToStore = false;
      let appliedBodyClass = false;
      let currentTheme = null;

      if (store) {
        const settingsState = store.state && store.state.settings && store.state.settings.settings;
        currentTheme =
          (store.getters && store.getters['settings/themeValue']) ||
          (settingsState && settingsState.theme && settingsState.theme.value) ||
          null;
      }

      if (store && typeof store.dispatch === 'function' && currentTheme !== nextTheme) {
        await store.dispatch('settings/save', { key: 'theme', value: nextTheme });
        savedToStore = true;
        const refreshedState = store.state && store.state.settings && store.state.settings.settings;
        currentTheme =
          (store.getters && store.getters['settings/themeValue']) ||
          (refreshedState && refreshedState.theme && refreshedState.theme.value) ||
          currentTheme;
      }

      if (document && document.body) {
        const preserved = Array.from(document.body.classList).filter((cls) => !String(cls).startsWith('theme-'));
        document.body.className = [...preserved, 'theme-' + nextTheme].join(' ').trim();
        appliedBodyClass = document.body.classList.contains('theme-' + nextTheme);
      }

      return { ok: true, theme: nextTheme, currentTheme, savedToStore, appliedBodyClass };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  })();
})();
`;
};

const buildBeeKeeperEmbedCss = (_theme: 'dark' | 'light'): string => `
.titlebar-wrapper,
.titlebar-reveal,
.titlebar,
.titlebar.windows,
.titlebar .titlebar-actions,
.titlebar .titlebar-icon,
.titlebar .titlebar-title,
.titlebar x-menubar,
.flyout-nav > .menu-bar {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

.global-status-bar > .connection-button-wrapper,
.global-status-bar .statusbar .connection-button-wrapper,
.global-status-bar .connection-button-wrapper,
.global-status-bar .connection-button,
.global-status-bar .statusbar .connection-button {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
}

html,
body,
#app,
.style-wrapper,
.beekeeper-studio-wrapper {
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
}

body {
  margin: 0 !important;
  padding: 0 !important;
}

.connection-interface {
  display: none !important;
}

.global-status-bar,
.global-status-bar .statusbar {
  display: flex !important;
  visibility: visible !important;
}
`;

const buildBeeKeeperEmbedCssScript = (theme: 'dark' | 'light'): string => {
  const css = buildBeeKeeperEmbedCss(theme);
  return `
(() => {
  const styleId = 'marix-beekeeper-embed-style';
  const cssText = ${JSON.stringify(css)};
  const timeoutBannerText = 'beekeeper is taking too long to initialize';
  const ensureStyle = () => {
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    if (styleEl.textContent !== cssText) {
      styleEl.textContent = cssText;
    }
  };

  const setImportantStyle = (selector, styles) => {
    const nodes = document.querySelectorAll(selector);
    nodes.forEach((node) => {
      Object.entries(styles).forEach(([prop, value]) => {
        try {
          node.style.setProperty(prop, value, 'important');
        } catch {
          // ignore style failures per node
        }
      });
    });
    return nodes.length;
  };

  const hideInitTimeoutBanners = () => {
    let hidden = 0;
    const nodes = document.querySelectorAll('div, span, p');
    nodes.forEach((node) => {
      const text = String(((node && node.innerText) || node.textContent || '')).trim().toLowerCase();
      if (!text.includes(timeoutBannerText)) return;
      try {
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('height', '0', 'important');
        node.style.setProperty('overflow', 'hidden', 'important');
        hidden++;
      } catch {
        // ignore
      }
    });
    return hidden;
  };

  const enforceEmbeddedLayout = () => {
    try {
      const wrapper = document.querySelector('.beekeeper-studio-wrapper');
      if (wrapper && wrapper.classList && !wrapper.classList.contains('marix-embedded-mode')) {
        wrapper.classList.add('marix-embedded-mode');
      }
    } catch {
      // ignore
    }

    setImportantStyle('.titlebar-wrapper, .titlebar-reveal, .titlebar, .titlebar.windows, .flyout-nav > .menu-bar', {
      display: 'none',
      height: '0',
      min-height: '0',
      overflow: 'hidden',
    });
    setImportantStyle('.connection-interface', {
      display: 'none',
    });
    setImportantStyle('.global-status-bar, .global-status-bar .statusbar', {
      display: 'flex',
      visibility: 'visible',
    });
    setImportantStyle('.global-status-bar > .connection-button-wrapper, .global-status-bar .connection-button-wrapper, .global-status-bar .connection-button, .global-status-bar .statusbar .connection-button-wrapper, .global-status-bar .statusbar .connection-button', {
      display: 'none',
      width: '0',
      min-width: '0',
      overflow: 'hidden',
      'pointer-events': 'none',
    });
    hideInitTimeoutBanners();
  };

  try {
    try {
      window.sessionStorage.setItem('marixEmbed', '1');
      window.__MARIX_EMBED__ = true;
    } catch {
      // ignore storage errors
    }
    ensureStyle();
    enforceEmbeddedLayout();

    if (!window.__marixBeekeeperEmbedObserver) {
      const observer = new MutationObserver(() => {
        ensureStyle();
        enforceEmbeddedLayout();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.__marixBeekeeperEmbedObserver = observer;
    }

    if (!window.__marixBeekeeperEmbedInterval) {
      window.__marixBeekeeperEmbedInterval = window.setInterval(() => {
        ensureStyle();
        enforceEmbeddedLayout();
      }, 900);
    }

    return { ok: true, embedded: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
})();
`;
};

const buildBeeKeeperAutoOpenScript = (connectionUrl: string | null): string => {
  const targetUrl = connectionUrl || '';
  return `
(() => {
  const openUrl = ${JSON.stringify(targetUrl)};
  const normalizeUrl = (value) => String(value || '')
    .trim()
    .replace(/\\/+$/, '')
    .toLowerCase();

  const run = async () => {
    if (!openUrl) {
      return { ok: true, skipped: true, reason: 'no-url' };
    }

    const appEl = document.getElementById('app');
    const vm = appEl && appEl.__vue__;
    const store = vm && vm.$store;
    if (!store || typeof store.dispatch !== 'function') {
      return { ok: false, skipped: true, reason: 'store-not-ready' };
    }

    const state = store.state || {};
    if (state.connected) {
      const usedConfig = state.usedConfig || {};
      const currentUrl = usedConfig.url || usedConfig.fullUrl || usedConfig.connectionString || usedConfig.uri || null;
      if (currentUrl && normalizeUrl(currentUrl) === normalizeUrl(openUrl)) {
        return { ok: true, skipped: true, reason: 'already-connected-target' };
      }
    }

    const lastKey = '__marixEmbeddedLastOpenUrl';
    const inFlightKey = '__marixEmbeddedOpenUrlInFlight';
    if (window[inFlightKey] && window[lastKey] === openUrl) {
      return { ok: true, skipped: true, reason: 'in-flight' };
    }

    window[inFlightKey] = true;
    window[lastKey] = openUrl;
    try {
      await store.dispatch('openUrl', { url: openUrl, auth: null });
      return { ok: true, opened: true };
    } catch (error) {
      return { ok: false, opened: false, error: String(error) };
    } finally {
      window[inFlightKey] = false;
    }
  };

  return run();
})();
`;
};

const buildBeeKeeperConnectionProbeScript = (connectionUrl: string | null): string => `
(() => {
  const openUrl = ${JSON.stringify(connectionUrl || '')};
  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const normalizeProtocol = (value) => {
    const normalized = normalizeText(value).replace(/:$/, '');
    if (!normalized) return '';
    if (normalized === 'postgres' || normalized === 'psql') return 'postgresql';
    return normalized;
  };
  const normalizeUrl = (value) => String(value || '')
    .trim()
    .replace(/\\/+$/, '')
    .toLowerCase();
  const parseUrl = (value) => {
    try {
      const parsed = new URL(String(value || ''));
      const pathname = normalizeText(parsed.pathname || '').replace(/^\\/+/, '');
      return {
        protocol: normalizeProtocol(parsed.protocol),
        host: normalizeText(parsed.hostname),
        port: String(parsed.port || ''),
        database: pathname ? pathname.split('/')[0] : '',
        username: normalizeText(decodeURIComponent(parsed.username || '')),
      };
    } catch {
      return null;
    }
  };
  const matchesField = (a, b) => !a || !b || a === b;

  const appEl = document.getElementById('app');
  const vm = appEl && appEl.__vue__;
  const store = vm && vm.$store;
  if (!store) {
    return { ok: false, ready: false, reason: 'store-not-ready' };
  }

  const state = store.state || {};
  const connected = !!state.connected;
  const usedConfigId = state.usedConfig && state.usedConfig.id;
  const usedConfig = state.usedConfig || {};
  const currentUrl = usedConfig.url || usedConfig.fullUrl || usedConfig.connectionString || usedConfig.uri || '';

  const openTarget = parseUrl(openUrl);
  const usedTarget = {
    protocol: normalizeProtocol(usedConfig.connectionType || usedConfig.client || usedConfig.type),
    host: normalizeText(usedConfig.host || usedConfig.hostname || usedConfig.server || usedConfig.address),
    port: String(usedConfig.port || ''),
    database: normalizeText(usedConfig.defaultDatabase || usedConfig.database || usedConfig.db),
    username: normalizeText(usedConfig.user || usedConfig.username),
  };
  const hasUsedConfig =
    !!usedConfigId ||
    !!currentUrl ||
    !!usedTarget.host ||
    !!usedTarget.database ||
    !!usedTarget.username;
  const sameTargetByFields = !!openTarget && (
    matchesField(openTarget.protocol, usedTarget.protocol) &&
    matchesField(openTarget.host, usedTarget.host) &&
    matchesField(openTarget.port, usedTarget.port) &&
    matchesField(openTarget.database, usedTarget.database) &&
    matchesField(openTarget.username, usedTarget.username)
  );
  const sameTarget = openUrl
    ? (
      currentUrl
        ? normalizeUrl(currentUrl) === normalizeUrl(openUrl)
        : sameTargetByFields
    )
    : true;
  const hasConnection = connected && hasUsedConfig && (sameTarget || !openUrl || !!usedConfigId);
  return {
    ok: true,
    ready: hasConnection,
    connected,
    usedConfigId: usedConfigId || null,
    sameTarget,
    sameTargetByFields,
    hasUsedConfig,
  };
})();
`;

const BeeKeeperDatabase: React.FC<Props> = ({ server, theme = 'dark', runtimeManaged = false }) => {
  const [status, setStatus] = useState<BeeKeeperStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionReady, setConnectionReady] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webviewElement, setWebviewElement] = useState<any>(null);
  const autoStartKeyRef = useRef<string | null>(null);
  const webviewRef = useRef<any>(null);
  const webviewReadyRef = useRef(false);
  const themeRetryTimersRef = useRef<number[]>([]);
  const autoOpenRetryTimersRef = useRef<number[]>([]);
  const connectionProbeTimersRef = useRef<number[]>([]);
  const connectionProbeIntervalRef = useRef<number | null>(null);

  const connectionPreview = useMemo(() => {
    const dbName = server.database || '';
    const host = server.host || 'localhost';
    const port = server.port || (server.protocol === 'postgresql' ? 5432 : 3306);
    if (server.protocol === 'postgresql') {
      return `postgresql://${server.username}@${host}:${port}/${dbName}`;
    }
    if (server.protocol === 'mysql') {
      return `mysql://${server.username}@${host}:${port}/${dbName}`;
    }
    if (server.protocol === 'sqlite') {
      return server.sqliteFile || ':memory:';
    }
    return `${server.protocol}://${host}:${port}`;
  }, [server]);

  const connectionUrl = useMemo(() => buildConnectionUrl(server), [server]);
  const hasConnectionTarget = !!connectionUrl;

  const bumpConnectionProgress = useCallback((nextValue: number) => {
    const bounded = Math.max(0, Math.min(100, Math.floor(nextValue)));
    setConnectionProgress((prev) => (bounded > prev ? bounded : prev));
  }, []);

  const refreshStatus = async () => {
    try {
      const result = await ipcRenderer.invoke('beekeeper:status');
      setStatus(result);
    } catch (err: any) {
      setError(err.message || 'Failed to check BeeKeeper status');
    }
  };

  const startBeeKeeper = async () => {
    setLoading(true);
    setError(null);
    setConnectionReady(!connectionUrl);
    setConnectionProgress(connectionUrl ? 8 : 100);
    try {
      const result = await ipcRenderer.invoke('beekeeper:start', { connectionUrl });
      if (!result.success) {
        setError(result.error || 'Failed to start BeeKeeper');
      } else {
        // Apply optimistic status immediately to avoid interim blank screen
        // before the first explicit status refresh completes.
        setStatus((prev) => ({
          ...(prev || {}),
          ...result,
        }));
        bumpConnectionProgress(24);
      }
      await refreshStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to start BeeKeeper');
    } finally {
      setLoading(false);
    }
  };

  const setWebviewNode = (node: any) => {
    webviewRef.current = node || null;
    setWebviewElement(node || null);
  };

  const stopBeeKeeper = async () => {
    setLoading(true);
    setError(null);
    try {
      await ipcRenderer.invoke('beekeeper:stop');
      await refreshStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to stop BeeKeeper');
    } finally {
      setLoading(false);
    }
  };

  const stopBeeKeeperSilently = async () => {
    if (runtimeManaged) return;
    try {
      await ipcRenderer.invoke('beekeeper:stop');
    } catch {
      // Ignore teardown errors during unmount.
    }
  };

  const clearThemeRetryTimers = () => {
    if (!themeRetryTimersRef.current.length) return;
    themeRetryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    themeRetryTimersRef.current = [];
  };

  const clearAutoOpenRetryTimers = () => {
    if (!autoOpenRetryTimersRef.current.length) return;
    autoOpenRetryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    autoOpenRetryTimersRef.current = [];
  };

  const clearConnectionProbeTimers = () => {
    if (!connectionProbeTimersRef.current.length) return;
    connectionProbeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    connectionProbeTimersRef.current = [];
  };

  const clearConnectionProbeInterval = () => {
    if (connectionProbeIntervalRef.current !== null) {
      window.clearInterval(connectionProbeIntervalRef.current);
      connectionProbeIntervalRef.current = null;
    }
  };

  const markConnectionReady = (ready: boolean) => {
    setConnectionReady(ready);
    if (ready) {
      setConnectionProgress(100);
      clearConnectionProbeTimers();
      clearConnectionProbeInterval();
    }
  };

  const attemptAutoOpen = async (webview: any): Promise<void> => {
    if (!webview || !connectionUrl) return;

    try {
      await webview.executeJavaScript(buildBeeKeeperAutoOpenScript(connectionUrl), true);
    } catch {
      // Non-critical: connection auto-open fallback should not block rendering.
    }
  };

  const probeConnectionReady = async (webview: any): Promise<boolean> => {
    if (!webview) return false;
    if (!connectionUrl) {
      markConnectionReady(true);
      return true;
    }

    try {
      const probe = await webview.executeJavaScript(buildBeeKeeperConnectionProbeScript(connectionUrl), true);
      const isReady = !!probe?.ok && !!probe?.ready;
      if (isReady) {
        markConnectionReady(true);
      } else {
        bumpConnectionProgress(86);
      }
      return isReady;
    } catch {
      bumpConnectionProgress(82);
      return false;
    }
  };

  const scheduleThemeReapply = (webview: any) => {
    clearThemeRetryTimers();
    const retryDelays = [180, 500, 1200, 2500, 5000, 9000, 14000];
    themeRetryTimersRef.current = retryDelays.map((delay) =>
      window.setTimeout(() => {
        if (webviewRef.current === webview && webviewReadyRef.current) {
          void applyWebviewCustomizations(webview);
        }
      }, delay),
    );
  };

  const scheduleAutoOpenRetry = (webview: any) => {
    clearAutoOpenRetryTimers();
    const retryDelays = [120, 450, 1000, 1800, 3200, 6000, 10000];
    autoOpenRetryTimersRef.current = retryDelays.map((delay) =>
      window.setTimeout(() => {
        if (webviewRef.current === webview && webviewReadyRef.current) {
          void attemptAutoOpen(webview);
        }
      }, delay),
    );
  };

  const scheduleConnectionProbe = (webview: any) => {
    clearConnectionProbeTimers();
    clearConnectionProbeInterval();

    if (!connectionUrl) {
      markConnectionReady(true);
      return;
    }

    const retryDelays = [120, 350, 700, 1200, 1800, 2800, 4200, 6000, 8500, 12000];
    connectionProbeTimersRef.current = retryDelays.map((delay) =>
      window.setTimeout(() => {
        if (webviewRef.current === webview && webviewReadyRef.current) {
          void probeConnectionReady(webview);
        }
      }, delay),
    );

    const fallbackTimer = window.setTimeout(() => {
      if (webviewRef.current !== webview || !webviewReadyRef.current) return;
      // Do not block the UI forever if BeeKeeper reports connected state late.
      markConnectionReady(true);
    }, 9000);
    connectionProbeTimersRef.current.push(fallbackTimer);

    connectionProbeIntervalRef.current = window.setInterval(() => {
      if (webviewRef.current === webview && webviewReadyRef.current) {
        void attemptAutoOpen(webview);
        void probeConnectionReady(webview);
      }
    }, 3000);
  };

  const applyWebviewCustomizations = async (webview: any) => {
    if (!webview) return;

    try {
      await webview.executeJavaScript(buildBeeKeeperThemeScript(theme), true);
    } catch {
      // Ignore non-critical theme injection failures.
    }

    try {
      await webview.executeJavaScript(buildBeeKeeperEmbedCssScript(theme), true);
    } catch {
      // Ignore non-critical style injection failures.
    }

    bumpConnectionProgress(70);
    await attemptAutoOpen(webview);
    bumpConnectionProgress(80);
    await probeConnectionReady(webview);
  };

  const openExternal = async () => {
    const url = status?.embedUrl || status?.url || 'http://127.0.0.1:3003/';
    await window.electron.shell.openExternal(url);
  };

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(refreshStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      clearThemeRetryTimers();
      clearAutoOpenRetryTimers();
      clearConnectionProbeTimers();
      clearConnectionProbeInterval();
      void stopBeeKeeperSilently();
    };
  }, [runtimeManaged]);

  useEffect(() => {
    const key = [
      server.protocol,
      server.host || '',
      String(server.port || ''),
      server.username || '',
      server.database || '',
      String(!!server.sslEnabled),
      server.mongoUri || '',
      server.sqliteFile || '',
    ].join('|');

    if (autoStartKeyRef.current === key) return;
    autoStartKeyRef.current = key;

    if (runtimeManaged) {
      void refreshStatus();
      return;
    }

    void startBeeKeeper();
  }, [
    server.protocol,
    server.host,
    server.port,
    server.username,
    server.database,
    server.sslEnabled,
    server.mongoUri,
    server.sqliteFile,
    runtimeManaged,
  ]);

  const embedUrl = status?.embedUrl || status?.url || null;
  const shouldRenderWebview = !!embedUrl;
  const shouldShowBlockingOverlay = loading && !shouldRenderWebview;
  const shouldShowConnectionSpinner = !shouldShowBlockingOverlay && hasConnectionTarget && !connectionReady;

  useEffect(() => {
    const webview = webviewElement;
    if (!webview) return;

    const handleConsoleMessage = (event: any) => {
      const level = Number(event?.level ?? 0);
      if (level < 2) return;
      // Console errors are still visible in logs; avoid noisy blocking banner.
    };

    const handleDidFailLoad = (event: any) => {
      const msg = `BeeKeeper webview failed to load (${event?.errorCode || 'unknown'}): ${event?.errorDescription || 'unknown error'}`;
      // Keep runtime visible and only surface this via logs.
      console.warn('[BeeKeeper webview] did-fail-load:', msg);
      setShowLogs(true);
    };

    const handleCrashed = () => {
      console.error('[BeeKeeper webview] render process gone');
      setShowLogs(true);
    };

    const handleDomReady = async () => {
      try {
        webviewReadyRef.current = true;
        bumpConnectionProgress(45);
        await applyWebviewCustomizations(webview);
        scheduleThemeReapply(webview);
        scheduleAutoOpenRetry(webview);
        scheduleConnectionProbe(webview);
        const probe = await webview.executeJavaScript(
          'JSON.stringify({ hasMain: typeof window.main, hasPlatformInfo: typeof window.platformInfo, hasConfigSource: typeof window.bksConfigSource })',
          true,
        );
        if (typeof probe === 'string' && probe.includes('"hasMain":"undefined"')) {
          console.warn('[BeeKeeper webview] preload bridge probe:', probe);
          setShowLogs(true);
        }
      } catch (err: any) {
        console.warn('[BeeKeeper webview] probe failed:', err?.message || err);
        setShowLogs(true);
      }
    };

    const handleDidStopLoading = async () => {
      webviewReadyRef.current = true;
      bumpConnectionProgress(58);
      await applyWebviewCustomizations(webview);
      scheduleThemeReapply(webview);
      scheduleAutoOpenRetry(webview);
      scheduleConnectionProbe(webview);
    };

    const handleDidNavigate = async () => {
      webviewReadyRef.current = true;
      bumpConnectionProgress(62);
      await applyWebviewCustomizations(webview);
      scheduleThemeReapply(webview);
      scheduleAutoOpenRetry(webview);
      scheduleConnectionProbe(webview);
    };

    webview.addEventListener('console-message', handleConsoleMessage);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);
    webview.addEventListener('render-process-gone', handleCrashed);
    webview.addEventListener('dom-ready', handleDomReady);

    // Fallback in case lifecycle events fire before listeners are attached.
    const kickoffTimer = window.setTimeout(() => {
      if (webviewRef.current !== webview) return;
      webviewReadyRef.current = true;
      void applyWebviewCustomizations(webview);
      scheduleThemeReapply(webview);
      scheduleAutoOpenRetry(webview);
      scheduleConnectionProbe(webview);
    }, 120);

    return () => {
      window.clearTimeout(kickoffTimer);
      clearThemeRetryTimers();
      clearAutoOpenRetryTimers();
      clearConnectionProbeTimers();
      clearConnectionProbeInterval();
      webview.removeEventListener('console-message', handleConsoleMessage);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
      webview.removeEventListener('render-process-gone', handleCrashed);
      webview.removeEventListener('dom-ready', handleDomReady);
    };
  }, [webviewElement, status?.embedUrl, status?.embedPreload, theme, bumpConnectionProgress]);

  useEffect(() => {
    webviewReadyRef.current = false;
    clearConnectionProbeTimers();
    clearConnectionProbeInterval();
    setConnectionReady(!connectionUrl);
    setConnectionProgress(connectionUrl ? 12 : 100);
  }, [status?.embedUrl, connectionUrl]);

  useEffect(() => {
    if (!hasConnectionTarget || connectionReady) return undefined;
    const timer = window.setInterval(() => {
      setConnectionProgress((prev) => {
        if (prev >= 92) return prev;
        if (prev < 30) return prev + 4;
        if (prev < 70) return prev + 2;
        return prev + 1;
      });
    }, 420);

    return () => window.clearInterval(timer);
  }, [hasConnectionTarget, connectionReady, status?.embedUrl]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !webviewReadyRef.current) return;
    void applyWebviewCustomizations(webview);
  }, [theme, status?.embedUrl]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowLogs((prev) => !prev)}
          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
            theme === 'light'
              ? 'border border-gray-300 bg-white/90 text-gray-700 hover:bg-gray-50'
              : 'border border-navy-600 bg-navy-900/80 text-gray-200 hover:bg-navy-800'
          }`}
        >
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </button>
      </div>

      {error && (
        <div className="absolute left-3 right-3 top-14 z-20 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="h-full w-full relative">
        {shouldRenderWebview && (
          <div className="h-full w-full">
            {React.createElement('webview', {
              ref: setWebviewNode,
              key: embedUrl,
              src: embedUrl,
              preload: status?.embedPreload || undefined,
              webpreferences: 'contextIsolation=yes,sandbox=no',
              partition: 'persist:marix-beekeeper',
              style: { width: '100%', height: '100%', border: '0', background: 'transparent' },
              allowpopups: true,
            })}
          </div>
        )}

        {shouldShowBlockingOverlay && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center ${
              theme === 'light' ? 'bg-gray-50 text-gray-500' : 'bg-navy-900 text-gray-400'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full border-2 border-t-transparent animate-spin ${
                  theme === 'light' ? 'border-gray-400' : 'border-yellow-400'
                }`}
              />
              <span className="text-sm font-medium">Loading</span>
            </div>
          </div>
        )}

        {shouldShowConnectionSpinner && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div
              className={`rounded-xl px-4 py-3 flex flex-col items-center gap-2 ${
                theme === 'light'
                  ? 'bg-white/88 border border-gray-200 text-gray-600'
                  : 'bg-navy-900/72 border border-navy-700 text-gray-300'
              } backdrop-blur-sm`}
            >
              <div
                className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${
                  theme === 'light' ? 'border-gray-400' : 'border-yellow-400'
                }`}
              />
              <span className="text-xs font-semibold">{Math.max(1, Math.min(100, connectionProgress))}%</span>
              <div
                className={`h-1.5 w-48 overflow-hidden rounded-full ${
                  theme === 'light' ? 'bg-gray-200' : 'bg-navy-700'
                }`}
              >
                <div
                  className={theme === 'light' ? 'h-full bg-blue-500 transition-all duration-300' : 'h-full bg-yellow-400 transition-all duration-300'}
                  style={{ width: `${Math.max(1, Math.min(100, connectionProgress))}%` }}
                />
              </div>
              <span className="text-[11px] opacity-80">Initializing BeeKeeper runtime</span>
            </div>
          </div>
        )}
      </div>

      {showLogs && (
        <div className={`absolute left-3 right-3 bottom-3 z-20 rounded-md border ${theme === 'light' ? 'bg-white/95 border-gray-300' : 'bg-navy-950/92 border-navy-700'} backdrop-blur-sm`}>
          <div className={`px-3 py-2 text-[11px] border-b ${theme === 'light' ? 'border-gray-200 text-gray-600' : 'border-navy-700 text-gray-400'}`}>
            BeeKeeper Runtime Logs
          </div>
          <pre className={`max-h-52 overflow-auto p-3 text-[11px] leading-5 ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
            {(status?.logs || []).join('\n') || 'No logs yet'}
          </pre>
          <div className={`px-3 pb-2 text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
            Session auto-starts on open and auto-stops when tab closes.
          </div>
        </div>
      )}
    </div>
  );
};

const buildConnectionUrl = (dbServer: DatabaseServer): string | null => {
  const host = dbServer.host?.trim();
  const username = dbServer.username ? encodeURIComponent(dbServer.username) : '';
  const password = dbServer.password ? encodeURIComponent(dbServer.password) : '';
  const auth = username ? `${username}${password ? `:${password}` : ''}@` : '';

  if (dbServer.protocol === 'sqlite') {
    return dbServer.sqliteFile || dbServer.database || null;
  }

  if (dbServer.protocol === 'mongodb') {
    if (dbServer.mongoUri) return dbServer.mongoUri;
    if (!host) return null;
    const port = dbServer.port || 27017;
    const dbName = dbServer.database ? `/${encodeURIComponent(dbServer.database)}` : '';
    return `mongodb://${auth}${host}:${port}${dbName}`;
  }

  if (dbServer.protocol === 'postgresql' || dbServer.protocol === 'mysql' || dbServer.protocol === 'redis') {
    if (!host) return null;
    const defaultPorts: Record<string, number> = { postgresql: 5432, mysql: 3306, redis: 6379 };
    const port = dbServer.port || defaultPorts[dbServer.protocol];
    const dbName = dbServer.database ? `/${encodeURIComponent(dbServer.database)}` : '';
    const ssl = dbServer.sslEnabled ? '?sslmode=require' : '';
    return `${dbServer.protocol}://${auth}${host}:${port}${dbName}${ssl}`;
  }

  return null;
};

export default BeeKeeperDatabase;
