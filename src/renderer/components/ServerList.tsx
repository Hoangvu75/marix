import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  icon?: string;
  protocol?: 'ssh' | 'js-ssh' | 'ftp' | 'ftps' | 'rdp' | 'wss' | 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'sqlite';
  wssUrl?: string;
  tags?: string[];
  jsScript?: string;
}

interface Props {
  servers: Server[];
  connectingServerId?: string | null;
  onConnect: (server: Server) => void;
  onConnectSFTP?: (server: Server) => void;
  onEdit: (server: Server) => void;
  onDelete: (id: string) => void;
  onShareOnLAN?: (serverIds: string[]) => void;
  selectedServerIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onReorder?: (servers: Server[]) => void;
  onAddNew?: () => void;
  onQuickConnect?: () => void;
}

// Protocol colors and icons
const PROTOCOL_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  ssh: { 
    color: '#10b981', 
    bgColor: 'bg-emerald-500/10',
    label: 'SSH',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  rdp: { 
    color: '#3b82f6', 
    bgColor: 'bg-blue-500/10',
    label: 'RDP',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  ftp: { 
    color: '#f59e0b', 
    bgColor: 'bg-amber-500/10',
    label: 'FTP',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    )
  },
  ftps: { 
    color: '#f97316', 
    bgColor: 'bg-orange-500/10',
    label: 'FTPS',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    )
  },
  wss: { 
    color: '#8b5cf6', 
    bgColor: 'bg-violet-500/10',
    label: 'WSS',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    )
  },
  // Database protocols - Unified database icon
  mysql: { 
    color: '#64748b', 
    bgColor: 'bg-transparent',
    label: 'MySQL',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
      </svg>
    )
  },
  postgresql: { 
    color: '#64748b', 
    bgColor: 'bg-transparent',
    label: 'PostgreSQL',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
      </svg>
    )
  },
  mongodb: { 
    color: '#64748b', 
    bgColor: 'bg-transparent',
    label: 'MongoDB',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
      </svg>
    )
  },
  redis: { 
    color: '#64748b', 
    bgColor: 'bg-transparent',
    label: 'Redis',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
      </svg>
    )
  },
  sqlite: { 
    color: '#64748b', 
    bgColor: 'bg-transparent',
    label: 'SQLite',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
      </svg>
    )
  },
};

