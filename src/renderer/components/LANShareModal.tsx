import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { useLanguage } from '../contexts/LanguageContext';

interface Peer {
  id: string;
  name: string;
  address: string;
  port: number;
  lastSeen: number;
}

interface Props {
  servers: any[];
  selectedServerIds: string[];
  mode: 'send' | 'receive';
  onClose: () => void;
  onServersImported?: () => void; // Callback to refresh server list
  initialIncomingShare?: any; // Pre-received share data from App
  onClearIncomingShare?: () => void; // Clear pending share in App
}

const LANShareModal: React.FC<Props> = ({ servers, selectedServerIds, mode, onClose, onServersImported, initialIncomingShare, onClearIncomingShare }) => {
  const { t } = useLanguage();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  
  // Incoming share state
  const [incomingShare, setIncomingShare] = useState<any>(initialIncomingShare || null);
  const [decryptCode, setDecryptCode] = useState('');
  const [includeSensitiveData, setIncludeSensitiveData] = useState(true); // Default to include

  // Get selected servers to share
  const serversToShare = servers.filter(s => selectedServerIds.includes(s.id));

  // Set incoming share from App prop when modal opens
  useEffect(() => {
    if (initialIncomingShare && !incomingShare) {
      console.log('[LANShare] Setting initial incoming share from App:', initialIncomingShare);
      setIncomingShare(initialIncomingShare);
    }
  }, [initialIncomingShare]);

  // Auto-generate pairing code on mount
  useEffect(() => {
    generateCode();
  }, []);

  // Countdown timer for code expiry
  useEffect(() => {
    if (codeExpiresAt === 0) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((codeExpiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Auto-regenerate when expired
        generateCode();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  useEffect(() => {
    // Get device info
    ipcRenderer.invoke('lan-share:getDeviceInfo').then(info => {
      setDeviceInfo(info);
    });

    // Service already running from app startup, just get peers
    refreshPeers();

    // Listen for peer events
    const handlePeerFound = (peer: Peer) => {
      console.log('[LANShare UI] Peer found:', peer);
      setPeers(prev => {
        const exists = prev.find(p => p.id === peer.id);
        if (exists) return prev;
        return [...prev, peer];
      });
    };

    const handlePeerLost = (peerId: string) => {
      console.log('[LANShare UI] Peer lost:', peerId);
      setPeers(prev => prev.filter(p => p.id !== peerId));
    };

    ipcRenderer.on('lan-share:peer-found', (_, peer) => handlePeerFound(peer));
    ipcRenderer.on('lan-share:peer-lost', (_, peerId) => handlePeerLost(peerId));

    // Listen for incoming shares
    const handleShareReceived = (_: any, data: any) => {
      console.log('[LANShare] Incoming share received:', data);
      setIncomingShare(data);
      setDecryptCode('');
      // Don't close modal, show popup overlay
    };

    ipcRenderer.on('lan-share:share-received', handleShareReceived);

    // Listen for ACK from receiver (sender gets notified when receiver imports successfully)
    const handleAckReceived = (_: any, data: any) => {
      console.log('[LANShare] ACK received from receiver:', data);
      const { from, data: ackData } = data;
      const importedCount = ackData?.importedCount || 'unknown';
      setStatus(`✅ ${from} imported ${importedCount} server(s) successfully!`);
    };

    ipcRenderer.on('lan-share:ack-received', handleAckReceived);

    return () => {
      ipcRenderer.removeAllListeners('lan-share:peer-found');
      ipcRenderer.removeAllListeners('lan-share:peer-lost');
      ipcRenderer.removeAllListeners('lan-share:share-received');
      ipcRenderer.removeAllListeners('lan-share:ack-received');
      // Don't stop service on unmount, keep it running
    };
  }, []);

  const startScanning = async () => {
    setIsScanning(true);
    setStatus(t('scanning'));

    try {
      console.log('[LANShare] Starting discovery service...');
      const result = await ipcRenderer.invoke('lan-share:start');
      console.log('[LANShare] Start result:', result);
      
      if (result.success) {
        console.log('[LANShare] Service started successfully');
        // Get initial peers
        const initialPeers = await ipcRenderer.invoke('lan-share:getPeers');
        console.log('[LANShare] Initial peers:', initialPeers);
        setPeers(initialPeers);
        
        // Keep scanning - don't stop
        if (initialPeers.length === 0) {
          setStatus(t('noDevicesFound'));
        } else {
          setStatus('');
        }
      } else {
        console.error('[LANShare] Failed to start service:', result.error);
        setStatus(`${t('error')}: ${result.error}`);
        setIsScanning(false);
      }
    } catch (err: any) {
      console.error('[LANShare] Start error:', err);
      setStatus(`${t('error')}: ${err.message}`);
      setIsScanning(false);
    }
    // Don't set isScanning to false - let it keep scanning
  };

  const refreshPeers = async () => {
    try {
      const currentPeers = await ipcRenderer.invoke('lan-share:getPeers');
      console.log('[LANShare] Current peers:', currentPeers);
      setPeers(currentPeers);
      setIsScanning(false);
    } catch (err) {
      console.error('[LANShare] Failed to get peers:', err);
      setIsScanning(false);
    }
  };

  const generateCode = async () => {
    const code = await ipcRenderer.invoke('lan-share:generateCode');
    setPairingCode(code);
    // Set expiry to 5 minutes from now
    const expiresAt = Date.now() + (5 * 60 * 1000);
    setCodeExpiresAt(expiresAt);
    setTimeRemaining(300); // 5 minutes in seconds
    setStatus('');
  };

  const handleShare = async () => {
    if (!selectedPeerId || !pairingCode) {
      setStatus('Please select a device and enter pairing code');
      return;
    }

    if (serversToShare.length === 0) {
      setStatus('No servers selected');
      return;
    }

    setStatus('Sending...');

    // Include or exclude sensitive data based on checkbox
    const dataToShare = includeSensitiveData 
      ? serversToShare // Send everything including passwords/keys
      : serversToShare.map(s => ({ // Strip sensitive data
          ...s,
          password: s.password ? '***REMOVED***' : '',
          privateKey: s.privateKey ? '***REMOVED***' : '',
          passphrase: s.passphrase ? '***REMOVED***' : '',
        }));

    const result = await ipcRenderer.invoke('lan-share:shareWithPeer', selectedPeerId, dataToShare, pairingCode);
    
    if (result.success) {
      // Data sent - waiting for receiver to enter pairing code
      setStatus(`📤 Sent ${serversToShare.length} server(s). Waiting for receiver to enter pairing code...`);
      // Don't show success yet - receiver needs to decrypt
    } else {
      setStatus('❌ Failed to send data');
    }
  };

  const handleDecryptShare = async () => {
    if (!incomingShare || !decryptCode) {
      setStatus('Please enter the pairing code');
      return;
    }

    setStatus('Decrypting...');

    try {
      const result = await ipcRenderer.invoke('lan-share:decrypt', incomingShare.data, decryptCode);
      
      if (result.success) {
        const receivedServers = result.data; // Already parsed by IPC handler
        console.log('[LANShare] Decrypted servers:', receivedServers);
        
        setStatus('Importing servers...');
        
        // Save servers to database via IPC
        let importedCount = 0;
        for (const server of receivedServers) {
          try {
            // Keep ALL server data including privateKey and passphrase
            const serverToImport = {
              name: server.name || 'Imported Server',
              host: server.host || '',
              port: server.port || 22,
              username: server.username || '',
              password: server.password || '',
              icon: server.icon || 'linux',
              protocol: server.protocol || 'ssh',
              authType: server.authType || (server.privateKey ? 'key' : 'password'),
              privateKey: server.privateKey || '',
              passphrase: server.passphrase || '',
              domain: server.domain || '',
              wssUrl: server.wssUrl || '',
              tags: server.tags 
                ? [...(Array.isArray(server.tags) ? server.tags : []), 'LAN-Import']
                : ['LAN-Import'],
              sshKeyId: server.sshKeyId || '',
              knockEnabled: server.knockEnabled || false,
              knockSequence: server.knockSequence || [] as number[],
            };
            
            // Use servers:add - same as AddServerModal
            const result = await ipcRenderer.invoke('servers:add', serverToImport);
            if (result.success) {
              importedCount++;
              console.log('[LANShare] Imported server:', serverToImport.name);
            } else {
              console.error('[LANShare] Failed to import server:', serverToImport.name, result.error);
            }
          } catch (err) {
            console.error('[LANShare] Failed to import server:', server.name, err);
          }
        }
        
        setStatus(`✓ Successfully imported ${importedCount}/${receivedServers.length} server(s)!`);
        
        // Clear state
        setIncomingShare(null);
        setDecryptCode('');
        
        // Clear pending share in App
        if (onClearIncomingShare) {
          onClearIncomingShare();
        }
        
        // Close modal after brief delay to show success message
        setTimeout(() => {
          if (onServersImported) {
            console.log('[LANShare] Refreshing server list...');
            onServersImported();
          }
          onClose(); // Close modal completely
        }, 1500);
      } else {
        setStatus('❌ Failed to decrypt. Wrong pairing code?');
      }
    } catch (err: any) {
      console.error('[LANShare] Decrypt error:', err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <>
      {/* Incoming Share Popup */}
      {incomingShare && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Incoming Share</h3>
                <p className="text-sm text-gray-400 mt-1">
                  From: <span className="text-teal-400 font-medium">{incomingShare.from}</span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  Enter Pairing Code
                </label>
                <input
                  type="text"
                  value={decryptCode}
                  onChange={(e) => setDecryptCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-2xl tracking-wider text-center focus:outline-none focus:border-teal-500"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">
                  Ask the sender for their 6-digit pairing code
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIncomingShare(null);
                    setDecryptCode('');
                    setStatus('');
                    if (onClearIncomingShare) {
                      onClearIncomingShare();
                    }
                    onClose(); // Close modal completely
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDecryptShare}
                  disabled={decryptCode.length !== 6}
                  className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  Decrypt & Import
                </button>
              </div>

              {status && (
                <div className={`p-3 rounded-lg text-sm text-center ${
                  status.includes('✓') 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : status.includes('❌')
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                }`}>
                  {status}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
              {t('lanShare')}
            </h2>
            {deviceInfo && (
              <p className="text-sm text-gray-400 mt-1">
                {t('thisDevice')}: <span className="text-teal-400 font-mono">{deviceInfo.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Selected Servers */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('serversToShare')} ({serversToShare.length})
            </h3>
            <div className="bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
              {serversToShare.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('noServersSelected')}</p>
              ) : (
                <div className="space-y-1">
                  {serversToShare.map(server => (
                    <div key={server.id} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                      <span className="font-medium">{server.name}</span>
                      <span className="text-gray-500 text-xs">({server.host})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-amber-400 mt-2">
              ⚠️ {t('lanShareSecurity')}
            </p>
            
            {/* Include Sensitive Data Checkbox */}
            {mode === 'send' && serversToShare.length > 0 && (
              <label className="flex items-start gap-2 mt-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeSensitiveData}
                  onChange={(e) => setIncludeSensitiveData(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-teal-600 bg-gray-900 border-gray-600 rounded focus:ring-teal-500"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-300 group-hover:text-white">
                    Include passwords and SSH keys
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {includeSensitiveData 
                      ? '🔓 Sensitive data will be encrypted and sent. Recipient can use servers immediately.'
                      : '🔒 Passwords/keys will NOT be sent. Recipient must re-enter them manually.'}
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Pairing Code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">
                {t('pairingCode')}
              </label>
              <div className="flex items-center gap-2">
                {timeRemaining > 0 && (
                  <span className={`text-xs px-2 py-1 rounded font-mono ${
                    timeRemaining < 60 ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'
                  }`}>
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-2xl tracking-wider text-center">
                {pairingCode || '------'}
              </div>
              <button
                onClick={generateCode}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('generate')}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('pairingCodeDesc')}</p>
          </div>

          {/* Available Devices */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {t('availableDevices')} ({peers.length})
              </h3>
              {isScanning && (
                <span className="text-xs text-gray-500 animate-pulse">{t('scanning')}</span>
              )}
            </div>
            
            <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {peers.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  {t('noDevicesFound')}
                </p>
              ) : (
                peers.map(peer => (
                  <button
                    key={peer.id}
                    onClick={() => setSelectedPeerId(peer.id)}
                    className={`w-full p-3 rounded-lg border transition-all text-left ${
                      selectedPeerId === peer.id
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{peer.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{peer.address}</p>
                      </div>
                      {selectedPeerId === peer.id && (
                        <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className={`p-3 rounded-lg text-sm ${
              status.includes('✓') 
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : status.includes('Error') || status.includes('Failed')
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
            }`}>
              {status}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleShare}
            disabled={!selectedPeerId || !pairingCode || serversToShare.length === 0}
            className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {t('shareOnLAN')}
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default LANShareModal;
