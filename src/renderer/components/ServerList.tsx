import React, { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  icon?: string;
  protocol?: 'ssh' | 'ftp' | 'ftps' | 'rdp' | 'wss';
  wssUrl?: string;
  tags?: string[];
}

interface Props {
  servers: Server[];
  onConnect: (server: Server) => void;
  onEdit: (server: Server) => void;
  onDelete: (id: string) => void;
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
};

const ServerList: React.FC<Props> = ({ servers, onConnect, onEdit, onDelete }) => {
  const { t } = useLanguage();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      {/* Search */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchServers') || 'Search servers...'}
            className="w-full pl-9 pr-8 py-2 bg-navy-800/60 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchTerm && (
          <p className="text-xs text-gray-500 mt-2">{filteredServers.length} result{filteredServers.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Server Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
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
              const connectionStr = server.protocol === 'wss' 
                ? (server.wssUrl || server.host)
                : `${server.username}@${server.host}:${server.port}`;

              return (
                <div
                  key={server.id}
                  className={`group relative bg-navy-800 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isHovered 
                      ? 'border-teal-500/50 shadow-lg shadow-teal-500/10' 
                      : 'border-navy-700 hover:border-navy-600'
                  }`}
                  onMouseEnter={() => setHoveredId(server.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onConnect(server)}
                >
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

                    {/* Server name */}
                    <h3 className="font-semibold text-white text-sm truncate mb-1">{server.name}</h3>
                    
                    {/* Host */}
                    <p className="text-xs text-gray-500 font-mono truncate">
                      {server.protocol === 'wss' ? (server.wssUrl || server.host) : server.host}
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
    </div>
  );
};

export default React.memo(ServerList);
