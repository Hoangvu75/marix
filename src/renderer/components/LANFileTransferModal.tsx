import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

interface Peer {
  id: string;
  name: string;
  address: string;
  port: number;
}

interface TransferSession {
  id: string;
  peerId: string;
  peerAddress: string;
  files: { name: string; relativePath: string; size: number; isDirectory: boolean }[];
  totalSize: number;
  transferredSize: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  direction: 'send' | 'receive';
  progress?: number;
  speed?: string;
}

interface IncomingTransfer {
  sessionId: string;
  from: string;
  files: { name: string; size: number; isDirectory: boolean }[];
  totalSize: number;
  pairingCode: string;
}

interface Props {
  onClose: () => void;
  peers: Peer[];
}

const LANFileTransferModal: React.FC<Props> = ({ onClose, peers }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [pairingCode, setPairingCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [status, setStatus] = useState('');
  const [sessions, setSessions] = useState<TransferSession[]>([]);
  const [incomingTransfer, setIncomingTransfer] = useState<IncomingTransfer | null>(null);
  const [receiverCode, setReceiverCode] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<{ deviceId: string; deviceName: string; port: number } | null>(null);

  // Get device info on mount
  useEffect(() => {
    ipcRenderer.invoke('file-transfer:getDeviceInfo').then(setDeviceInfo);
    generateCode();
  }, []);

  // Listen for transfer events
  useEffect(() => {
    const handleRequest = (_: any, data: IncomingTransfer) => {
      console.log('[FileTransfer] Incoming request:', data);
      setIncomingTransfer(data);
      setTab('receive');
      
      // Show notification
      new Notification('Marix - Incoming File Transfer', {
        body: `${data.from} wants to send ${data.files.length} file(s) (${formatSize(data.totalSize)})`,
        icon: 'icon/icon.png'
      });
    };

    const handleStarted = (_: any, data: any) => {
      setStatus(`Transfer started...`);
      updateSession(data.sessionId, { status: 'transferring' });
    };

    const handleProgress = (_: any, data: any) => {
      updateSession(data.sessionId, {
        transferredSize: data.transferredSize,
        progress: data.progress,
        speed: data.speed
      });
    };

    const handleCompleted = (_: any, data: any) => {
      setStatus(`✓ Transfer completed!`);
      updateSession(data.sessionId, { status: 'completed' });
      setIncomingTransfer(null);
    };

    const handleError = (_: any, data: any) => {
      setStatus(`❌ Error: ${data.error}`);
      updateSession(data.sessionId, { status: 'failed' });
    };

    const handleCancelled = (_: any, data: any) => {
      setStatus('Transfer cancelled');
      updateSession(data.sessionId, { status: 'cancelled' });
    };

    ipcRenderer.on('file-transfer:request', handleRequest);
    ipcRenderer.on('file-transfer:started', handleStarted);
    ipcRenderer.on('file-transfer:progress', handleProgress);
    ipcRenderer.on('file-transfer:completed', handleCompleted);
    ipcRenderer.on('file-transfer:error', handleError);
    ipcRenderer.on('file-transfer:cancelled', handleCancelled);

    return () => {
      ipcRenderer.removeAllListeners('file-transfer:request');
      ipcRenderer.removeAllListeners('file-transfer:started');
      ipcRenderer.removeAllListeners('file-transfer:progress');
      ipcRenderer.removeAllListeners('file-transfer:completed');
      ipcRenderer.removeAllListeners('file-transfer:error');
      ipcRenderer.removeAllListeners('file-transfer:cancelled');
    };
  }, []);

  const updateSession = (sessionId: string, updates: Partial<TransferSession>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
  };

  const generateCode = async () => {
    const code = await ipcRenderer.invoke('file-transfer:generateCode');
    setGeneratedCode(code);
    setPairingCode(code);
  };

  const selectFiles = async () => {
    const result = await ipcRenderer.invoke('file-transfer:selectFiles');
    if (result.success) {
      setSelectedFiles(prev => [...prev, ...result.filePaths]);
    }
  };

  const selectFolder = async () => {
    const result = await ipcRenderer.invoke('file-transfer:selectFolder');
    if (result.success) {
      setSelectedFiles(prev => [...prev, ...result.filePaths]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!selectedPeer || selectedFiles.length === 0 || !pairingCode) {
      setStatus('Please select a device, files, and enter pairing code');
      return;
    }

    setStatus('Connecting...');
    
    // Use the file transfer port (45679)
    const result = await ipcRenderer.invoke(
      'file-transfer:sendFiles',
      selectedPeer.address,
      45679, // File transfer port
      selectedFiles,
      pairingCode
    );

    if (result.success) {
      setSessions(prev => [...prev, {
        id: result.sessionId,
        peerId: selectedPeer.id,
        peerAddress: selectedPeer.address,
        files: selectedFiles.map(f => ({ name: f.split('/').pop() || f, relativePath: f, size: 0, isDirectory: false })),
        totalSize: 0,
        transferredSize: 0,
        status: 'pending',
        direction: 'send'
      }]);
      setStatus('Waiting for receiver to accept...');
    } else {
      setStatus(`❌ Failed: ${result.error}`);
    }
  };

  const acceptTransfer = async () => {
    if (!incomingTransfer || !receiverCode) {
      setStatus('Please enter pairing code');
      return;
    }

    // Select save location
    const saveResult = await ipcRenderer.invoke('file-transfer:selectSaveLocation');
    if (!saveResult.success) {
      if (saveResult.canceled) return;
      setStatus('Failed to select save location');
      return;
    }

    const result = await ipcRenderer.invoke(
      'file-transfer:acceptTransfer',
      incomingTransfer.sessionId,
      saveResult.savePath,
      receiverCode
    );

    if (result.success) {
      setSessions(prev => [...prev, {
        id: incomingTransfer.sessionId,
        peerId: '',
        peerAddress: '',
        files: incomingTransfer.files.map(f => ({ ...f, relativePath: f.name })),
        totalSize: incomingTransfer.totalSize,
        transferredSize: 0,
        status: 'transferring',
        direction: 'receive'
      }]);
      setStatus('Receiving files...');
    } else {
      setStatus('❌ Failed to accept transfer - wrong code?');
    }
  };

  const rejectTransfer = async () => {
    if (!incomingTransfer) return;
    await ipcRenderer.invoke('file-transfer:rejectTransfer', incomingTransfer.sessionId);
    setIncomingTransfer(null);
    setStatus('Transfer rejected');
  };

  const cancelSession = async (sessionId: string) => {
    await ipcRenderer.invoke('file-transfer:cancelTransfer', sessionId);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const activeSession = sessions.find(s => s.status === 'transferring');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-900 rounded-xl shadow-2xl w-full max-w-2xl border border-navy-700 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">LAN File Transfer</h2>
              <p className="text-sm text-white/80">Send files directly to devices on your network</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-navy-700">
          <button
            onClick={() => setTab('send')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'send' 
                ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-500/10' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Send Files
            </div>
          </button>
          <button
            onClick={() => setTab('receive')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              tab === 'receive' 
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Receive Files
              {incomingTransfer && (
                <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'send' ? (
            <>
              {/* Device Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Device</label>
                {peers.length === 0 ? (
                  <div className="p-4 bg-navy-800 rounded-lg text-center text-gray-400 text-sm">
                    No devices found on network. Make sure LAN Discovery is enabled.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {peers.map(peer => (
                      <button
                        key={peer.id}
                        onClick={() => setSelectedPeer(peer)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedPeer?.id === peer.id
                            ? 'border-teal-500 bg-teal-500/10 text-white'
                            : 'border-navy-700 bg-navy-800 text-gray-300 hover:border-navy-600'
                        }`}
                      >
                        <div className="font-medium truncate">{peer.name}</div>
                        <div className="text-xs text-gray-500">{peer.address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Files to Send</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={selectFiles}
                    className="flex-1 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-teal-500 transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Select Files
                  </button>
                  <button
                    onClick={selectFolder}
                    className="flex-1 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-blue-500 transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Select Folder
                  </button>
                </div>
                
                {selectedFiles.length > 0 && (
                  <div className="bg-navy-800 rounded-lg border border-navy-700 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between px-3 py-2 border-b border-navy-700 last:border-0">
                        <span className="text-sm text-gray-300 truncate flex-1">{file.split('/').pop()}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pairing Code */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Pairing Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    className="flex-1 px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white font-mono text-lg tracking-wider text-center focus:outline-none focus:border-teal-500"
                    maxLength={6}
                  />
                  <button
                    onClick={generateCode}
                    className="px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-gray-300 hover:text-white hover:border-teal-500 transition"
                    title="Generate new code"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Share this code with the receiver to verify the transfer
                </p>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!selectedPeer || selectedFiles.length === 0 || pairingCode.length !== 6}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send {selectedFiles.length > 0 ? `(${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})` : ''}
              </button>
            </>
          ) : (
            <>
              {/* Incoming Transfer */}
              {incomingTransfer ? (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white">Incoming Transfer from {incomingTransfer.from}</h3>
                      <p className="text-sm text-gray-400">
                        {incomingTransfer.files.length} file(s) • {formatSize(incomingTransfer.totalSize)}
                      </p>
                      <div className="mt-2 max-h-24 overflow-y-auto bg-navy-900/50 rounded p-2">
                        {incomingTransfer.files.slice(0, 5).map((file, i) => (
                          <div key={i} className="text-xs text-gray-400 truncate">
                            {file.isDirectory ? '📁' : '📄'} {file.name}
                          </div>
                        ))}
                        {incomingTransfer.files.length > 5 && (
                          <div className="text-xs text-gray-500">... and {incomingTransfer.files.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Enter Pairing Code from Sender</label>
                    <input
                      type="text"
                      value={receiverCode}
                      onChange={(e) => setReceiverCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-lg text-white font-mono text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-blue-500"
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={rejectTransfer}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                    >
                      Reject
                    </button>
                    <button
                      onClick={acceptTransfer}
                      disabled={receiverCode.length !== 6}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition"
                    >
                      Accept & Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <p>Waiting for incoming file transfers...</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Make sure LAN Discovery is enabled to receive files
                  </p>
                </div>
              )}
            </>
          )}

          {/* Active Transfer Progress */}
          {activeSession && (
            <div className="bg-navy-800 rounded-lg border border-navy-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">
                  {activeSession.direction === 'send' ? 'Sending...' : 'Receiving...'}
                </span>
                <span className="text-sm text-gray-400">{activeSession.speed}</span>
              </div>
              <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${activeSession.progress || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">
                  {formatSize(activeSession.transferredSize)} / {formatSize(activeSession.totalSize)}
                </span>
                <span className="text-xs text-gray-400">{activeSession.progress || 0}%</span>
              </div>
              <button
                onClick={() => cancelSession(activeSession.id)}
                className="mt-2 text-xs text-red-400 hover:text-red-300"
              >
                Cancel Transfer
              </button>
            </div>
          )}

          {/* Status */}
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

        {/* Footer */}
        <div className="border-t border-navy-700 p-4 bg-navy-800/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Your device: {deviceInfo?.deviceName}</span>
            <span>Port: {deviceInfo?.port}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LANFileTransferModal;
