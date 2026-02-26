import React, { useState } from 'react';
import { Server } from '../App';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

interface Props {
  onSave: (server: Server) => void;
  onConnect?: (server: Server) => void;
  onClose: () => void;
}

const BashSSHModal: React.FC<Props> = ({ onSave, onConnect, onClose }) => {
  const { t } = useLanguage();
  const [scriptContent, setScriptContent] = useState('');
  const [serverName, setServerName] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverData, setServerData] = useState<{
    host: string;
    port: number;
    username: string;
    password: string;
  } | null>(null);

  const handleRun = async () => {
    const content = scriptContent.trim();
    if (!content) {
      setError(t('bashSSHScriptRequired') || 'Script content is required');
      return;
    }
    setError(null);
    setServerData(null);
    setRunning(true);
    try {
      const result = await ipcRenderer.invoke('bash:runScriptContent', content);
      if (!result.success) {
        setError(result.error || t('bashSSHError') || 'Script failed');
        return;
      }
      const output = result.output?.trim() || '';
      if (!output) {
        setError(t('bashSSHEmptyOutput') || 'Script returned empty output');
        return;
      }
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : output;
      let data: { host: string; port?: number; username: string; password?: string; name?: string };
      try {
        data = JSON.parse(jsonStr);
      } catch {
        setError(t('bashSSHInvalidJSON') || 'Invalid JSON output');
        return;
      }
      if (!data.host || !data.username) {
        setError(t('bashSSHInvalidFields') || 'JSON must contain host and username');
        return;
      }
      setServerData({
        host: data.host,
        port: data.port ?? 22,
        username: data.username,
        password: data.password || '',
      });
      if (!serverName.trim() && data.name) setServerName(data.name);
      else if (!serverName.trim()) setServerName(`${data.username}@${data.host}`);
    } catch (err: any) {
      setError(err.message || t('bashSSHError') || 'Script failed');
    } finally {
      setRunning(false);
    }
  };

  const handleCreate = async () => {
    const name = serverName.trim();
    const content = scriptContent.trim();
    if (!name) {
      setError(t('bashSSHScriptRequired') || 'Server name is required');
      return;
    }
    if (!content) {
      setError(t('bashSSHScriptRequired') || 'Script content is required');
      return;
    }
    // Save only name + script - credentials resolved when connecting
    const server: Server = {
      id: '',
      name,
      host: name,  // Placeholder for display
      port: 22,
      username: '',
      password: undefined,
      protocol: 'ssh',
      authType: 'password',
      bashScript: content,
    };
    try {
      const addResult = await ipcRenderer.invoke('servers:add', server);
      if (!addResult.success || !addResult.server) {
        setError(addResult.error || t('bashSSHSaveError') || 'Failed to save server');
        return;
      }
      onSave(addResult.server);
      onClose();
    } catch (err: any) {
      setError(err.message || t('bashSSHSaveError') || 'Failed to save server');
    }
  };

  const handleCreateAndConnect = async () => {
    const name = serverName.trim();
    const content = scriptContent.trim();
    if (!name || !content) {
      setError(t('bashSSHScriptRequired') || 'Server name and script are required');
      return;
    }
    const server: Server = {
      id: '',
      name,
      host: name,
      port: 22,
      username: '',
      password: undefined,
      protocol: 'ssh',
      authType: 'password',
      bashScript: content,
    };
    try {
      const addResult = await ipcRenderer.invoke('servers:add', server);
      if (!addResult.success || !addResult.server) {
        setError(addResult.error || t('bashSSHSaveError') || 'Failed to save server');
        return;
      }
      const savedServer = addResult.server;
      onSave(savedServer);
      onClose();
      onConnect?.(savedServer);
    } catch (err: any) {
      setError(err.message || t('bashSSHSaveError') || 'Failed to save server');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-navy-800 border-l border-navy-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-5 border-b border-navy-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('bashSSH')}</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-navy-700 rounded-lg transition text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Server name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              {t('hostName')} / {t('serverName')}
            </label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="My Server"
              className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Script content */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              {t('bashSSHScriptContent') || 'Script content'}
            </label>
            <textarea
              value={scriptContent}
              onChange={(e) => setScriptContent(e.target.value)}
              placeholder={`echo '{"host":"0.0.0.0","port":22,"username":"...","password":"..."}'`}
              disabled={running}
              rows={6}
              className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 font-mono disabled:opacity-50 resize-y"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('bashSSHScriptHint') || 'Script must echo valid JSON with host, username (port optional, password optional)'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={running}
            className="w-full px-4 py-2.5 bg-amber-600/50 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('connecting') || 'Running...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('bashSSHRun') || 'Run Script (test)'}
              </>
            )}
          </button>

          {/* Create buttons - always visible when name + script filled */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={!serverName.trim() || !scriptContent.trim()}
              className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('create')}
            </button>
            <button
              onClick={handleCreateAndConnect}
              disabled={!serverName.trim() || !scriptContent.trim()}
              className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('bashSSHCreateAndConnect') || 'Create & Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BashSSHModal;
