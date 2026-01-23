import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

interface RDPViewerProps {
  connectionId: string;
  serverName?: string;
  onConnect?: () => void;
  onClose?: () => void;
  onError?: (error: string) => void;
}

const RDPViewer: React.FC<RDPViewerProps> = ({
  connectionId,
  serverName,
  onConnect,
  onClose,
  onError,
}) => {
  const { t } = useLanguage();
  // Start as 'connected' since xfreerdp opens externally and is already running when this component mounts
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connected');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Listen for RDP events
    const handleConnect = (receivedId: string) => {
      if (receivedId === connectionId) {
        setStatus('connected');
        onConnect?.();
      }
    };

    const handleClose = (receivedId: string) => {
      if (receivedId === connectionId) {
        setStatus('disconnected');
        onClose?.();
      }
    };

    const handleError = (receivedId: string, error: string) => {
      if (receivedId === connectionId) {
        setStatus('error');
        setErrorMessage(error);
        onError?.(error);
      }
    };

    ipcRenderer.on('rdp:connect', (_, id) => handleConnect(id));
    ipcRenderer.on('rdp:close', (_, id) => handleClose(id));
    ipcRenderer.on('rdp:error', (_, id, error) => handleError(id, error));

    return () => {
      ipcRenderer.removeAllListeners('rdp:connect');
      ipcRenderer.removeAllListeners('rdp:close');
      ipcRenderer.removeAllListeners('rdp:error');
    };
  }, [connectionId, onConnect, onClose, onError]);

  const handleDisconnect = () => {
    ipcRenderer.invoke('rdp:disconnect', connectionId);
  };

  return (
    <div className="flex-1 bg-navy-900 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        {/* Windows Icon */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <svg className="w-14 h-14 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 12V6.75L9 5.43V11.91L3 12M20 3V11.75L10 11.97V5.25L20 3M3 13L9 13.09V19.9L3 18.75V13M10 13.2L20 13V22L10 20.09V13.2Z" />
          </svg>
        </div>

        {/* Status */}
        {status === 'connecting' && (
          <>
            <h3 className="text-xl font-medium text-white mb-2">{t('rdpConnecting')}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {serverName || connectionId}
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            </div>
          </>
        )}

        {status === 'connected' && (
          <>
            <h3 className="text-xl font-medium text-white mb-2">{t('rdpConnected')}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {serverName || connectionId}
            </p>
            <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-teal-400 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{t('rdpSessionActive')}</span>
              </div>
              <p className="text-sm text-gray-400">
                {t('rdpSessionDesc')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleDisconnect}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('disconnect')}
              </button>
            </div>
          </>
        )}

        {status === 'disconnected' && (
          <>
            <h3 className="text-xl font-medium text-gray-300 mb-2">{t('rdpSessionEnded')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('rdpSessionClosedDesc')}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h3 className="text-xl font-medium text-red-400 mb-2">{t('rdpConnectionError')}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {errorMessage || t('rdpFailedConnect')}
            </p>
            <button
              onClick={handleDisconnect}
              className="px-6 py-2.5 bg-navy-700 hover:bg-navy-600 text-white text-sm font-medium rounded-lg transition"
            >
              {t('close')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(RDPViewer);
