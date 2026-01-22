import React, { useState, useEffect } from 'react';
import FileEditor from './FileEditor';

const { ipcRenderer } = window.electron;

interface FileInfo {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifyTime: number;
}

interface Props {
  connectionId: string;
  server: {
    host: string;
    port: number;
    username: string;
    password?: string;
  };
}

// Track SFTP connections globally to persist across tab switches
const sftpConnections = new Map<string, boolean>();

const FileExplorer: React.FC<Props> = ({ connectionId, server }) => {
  const [path, setPath] = useState('/');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(sftpConnections.get(connectionId) || false);
  const [error, setError] = useState<string | null>(null);
  
  // File editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<{ name: string; path: string } | null>(null);

  // Connect SFTP only if not already connected
  useEffect(() => {
    const connectSFTP = async () => {
      // Check if already connected globally
      if (sftpConnections.get(connectionId)) {
        setConnected(true);
        loadFiles(path);
        return;
      }
      
      setLoading(true);
      setError(null);
      try {
        console.log('[FileExplorer] Connecting SFTP...');
        const result = await ipcRenderer.invoke('sftp:connect', connectionId, {
          host: server.host,
          port: server.port,
          username: server.username,
          password: server.password,
        });
        
        if (result.success) {
          console.log('[FileExplorer] SFTP connected');
          sftpConnections.set(connectionId, true);
          setConnected(true);
          loadFiles('/');
        } else {
          setError(result.error || 'SFTP connection failed');
        }
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };
    
    connectSFTP();
  }, [connectionId]);

  useEffect(() => {
    if (connected) {
      loadFiles(path);
    }
  }, [path]);

  const loadFiles = async (p: string) => {
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('sftp:list', connectionId, p);
      if (result.success) {
        setFiles(result.files.sort((a: FileInfo, b: FileInfo) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        }));
        setError(null);
      } else {
        // Connection might be lost, try to reconnect
        if (result.error?.includes('not connected') || result.error?.includes('No SFTP')) {
          console.log('[FileExplorer] Connection lost, attempting reconnect...');
          sftpConnections.delete(connectionId);
          setConnected(false);
          
          // Auto reconnect
          const reconnectResult = await ipcRenderer.invoke('sftp:connect', connectionId, {
            host: server.host,
            port: server.port,
            username: server.username,
            password: server.password,
          });
          
          if (reconnectResult.success) {
            sftpConnections.set(connectionId, true);
            setConnected(true);
            // Retry load
            const retryResult = await ipcRenderer.invoke('sftp:list', connectionId, p);
            if (retryResult.success) {
              setFiles(retryResult.files.sort((a: FileInfo, b: FileInfo) => {
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
              }));
              setError(null);
            }
          } else {
            setError('Reconnect failed: ' + reconnectResult.error);
          }
        } else {
          setError(result.error);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
    setLoading(false);
  };

  const goUp = () => {
    if (path !== '/') {
      const parts = path.split('/').filter(Boolean);
      parts.pop();
      setPath(parts.length > 0 ? '/' + parts.join('/') : '/');
    }
  };

  const openDir = (name: string) => {
    setPath(path === '/' ? `/${name}` : `${path}/${name}`);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const download = async (name: string) => {
    const remotePath = path === '/' ? `/${name}` : `${path}/${name}`;
    const localPath = `/tmp/${name}`;
    try {
      const result = await ipcRenderer.invoke('sftp:download', connectionId, remotePath, localPath);
      if (result.success) {
        alert(`Downloaded to ${localPath}`);
      } else {
        alert('Download failed: ' + result.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Open file in editor
  const openFile = (name: string) => {
    const remotePath = path === '/' ? `/${name}` : `${path}/${name}`;
    console.log('[FileExplorer] Opening file:', name, remotePath);
    setEditingFile({ name, path: remotePath });
    setEditorOpen(true);
  };

  // Check if file is editable (text-based)
  const isEditable = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const editableExts = [
      // Code
      'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp',
      'cs', 'go', 'rs', 'swift', 'kt', 'scala', 'lua', 'r', 'pl', 'ex', 'exs', 'erl',
      // Web
      'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
      // Config
      'json', 'jsonc', 'yml', 'yaml', 'toml', 'ini', 'conf', 'cfg', 'env',
      'xml', 'svg', 'plist',
      // Shell
      'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
      // Docs
      'md', 'markdown', 'txt', 'log', 'rst', 'tex',
      // Data
      'sql', 'csv', 'tsv',
      // Docker
      'dockerfile',
    ];
    const lowerName = filename.toLowerCase();
    // Check special files
    if (lowerName === 'dockerfile' || lowerName === 'makefile' || 
        lowerName === 'caddyfile' || lowerName === 'vagrantfile' ||
        lowerName.startsWith('.env') || lowerName.startsWith('.git') ||
        lowerName.endsWith('rc') || lowerName.endsWith('ignore')) {
      return true;
    }
    return editableExts.includes(ext);
  };

  // Show loading while connecting
  if (!connected && loading) {
    return (
      <div className="h-full flex items-center justify-center bg-navy-900">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-400">Connecting SFTP...</p>
        </div>
      </div>
    );
  }

  // Show error if connection failed
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-navy-900">
        <div className="text-center p-4">
          <div className="text-red-400 mb-2">⚠️ SFTP Connection Failed</div>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-navy-900">
      {/* Toolbar */}
      <div className="bg-navy-800 border-b border-navy-700 p-3 flex items-center gap-2">
        <button
          onClick={goUp}
          disabled={path === '/'}
          className="p-2 hover:bg-navy-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition text-gray-400 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <button
          onClick={() => loadFiles(path)}
          className="p-2 hover:bg-navy-700 rounded-lg transition text-gray-400 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="flex-1 px-3 py-2 bg-navy-900 rounded-lg text-sm font-mono border border-navy-700">
          <span className="text-teal-500">~</span><span className="text-white">{path}</span>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-600">Empty directory</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy-800 sticky top-0 border-b border-navy-700">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Size</th>
                <th className="p-3 font-medium">Modified</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => (
                <tr
                  key={i}
                  className="border-t border-navy-800 hover:bg-navy-800 transition cursor-pointer"
                  onDoubleClick={() => {
                    if (file.type === 'directory') {
                      openDir(file.name);
                    } else if (isEditable(file.name)) {
                      openFile(file.name);
                    }
                  }}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {file.type === 'directory' ? (
                        <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      )}
                      <span className="font-medium">{file.name}</span>
                      {file.type === 'file' && isEditable(file.name) && (
                        <span className="text-xs text-teal-500 opacity-50">✎</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-gray-500">
                    {file.type === 'file' ? formatSize(file.size) : '-'}
                  </td>
                  <td className="p-3 text-gray-500">
                    {new Date(file.modifyTime).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {file.type === 'file' && (
                      <div className="flex items-center gap-2">
                        {isEditable(file.name) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFile(file.name);
                            }}
                            className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg transition font-medium"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            download(file.name);
                          }}
                          className="px-3 py-1 text-xs bg-teal-600 hover:bg-teal-700 rounded-lg transition font-medium"
                        >
                          Download
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* File Editor Modal */}
      {editingFile && (
        <FileEditor
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditingFile(null);
          }}
          connectionId={connectionId}
          remotePath={editingFile.path}
          fileName={editingFile.name}
          onSave={() => {
            // Refresh file list to update modify time
            loadFiles(path);
          }}
        />
      )}
    </div>
  );
};

export default FileExplorer;
