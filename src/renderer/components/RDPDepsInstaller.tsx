import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerminal: (command: string) => void;
  theme?: 'dark' | 'light';
}

interface DependencyStatus {
  xfreerdp3: boolean;
  xdotool: boolean;
  distro: 'debian' | 'fedora' | 'arch' | 'unknown';
}

const RDPDepsInstaller: React.FC<Props> = ({ isOpen, onClose, onOpenTerminal, theme = 'dark' }) => {
  const { t } = useLanguage();
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Check dependencies when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setChecking(true);
    setError(null);
    setCopied(false);

    const checkDeps = async () => {
      try {
        const result = await ipcRenderer.invoke('rdp:checkDeps');
        if (result.success) {
          setDeps(result.deps);
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setChecking(false);
      }
    };

    checkDeps();
  }, [isOpen]);

  const getInstallCommand = (): string => {
    if (!deps) return '';
    
    const packages: string[] = [];
    if (!deps.xfreerdp3) {
      packages.push(deps.distro === 'debian' ? 'freerdp3-x11' : 'freerdp');
    }
    if (!deps.xdotool) {
      packages.push('xdotool');
    }

    if (packages.length === 0) return '';

    switch (deps.distro) {
      case 'debian':
        return `sudo apt update && sudo apt install -y ${packages.join(' ')}`;
      case 'fedora':
        return `sudo dnf install -y ${packages.join(' ')}`;
      case 'arch':
        return `sudo pacman -S --noconfirm ${packages.join(' ')}`;
      default:
        return `sudo apt update && sudo apt install -y ${packages.join(' ')}`;
    }
  };

  const handleOpenTerminal = () => {
    const cmd = getInstallCommand();
    if (cmd) {
      onOpenTerminal(cmd);
      onClose();
    }
  };

  const handleCopyCommand = async () => {
    const cmd = getInstallCommand();
    if (cmd) {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isDark = theme === 'dark';

  // Get distro display name
  const getDistroName = (distro: string) => {
    switch (distro) {
      case 'debian': return 'Debian/Ubuntu';
      case 'fedora': return 'Fedora/RHEL';
      case 'arch': return 'Arch Linux';
      default: return 'Linux';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`relative w-[550px] rounded-xl shadow-2xl border overflow-hidden ${
        isDark 
          ? 'bg-gray-900 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('rdpDepsRequired')}
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {deps ? getDistroName(deps.distro) : 'Linux'} {t('rdpDepsDetected').replace('{distro}', '').trim() || 'detected'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark 
                ? 'hover:bg-gray-700 text-gray-400' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {checking ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                  {t('rdpCheckingDeps')}
                </span>
              </div>
            </div>
          ) : error ? (
            <div className="py-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400">{error}</p>
              </div>
            </div>
          ) : deps && (!deps.xfreerdp3 || !deps.xdotool) ? (
            <div className="space-y-4">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {t('rdpPackagesRequired')}
              </p>
              
              {/* Dependency status */}
              <div className="grid grid-cols-2 gap-3">
                {/* xfreerdp3 */}
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {deps.xfreerdp3 ? (
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-green-400">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-red-400">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </div>
                    )}
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      xfreerdp3
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('rdpXfreerdpDesc')}
                  </p>
                </div>

                {/* xdotool */}
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {deps.xdotool ? (
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-green-400">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-red-400">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </div>
                    )}
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      xdotool
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('rdpXdotoolDesc')}
                  </p>
                </div>
              </div>

              {/* Install command */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('rdpInstallCommand')}
                </label>
                <div className={`relative p-3 rounded-lg font-mono text-sm break-all ${
                  isDark ? 'bg-gray-800 text-cyan-400' : 'bg-gray-100 text-cyan-700'
                }`}>
                  {getInstallCommand()}
                  <button
                    onClick={handleCopyCommand}
                    className={`absolute top-2 right-2 p-1.5 rounded transition-colors ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                    }`}
                    title="Copy command"
                  >
                    {copied ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-400">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className={`p-3 rounded-lg border ${
                isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <div className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                    <p className="font-medium mb-1">{t('rdpHowToInstall')}</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs opacity-90">
                      <li>{t('rdpStep1')}</li>
                      <li>{t('rdpStep2')}</li>
                      <li>{t('rdpStep3')}</li>
                      <li>{t('rdpStep4')}</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-green-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('rdpAllDepsInstalled')}
              </h3>
              <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('rdpReadyToConnect')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end gap-3 ${
          isDark ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {t('cancel')}
          </button>
          
          {deps && (!deps.xfreerdp3 || !deps.xdotool) && (
            <button
              onClick={handleOpenTerminal}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              {t('openTerminal')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RDPDepsInstaller;
