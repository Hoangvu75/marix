import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { useLanguage } from '../contexts/LanguageContext';

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
  status: 'pending' | 'waiting' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  direction: 'send' | 'receive';
  progress?: number;
  speed?: string;
}

interface Props {
  peers: Peer[];
  appTheme?: 'dark' | 'light';
}

const LANFileTransferPage: React.FC<Props> = ({ peers, appTheme = 'dark' }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [pairingCode, setPairingCode] = useState('');
  const [status, setStatus] = useState('');
  const [sessions, setSessions] = useState<TransferSession[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<{ deviceId: string; deviceName: string; port: number } | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingSessionId, setWaitingSessionId] = useState<string | null>(null);
  
  // Receiver state
  const [receiverCode, setReceiverCode] = useState('');
  const [isSearchingSender, setIsSearchingSender] = useState(false);
  const [foundSender, setFoundSender] = useState<{ deviceName: string; address: string; port: number } | null>(null);

  const isDark = appTheme === 'dark';

  // Get device info on mount
  useEffect(() => {
    ipcRenderer.invoke('file-transfer:getDeviceInfo').then(setDeviceInfo);
    generateCode();
  }, []);

  // Listen for transfer events
  useEffect(() => {
    const handleWaiting = (_: any, data: any) => {
      console.log('[FileTransfer] Waiting for receiver:', data);
      setIsWaiting(true);
      setWaitingSessionId(data.sessionId);
      setStatus('Waiting for receiver to connect...');
    };

    const handleConnected = (_: any, data: any) => {
      console.log('[FileTransfer] Receiver connected:', data);
      setStatus(`${data.receiverName} connected! Starting transfer...`);
    };

    const handleStarted = (_: any, data: any) => {
      console.log('[FileTransfer] Transfer started:', data);
      setStatus('Transfer in progress...');
      setIsWaiting(false);
      
      setSessions(prev => {
        const existing = prev.find(s => s.id === data.sessionId);
        if (existing) {
          // Update existing session with files info and status
          return prev.map(s => s.id === data.sessionId ? { 
            ...s, 
            status: 'transferring',
            files: data.files || s.files,
            totalSize: data.totalSize || s.totalSize
          } : s);
        }
        return [...prev, {
          id: data.sessionId,
          peerId: '',
          peerAddress: '',
          files: data.files || [],
          totalSize: data.totalSize || 0,
          transferredSize: 0,
          status: 'transferring',
          direction: data.direction
        }];
      });
    };

    const handleProgress = (_: any, data: any) => {
      setSessions(prev => prev.map(s => s.id === data.sessionId ? {
        ...s,
        transferredSize: data.transferredSize,
        totalSize: data.totalSize,
        progress: data.progress,
        speed: data.speed
      } : s));
    };

    const handleCompleted = (_: any, data: any) => {
      setStatus('✓ Transfer completed!');
      setIsWaiting(false);
      setSessions(prev => prev.map(s => s.id === data.sessionId ? { ...s, status: 'completed' } : s));
      // Clear the active pairing code after completion
      ipcRenderer.invoke('file-transfer:setActivePairingCode', null);
      // Reset after completion
      setTimeout(() => {
        setSelectedFiles([]);
        generateCode();
      }, 2000);
    };

    const handleError = (_: any, data: any) => {
      setStatus(`❌ Error: ${data.error}`);
      setIsWaiting(false);
      setSessions(prev => prev.map(s => s.id === data.sessionId ? { ...s, status: 'failed' } : s));
      // Clear the active pairing code on error
      ipcRenderer.invoke('file-transfer:setActivePairingCode', null);
    };

    const handleCancelled = (_: any, data: any) => {
      setStatus('Transfer cancelled');
      setIsWaiting(false);
      setSessions(prev => prev.map(s => s.id === data.sessionId ? { ...s, status: 'cancelled' } : s));
    };

    ipcRenderer.on('file-transfer:waiting', handleWaiting);
    ipcRenderer.on('file-transfer:connected', handleConnected);
    ipcRenderer.on('file-transfer:started', handleStarted);
    ipcRenderer.on('file-transfer:progress', handleProgress);
    ipcRenderer.on('file-transfer:completed', handleCompleted);
    ipcRenderer.on('file-transfer:error', handleError);
    ipcRenderer.on('file-transfer:cancelled', handleCancelled);

    // Listen for sender-found event (LAN broadcast response)
    const handleSenderFound = (_: any, data: any) => {
      console.log('[FileTransfer] Sender found via broadcast:', data);
      setFoundSender({
        deviceName: data.deviceName,
        address: data.address,
        port: data.port
      });
      setIsSearchingSender(false);
      setStatus(`Found sender: ${data.deviceName}`);
    };
    ipcRenderer.on('file-transfer:sender-found', handleSenderFound);

    return () => {
      ipcRenderer.removeAllListeners('file-transfer:waiting');
      ipcRenderer.removeAllListeners('file-transfer:connected');
      ipcRenderer.removeAllListeners('file-transfer:started');
      ipcRenderer.removeAllListeners('file-transfer:progress');
      ipcRenderer.removeAllListeners('file-transfer:completed');
      ipcRenderer.removeAllListeners('file-transfer:error');
      ipcRenderer.removeAllListeners('file-transfer:cancelled');
      ipcRenderer.removeAllListeners('file-transfer:sender-found');
    };
  }, []);

  const generateCode = async () => {
    const code = await ipcRenderer.invoke('file-transfer:generateCode');
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

  // SENDER: Prepare files and wait for receiver
  const handleSend = async () => {
    if (selectedFiles.length === 0 || pairingCode.length !== 6) return;
    
    setStatus('Preparing files...');
    
    // Set active pairing code so LAN discovery can find us
    await ipcRenderer.invoke('file-transfer:setActivePairingCode', pairingCode);
    
    const result = await ipcRenderer.invoke('file-transfer:prepareToSend', selectedFiles, pairingCode);
    
    if (result.success) {
      setSessions(prev => [...prev, {
        id: result.sessionId,
        peerId: '',
        peerAddress: '',
        files: result.files,
        totalSize: result.totalSize,
        transferredSize: 0,
        status: 'waiting',
        direction: 'send'
      }]);
    } else {
      setStatus(`❌ Failed: ${result.error}`);
      // Clear the active code on failure
      await ipcRenderer.invoke('file-transfer:setActivePairingCode', null);
    }
  };

  // RECEIVER: Search for sender by code, then request files
  const handleSearchSender = async () => {
    if (receiverCode.length !== 6) {
      setStatus('❌ Please enter a valid 6-digit code');
      return;
    }
    
    setIsSearchingSender(true);
    setFoundSender(null);
    setStatus('Searching for sender on local network...');
    
    // Broadcast to find sender with this code (multiple attempts)
    await ipcRenderer.invoke('file-transfer:findSenderByCode', receiverCode);
    
    // Retry broadcasts a few times
    const retryBroadcast = async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await ipcRenderer.invoke('file-transfer:findSenderByCode', receiverCode);
      }
    };
    retryBroadcast();
    
    // Timeout after 10 seconds - will be cleared if sender found via event
    setTimeout(() => {
      setIsSearchingSender((current) => {
        if (current) {
          setStatus('❌ No sender found with this code. Make sure the sender is waiting and both devices are on the same network.');
          return false;
        }
        return current;
      });
    }, 10000);
  };

  // RECEIVER: Request files from found sender
  const handleReceive = async () => {
    if (!foundSender || receiverCode.length !== 6) {
      setStatus('❌ Please search and find a sender first');
      return;
    }
    
    // Select save location first
    const saveResult = await ipcRenderer.invoke('file-transfer:selectSaveLocation');
    if (!saveResult.success || !saveResult.savePath) {
      return;
    }
    
    setStatus('Connecting to sender...');
    const result = await ipcRenderer.invoke(
      'file-transfer:requestFiles', 
      foundSender.address, 
      foundSender.port, 
      receiverCode, 
      saveResult.savePath
    );
    
    if (result.success) {
      setSessions(prev => [...prev, {
        id: result.sessionId,
        peerId: '',
        peerAddress: foundSender.address,
        files: [],
        totalSize: 0,
        transferredSize: 0,
        status: 'pending',
        direction: 'receive'
      }]);
      // Reset receiver state
      setFoundSender(null);
      setReceiverCode('');
    } else {
      setStatus(`❌ Failed: ${result.error}`);
    }
  };

  const cancelSession = async (sessionId: string) => {
    await ipcRenderer.invoke('file-transfer:cancelTransfer', sessionId);
    // Clear the active pairing code when cancelling
    await ipcRenderer.invoke('file-transfer:setActivePairingCode', null);
    setIsWaiting(false);
    setStatus('Transfer cancelled');
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const activeSession = sessions.find(s => s.status === 'transferring' || s.status === 'waiting');

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-lg sm:text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Send Files
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Transfer files directly to devices on your local network
        </p>
      </div>

      {/* Device Info Card */}
      <div className={`rounded-xl p-4 mb-6 ${isDark ? 'bg-navy-800 border border-navy-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-teal-500/20' : 'bg-teal-50'}`}>
            <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{deviceInfo?.deviceName || 'Your Device'}</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Port: {deviceInfo?.port || '45679'}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex rounded-lg p-1 mb-6 ${isDark ? 'bg-navy-800' : 'bg-gray-100'}`}>
        <button
          onClick={() => setTab('send')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            tab === 'send' 
              ? isDark ? 'bg-teal-600 text-white shadow' : 'bg-white text-teal-600 shadow'
              : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Send
        </button>
        <button
          onClick={() => setTab('receive')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            tab === 'receive' 
              ? isDark ? 'bg-blue-600 text-white shadow' : 'bg-white text-blue-600 shadow'
              : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Receive
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {tab === 'send' ? (
          <>
            {/* File Selection */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-navy-800 border border-navy-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                1. Select Files to Send
              </label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={selectFiles}
                  disabled={isWaiting}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm transition flex items-center justify-center gap-2 ${
                    isDark 
                      ? 'bg-navy-900 border border-navy-700 text-gray-300 hover:text-white hover:border-teal-500 disabled:opacity-50' 
                      : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-teal-500 disabled:opacity-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Select Files
                </button>
                <button
                  onClick={selectFolder}
                  disabled={isWaiting}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm transition flex items-center justify-center gap-2 ${
                    isDark 
                      ? 'bg-navy-900 border border-navy-700 text-gray-300 hover:text-white hover:border-blue-500 disabled:opacity-50' 
                      : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-blue-500 disabled:opacity-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Select Folder
                </button>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className={`rounded-lg border max-h-40 overflow-y-auto ${isDark ? 'bg-navy-900 border-navy-700' : 'bg-gray-50 border-gray-200'}`}>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className={`flex items-center justify-between px-3 py-2 border-b last:border-0 ${isDark ? 'border-navy-700' : 'border-gray-200'}`}>
                      <span className={`text-sm truncate flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {file.split('/').pop()}
                      </span>
                      <button
                        onClick={() => removeFile(index)}
                        disabled={isWaiting}
                        className="text-gray-500 hover:text-red-400 p-1 disabled:opacity-50"
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

            {/* Pairing Code - DISPLAYED for receiver to enter */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-navy-800 border border-navy-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                2. Your Pairing Code (share with receiver)
              </label>
              <div className="flex gap-2 items-center justify-center">
                <div className={`flex-1 px-4 py-4 rounded-lg font-mono text-2xl tracking-[0.5em] text-center ${
                  isDark 
                    ? 'bg-navy-900 border border-navy-700 text-teal-400' 
                    : 'bg-gray-50 border border-gray-200 text-teal-600'
                }`}>
                  {pairingCode || '------'}
                </div>
                <button
                  onClick={generateCode}
                  disabled={isWaiting}
                  className={`px-4 py-4 rounded-lg transition ${
                    isDark 
                      ? 'bg-navy-900 border border-navy-700 text-gray-300 hover:text-white hover:border-teal-500 disabled:opacity-50' 
                      : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-teal-500 disabled:opacity-50'
                  }`}
                  title="Generate new code"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <p className={`text-xs mt-2 text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Share this code with the receiver. They will enter it to connect.
              </p>
            </div>

            {/* Send Button */}
            {!isWaiting ? (
              <button
                onClick={handleSend}
                disabled={selectedFiles.length === 0 || pairingCode.length !== 6}
                className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition flex items-center justify-center gap-2 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Prepare to Send {selectedFiles.length > 0 ? `(${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})` : ''}
              </button>
            ) : (
              <div className={`rounded-xl p-5 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className={`font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    Waiting for receiver...
                  </span>
                </div>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Tell the receiver to enter code <strong className="text-teal-500 text-lg">{pairingCode}</strong>
                </p>
                <button
                  onClick={() => waitingSessionId && cancelSession(waitingSessionId)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* RECEIVE TAB - Simplified: Only pairing code needed */}
            
            {/* Pairing Code Input */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-navy-800 border border-navy-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                1. Enter Sender's Pairing Code
              </label>
              <input
                type="text"
                value={receiverCode}
                onChange={(e) => {
                  setReceiverCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setFoundSender(null); // Clear found sender when code changes
                }}
                placeholder="000000"
                disabled={isSearchingSender}
                className={`w-full px-4 py-4 rounded-lg font-mono text-2xl tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                  isDark 
                    ? 'bg-navy-900 border border-navy-700 text-white placeholder-gray-600' 
                    : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
                maxLength={6}
              />
              <p className={`text-xs mt-2 text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Ask the sender for their 6-digit pairing code
              </p>
            </div>

            {/* Search Sender Button */}
            {!foundSender && (
              <button
                onClick={handleSearchSender}
                disabled={receiverCode.length !== 6 || isSearchingSender}
                className={`w-full py-4 rounded-xl font-medium transition flex items-center justify-center gap-2 text-lg ${
                  isSearchingSender
                    ? 'bg-yellow-600 text-white cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white'
                }`}
              >
                {isSearchingSender ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Searching for sender...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Find Sender
                  </>
                )}
              </button>
            )}

            {/* Found Sender */}
            {foundSender && (
              <div className={`rounded-xl p-4 ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                      Sender Found!
                    </div>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {foundSender.deviceName}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {foundSender.address}:{foundSender.port}
                    </div>
                  </div>
                </div>
                
                {/* Receive Files Button */}
                <button
                  onClick={handleReceive}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Receive Files
                </button>
                
                <button
                  onClick={() => {
                    setFoundSender(null);
                    setReceiverCode('');
                  }}
                  className="w-full mt-2 text-sm text-gray-400 hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Instructions */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-navy-800/50 border border-navy-700' : 'bg-gray-50 border border-gray-200'}`}>
              <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                How to receive files:
              </h4>
              <ol className={`text-sm space-y-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <li className="flex items-start gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>1</span>
                  <span>Ask the sender to prepare their files and click "Prepare to Send"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>2</span>
                  <span>Enter the <strong>6-digit pairing code</strong> they give you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>3</span>
                  <span>Click "Find Sender" - the app will automatically find them on your network</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>4</span>
                  <span>Once found, click "Receive Files" and choose where to save</span>
                </li>
              </ol>
            </div>
          </>
        )}

        {/* Active Transfer Progress */}
        {activeSession && activeSession.status === 'transferring' && (
          <div className={`rounded-xl p-4 ${isDark ? 'bg-navy-800 border border-navy-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {activeSession.direction === 'send' ? '↑ Sending...' : '↓ Receiving...'}
              </span>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{activeSession.speed}</span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-navy-700' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${activeSession.progress || 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {formatSize(activeSession.transferredSize)} / {formatSize(activeSession.totalSize)}
              </span>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {activeSession.progress || 0}%
              </span>
            </div>
            <button
              onClick={() => cancelSession(activeSession.id)}
              className="mt-3 text-sm text-red-400 hover:text-red-300"
            >
              Cancel Transfer
            </button>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className={`p-4 rounded-xl text-sm text-center ${
            status.includes('✓') 
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : status.includes('❌')
              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
          }`}>
            {status}
          </div>
        )}

        {/* Transfer History */}
        {sessions.filter(s => s.status === 'completed' || s.status === 'failed').length > 0 && (
          <div className={`rounded-xl p-4 ${isDark ? 'bg-navy-800 border border-navy-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Recent Transfers</h3>
            <div className="space-y-2">
              {sessions.filter(s => s.status === 'completed' || s.status === 'failed').slice(-5).map(session => (
                <div key={session.id} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-navy-900' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={session.status === 'completed' ? 'text-green-400' : 'text-red-400'}>
                      {session.status === 'completed' ? '✓' : '✗'}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {session.direction === 'send' ? '↑' : '↓'} {session.files.length} file(s)
                    </span>
                  </div>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {formatSize(session.totalSize)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LANFileTransferPage;
