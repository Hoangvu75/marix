import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

interface Props {
  incomingShare: {
    from: string;
    deviceId: string;
    data: string;
    address: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const PairCodePopup: React.FC<Props> = ({ incomingShare, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const [pairCode, setPairCode] = useState('');
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDecrypt = async () => {
    if (pairCode.length !== 6) {
      setStatus('Please enter 6-digit code');
      return;
    }

    // Prevent double-click
    if (isProcessing) return;
    
    setIsProcessing(true);
    setStatus('Decrypting...');

    try {
      const result = await ipcRenderer.invoke('lan-share:decrypt', incomingShare.data, pairCode);
      
      if (result.success) {
        const receivedServers = result.data;
        console.log('[PairCode] Decrypted servers:', receivedServers);
        
        setStatus('Importing servers...');
        
        // Import servers
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
            
            const addResult = await ipcRenderer.invoke('servers:add', serverToImport);
            if (addResult.success) {
              importedCount++;
            }
          } catch (err) {
            console.error('[PairCode] Failed to import server:', server.name, err);
          }
        }
        
        setStatus(`✓ Imported ${importedCount}/${receivedServers.length} server(s)!`);
        
        // Send ACK back to sender
        try {
          await ipcRenderer.invoke('lan-share:sendAck', incomingShare.deviceId, {
            success: true,
            importedCount: importedCount,
          });
          console.log('[PairCode] ACK sent to sender');
        } catch (err) {
          console.log('[PairCode] Failed to send ACK:', err);
        }
        
        // Close after showing success
        setTimeout(() => {
          onSuccess();
        }, 1500);
        
      } else {
        setStatus('❌ Wrong pairing code');
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('[PairCode] Decrypt error:', err);
      setStatus(`❌ Error: ${err.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Incoming Share</h3>
              <p className="text-sm text-white/80">From: {incomingShare.from}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Enter 6-digit Pairing Code
            </label>
            <input
              type="text"
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-teal-500 disabled:opacity-50"
              maxLength={6}
              autoFocus
              disabled={isProcessing}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Ask the sender for their pairing code
            </p>
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

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleDecrypt}
              disabled={pairCode.length !== 6 || isProcessing}
              className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {isProcessing ? 'Processing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PairCodePopup;