const ServerList: React.FC<Props> = ({
  servers,
  connectingServerId,
  onConnect,
  onConnectSFTP,
  onEdit, 
  onDelete, 
  onShareOnLAN,
  selectedServerIds = [],
  onSelectionChange,
  onReorder,
  onAddNew,
  onQuickConnect,
}) => {
  const { t } = useLanguage();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server: Server } | null>(null);
  const [emptyContextMenu, setEmptyContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  
  // Drag and drop state
  const [draggedServer, setDraggedServer] = useState<Server | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, server: Server) => {
    setDraggedServer(server);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', server.id);
    // Add dragging class after a small delay to prevent visual glitch
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedServer(null);
    setDragOverId(null);
    (e.target as HTMLElement).classList.remove('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent, serverId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedServer && draggedServer.id !== serverId) {
      setDragOverId(serverId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetServer: Server) => {
    e.preventDefault();
    if (!draggedServer || draggedServer.id === targetServer.id || !onReorder) {
      setDragOverId(null);
      return;
    }

    const newServers = [...servers];
    const draggedIndex = newServers.findIndex(s => s.id === draggedServer.id);
    const targetIndex = newServers.findIndex(s => s.id === targetServer.id);

    // Remove dragged item and insert at new position
    newServers.splice(draggedIndex, 1);
    newServers.splice(targetIndex, 0, draggedServer);

    onReorder(newServers);
    setDragOverId(null);
  };

  // Get all unique tags from servers
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    servers.forEach(server => {
      server.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [servers]);

  // Get tag statistics (count servers per tag)
  const tagStats = useMemo(() => {
    const stats: { [tag: string]: number } = {};
    servers.forEach(server => {
      server.tags?.forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1;
      });
    });
    return stats;
  }, [servers]);

  // Select servers by tag
  const selectByTag = (tag: string) => {
    if (!onSelectionChange) return;
    const serversByTag = servers.filter(s => s.tags?.includes(tag)).map(s => s.id);
    const newSelection = [...new Set([...selectedServerIds, ...serversByTag])];
    onSelectionChange(newSelection);
    setShowTagSelector(false);
  };

  // Toggle server selection
  const toggleSelection = (serverId: string) => {
    if (!onSelectionChange) return;
    
    const newSelection = selectedServerIds.includes(serverId)
      ? selectedServerIds.filter(id => id !== serverId)
      : [...selectedServerIds, serverId];
    
    onSelectionChange(newSelection);
  };

  // Select all visible servers
  const selectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(filteredServers.map(s => s.id));
  };

  // Clear selection
  const clearSelection = () => {
    if (!onSelectionChange) return;
    onSelectionChange([]);
    setIsMultiSelectMode(false);
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setEmptyContextMenu(null);
      setShowTagSelector(false);
    };
    if (contextMenu || emptyContextMenu || showTagSelector) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu, emptyContextMenu, showTagSelector]);

  const handleContextMenu = (e: React.MouseEvent, server: Server) => {
    e.preventDefault();
    e.stopPropagation();
    setEmptyContextMenu(null);
    setContextMenu({ x: e.clientX, y: e.clientY, server });
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setEmptyContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Filter servers by search
  const filteredServers = useMemo(() => {
    if (!searchTerm.trim()) return servers;
    const term = searchTerm.toLowerCase();
    return servers.filter(s =>
      s.name.toLowerCase().includes(term) ||
      s.host.toLowerCase().includes(term) ||
      s.username.toLowerCase().includes(term) ||
      s.tags?.some(tag => tag.toLowerCase().includes(term))
    );
  }, [servers, searchTerm]);

  // Empty state
  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <div className="w-16 h-16 rounded-full bg-navy-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-white mb-1">{t('noHostsConfigured') || 'No servers configured'}</h3>
        <p className="text-sm text-gray-500">{t('clickNewHostToStart') || 'Click "Add New Host" to add your first server'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and LAN Discovery Toggle */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-2 relative z-10">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchServers') || 'Search servers...'}
              className="w-full pl-9 pr-8 py-2 bg-navy-800/60 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 transition-all"
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white z-10">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Multi-Select Controls - only show when selecting */}
        {onShareOnLAN && isMultiSelectMode && (
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <span className="text-xs text-gray-400">
                  {selectedServerIds.length} selected
                </span>
                <button
                  onClick={selectAll}
                  className="text-xs px-2 py-1 text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Select All
                </button>
                
                {/* Select by Tag dropdown */}
                {allTags.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowTagSelector(!showTagSelector)}
                      className="text-xs px-2 py-1 text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      By Tag
                    </button>
                    
                    {showTagSelector && (
                      <div 
                        className="absolute top-full left-0 mt-1 bg-navy-800 border border-navy-700 rounded-lg shadow-xl z-50 min-w-[180px] max-h-[200px] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {allTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => selectByTag(tag)}
                            className="w-full px-3 py-2 text-left text-xs text-white hover:bg-navy-700 transition-colors flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{tag}</span>
                            <span className="text-gray-500 text-[10px] bg-navy-900 px-1.5 py-0.5 rounded">
                              {tagStats[tag]}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <button
                  onClick={clearSelection}
                  className="text-xs px-2 py-1 text-gray-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
                {selectedServerIds.length > 0 && (
                  <button
                    onClick={() => {
                      onShareOnLAN(selectedServerIds);
                      setIsMultiSelectMode(false);
                    }}
                    className="ml-auto text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share ({selectedServerIds.length})
                  </button>
                )}
              </div>
          </div>
        )}
        
        {searchTerm && (
          <p className="text-xs text-gray-500">{filteredServers.length} result{filteredServers.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Server Grid */}
      <div 
        className="flex-1 overflow-y-auto px-4 pb-4"
        onContextMenu={handleEmptyContextMenu}
      >
        {filteredServers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32">
            <p className="text-sm text-gray-400">{t('noMatchingServers') || 'No servers found'}</p>
            <button onClick={() => setSearchTerm('')} className="text-xs text-teal-400 hover:text-teal-300 mt-2">
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filteredServers.map(server => {
              const protocol = PROTOCOL_CONFIG[server.protocol || 'ssh'];
              const isHovered = hoveredId === server.id;
              const isSelected = selectedServerIds.includes(server.id);
              const isConnecting = connectingServerId === server.id;
              const connectionStr = server.protocol === 'wss' 
                ? (server.wssUrl || server.host)
                : `${server.username}@${server.host}:${server.port}`;

              return (
                <div
                  key={server.id}
                  draggable={!isMultiSelectMode && !searchTerm}
                  onDragStart={(e) => handleDragStart(e, server)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, server.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, server)}
                  className={`group relative bg-navy-800 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isConnecting
                      ? 'border-amber-500 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/30'
                      : isSelected
                      ? 'border-teal-500 shadow-lg shadow-teal-500/20 ring-2 ring-teal-500/30'
                      : dragOverId === server.id
                      ? 'border-teal-400 border-dashed bg-teal-500/10'
                      : isHovered 
                      ? 'border-teal-500/50 shadow-lg shadow-teal-500/10' 
                      : 'border-navy-700 hover:border-navy-600'
                  }`}
                  onMouseEnter={() => setHoveredId(server.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => {
                    if (isMultiSelectMode) {
                      e.stopPropagation();
                      toggleSelection(server.id);
                    } else {
                      onConnect(server);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, server)}
                >
                  {/* Multi-select checkbox */}
                  {isMultiSelectMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-teal-500 border-teal-500'
                            : 'bg-navy-900 border-navy-600 hover:border-teal-500'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(server.id);
                        }}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Protocol indicator */}
                  <div 
                    className="absolute top-0 left-4 w-8 h-1 rounded-b-full"
                    style={{ backgroundColor: protocol.color }}
                  />

                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {/* Protocol icon */}
                        <div 
                          className={`w-9 h-9 rounded-lg ${protocol.bgColor} flex items-center justify-center`}
                          style={{ color: protocol.color }}
                        >
                          {protocol.icon}
                        </div>
                        <span 
                          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${protocol.color}20`, color: protocol.color }}
                        >
                          {protocol.label}
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className={`flex gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(server); }}
                          className="p-1.5 rounded hover:bg-navy-700 text-gray-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(server.id); }}
                          className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Server name with connecting indicator */}
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white text-sm truncate flex-1">{server.name}</h3>
                      {isConnecting && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-amber-400 text-xs">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {t('connecting') || 'Connecting...'}
                        </span>
                      )}
                    </div>
                    
                    {/* Host or Script indicator */}
                    <p className="text-xs text-gray-500 font-mono truncate">
                      {server.jsScript
                        ? (t('jsSSHDynamicCredentials') || 'JS Script → dynamic credentials')
                        : server.protocol === 'wss'
                          ? (server.wssUrl || server.host)
                          : server.host}
                    </p>

                    {/* Tags */}
                    {server.tags && server.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {server.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700 text-gray-400">
                            {tag}
                          </span>
                        ))}
                        {server.tags.length > 2 && (
                          <span className="text-[10px] text-gray-500">+{server.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-navy-800 border border-navy-700 rounded-lg shadow-2xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onConnect(contextMenu.server);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-navy-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t('connect')}
          </button>
          {/* SFTP Direct Connect - only for SSH servers */}
          {onConnectSFTP && (!contextMenu.server.protocol || contextMenu.server.protocol === 'ssh') && (
            <button
              onClick={() => {
                onConnectSFTP(contextMenu.server);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-teal-400 hover:bg-navy-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {t('sftp')}
            </button>
          )}
          <button
            onClick={() => {
              onEdit(contextMenu.server);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-navy-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {t('edit')}
          </button>
          {onShareOnLAN && (
            <>
              <button
                onClick={() => {
                  onShareOnLAN([contextMenu.server.id]);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-navy-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {t('shareOnLAN')}
              </button>
              
              {/* Share by tag submenu */}
              {contextMenu.server.tags && contextMenu.server.tags.length > 0 && (
                <div className="relative group/submenu">
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-purple-400 hover:bg-navy-700 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Share by Tag</span>
                    </div>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  {/* Submenu */}
                  <div className="absolute left-full top-0 ml-1 bg-navy-800 border border-navy-700 rounded-lg shadow-2xl py-1 min-w-[160px] opacity-0 invisible group-hover/submenu:opacity-100 group-hover/submenu:visible transition-all">
                    {contextMenu.server.tags.map(tag => {
                      const count = tagStats[tag] || 0;
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            selectByTag(tag);
                            setContextMenu(null);
                            setIsMultiSelectMode(true);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-white hover:bg-navy-700 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{tag}</span>
                          <span className="text-gray-500 text-[10px] bg-navy-900 px-1.5 py-0.5 rounded">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="border-t border-navy-700 my-1" />
          <button
            onClick={() => {
              onDelete(contextMenu.server.id);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('delete')}
          </button>
        </div>
      )}

      {/* Empty Area Context Menu */}
      {emptyContextMenu && (
        <div
          className="fixed bg-navy-800 border border-navy-700 rounded-lg shadow-2xl py-1 min-w-[180px] z-50"
          style={{ top: emptyContextMenu.y, left: emptyContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {onQuickConnect && (
            <button
              onClick={() => {
                onQuickConnect();
                setEmptyContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-navy-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('quickConnect') || 'Quick Connect'}
            </button>
          )}
          {onAddNew && (
            <button
              onClick={() => {
                onAddNew();
                setEmptyContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-navy-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('addNewHost') || 'New Host'}
            </button>
          )}
          {!onQuickConnect && !onAddNew && (
            <div className="px-4 py-2 text-sm text-gray-500">
              {t('noActionsAvailable')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ServerList);
