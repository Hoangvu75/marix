import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

interface FingerprintResult {
  status: 'new' | 'match' | 'changed' | 'error';
  keyType?: string;
  fingerprint?: string;
  fullKey?: string;
  previousFingerprint?: string;
  error?: string;
}

interface Props {
  host: string;
  port: number;
  onAccept: () => void;
  onReject: () => void;
  onSkip?: () => void;
}

const SSHFingerprintModal: React.FC<Props> = ({ host, port, onAccept, onReject, onSkip }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FingerprintResult | null>(null);

  useEffect(() => {
    checkFingerprint();
  }, [host, port]);

  const checkFingerprint = async () => {
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('knownhosts:check', host, port);
      setResult(res);
    } catch (err: any) {
      setResult({ status: 'error', error: err.message });
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    if (result && result.keyType && result.fingerprint && result.fullKey) {
      await ipcRenderer.invoke('knownhosts:accept', host, port, result.keyType, result.fingerprint, result.fullKey);
    }
    onAccept();
  };

  // If already known and matches, auto-accept
  useEffect(() => {
    if (result?.status === 'match') {
      onAccept();
    }
  }, [result]);

  // Don't show modal if fingerprint matches
  if (result?.status === 'match') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onReject} />
      
      <div className="relative bg-navy-800 border border-navy-600 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 animate-in fade-in zoom-in duration-200">
        {loading ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">{t('verifyingHost')}</p>
          </div>
        ) : result?.status === 'error' ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t('fingerprintError')}</h3>
            <p className="text-gray-400 mb-6">{result.error || t('couldNotVerify')}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onReject}
                className="px-4 py-2 bg-navy-700 text-gray-300 rounded-lg hover:bg-navy-600 transition"
              >
                {t('cancel')}
              </button>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition"
                >
                  {t('skipVerification')}
                </button>
              )}
            </div>
          </div>
        ) : result?.status === 'new' ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{t('newHostDetected')}</h3>
                <p className="text-gray-400 text-sm">{host}:{port}</p>
              </div>
            </div>
            
            <p className="text-gray-300 mb-4">{t('newHostMessage')}</p>
            
            <div className="bg-navy-900 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-400 text-sm">{t('keyType')}:</span>
                <span className="text-teal-400 font-mono text-sm">{result.keyType}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 text-sm">{t('fingerprint')}:</span>
                <span className="text-amber-400 font-mono text-sm break-all">{result.fingerprint}</span>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={onReject}
                className="px-4 py-2 bg-navy-700 text-gray-300 rounded-lg hover:bg-navy-600 transition"
              >
                {t('reject')}
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition"
              >
                {t('acceptAndConnect')}
              </button>
            </div>
          </div>
        ) : result?.status === 'changed' ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-400">{t('hostKeyChanged')}</h3>
                <p className="text-gray-400 text-sm">{host}:{port}</p>
              </div>
            </div>
            
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-300 text-sm">{t('hostKeyChangedWarning')}</p>
            </div>
            
            <div className="bg-navy-900 rounded-lg p-4 mb-4 space-y-3">
              <div>
                <span className="text-gray-400 text-sm">{t('previousFingerprint')}:</span>
                <p className="text-gray-500 font-mono text-xs break-all mt-1">{result.previousFingerprint}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">{t('newFingerprint')}:</span>
                <p className="text-amber-400 font-mono text-xs break-all mt-1">{result.fingerprint}</p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={onReject}
                className="px-4 py-2 bg-navy-700 text-gray-300 rounded-lg hover:bg-navy-600 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition"
              >
                {t('acceptNewKey')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SSHFingerprintModal;
