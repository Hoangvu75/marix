/**
 * Command Recall Panel
 * 
 * Side panel for terminal sessions showing command history.
 * Style matches SnippetPanel - positioned on the left.
 * Right-click context menu for Save as Snippet / Delete.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { commandRecallStore, RecalledCommand } from '../services/commandRecallStore';

interface CommandRecallPanelProps {
  theme: 'dark' | 'light';
  serverId: string;
  onInsertCommand: (command: string) => void;
  onSaveAsSnippet?: (command: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  command: RecalledCommand | null;
}

const CommandRecallPanel: React.FC<CommandRecallPanelProps> = ({
  theme,
  serverId,
  onInsertCommand,
  onSaveAsSnippet,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { t } = useLanguage();
  const isDark = theme === 'dark';
  
  const [commands, setCommands] = useState<RecalledCommand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    command: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load commands
  useEffect(() => {
    const loadCommands = () => {
      const history = commandRecallStore.getHistory(serverId);
      setCommands(history);
    };
    
    loadCommands();
    const unsubscribe = commandRecallStore.subscribe(loadCommands);
    return () => unsubscribe();
  }, [serverId]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands;
    const q = searchQuery.toLowerCase();
    return commands.filter(c => c.command.toLowerCase().includes(q));
  }, [commands, searchQuery]);

  // Handle command click
  const handleInsert = useCallback((command: string) => {
    onInsertCommand(command);
  }, [onInsertCommand]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, cmd: RecalledCommand) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate position relative to panel
    const rect = panelRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);
    const y = e.clientY - (rect?.top || 0);
    
    setContextMenu({
      visible: true,
      x,
      y,
      command: cmd,
    });
  }, []);

  // Handle delete from context menu
  const handleDelete = useCallback(() => {
    if (contextMenu.command) {
      commandRecallStore.deleteCommand(serverId, contextMenu.command.id);
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  }, [serverId, contextMenu.command]);

  // Handle save as snippet from context menu
  const handleSaveAsSnippet = useCallback(() => {
    if (contextMenu.command && onSaveAsSnippet) {
      onSaveAsSnippet(contextMenu.command.command);
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  }, [contextMenu.command, onSaveAsSnippet]);

  // Collapsed state - show mini toggle button
  if (isCollapsed) {
    return (
      <div 
        className="flex flex-col items-center py-4 px-1"
        style={{ 
          backgroundColor: isDark ? '#1e293b' : '#0891b2',
          borderRight: isDark ? '1px solid #334155' : '1px solid #0e7490'
        }}
      >
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg transition hover:bg-white/10"
          style={{ color: 'white' }}
          title={(t as any).commandRecall || 'Command History'}
          tabIndex={-1}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <span 
          className="text-xs mt-2 font-bold"
          style={{ writingMode: 'vertical-rl', color: 'white' }}
        >
          {(t as any).commandRecall || 'History'}
        </span>
        {commands.length > 0 && (
          <span 
            className="mt-2 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            {commands.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={panelRef}
      className="w-72 flex flex-col h-full relative"
      style={{ 
        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
        borderRight: isDark ? '1px solid #334155' : '3px solid #0891b2'
      }}
    >
      {/* Context Menu */}
      {contextMenu.visible && contextMenu.command && (
        <div
          className="absolute z-50 py-1 rounded-lg shadow-xl min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: isDark ? '#1e293b' : 'white',
            border: isDark ? '1px solid #475569' : '1px solid #e2e8f0',
            boxShadow: isDark 
              ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' 
              : '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Save as Snippet */}
          {onSaveAsSnippet && (
            <button
              onClick={handleSaveAsSnippet}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors"
              style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
              tabIndex={-1}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {(t as any).commandRecallSaveSnippet || 'Save as Snippet'}
            </button>
          )}
          
          {/* Divider */}
          {onSaveAsSnippet && (
            <div 
              className="my-1"
              style={{ borderTop: isDark ? '1px solid #475569' : '1px solid #e2e8f0' }}
            />
          )}
          
          {/* Delete */}
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-red-500"
            tabIndex={-1}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? '#450a0a' : '#fef2f2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {(t as any).delete || 'Delete'}
          </button>
        </div>
      )}

      {/* Header - Cyan theme */}
      <div 
        className="flex items-center justify-between px-3 py-3"
        style={{ 
          backgroundColor: isDark ? '#0f172a' : '#0891b2',
          borderBottom: isDark ? '1px solid #334155' : '1px solid #0e7490'
        }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" style={{ color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-bold" style={{ color: 'white' }}>
            {(t as any).commandRecall || 'History'}
          </span>
          <span 
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            {filteredCommands.length}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg transition hover:bg-white/20"
          style={{ color: 'white' }}
          title={(t as any).snippetHidePanel || 'Collapse'}
          tabIndex={-1}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div 
        className="px-3 py-3"
        style={{ 
          backgroundColor: isDark ? '#1e293b' : 'white',
          borderBottom: isDark ? '1px solid #334155' : '2px solid #e2e8f0'
        }}
      >
        <div className="relative">
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" 
            style={{ color: isDark ? '#64748b' : '#64748b' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={(t as any).commandRecallSearch || 'Search commands...'}
            className="w-full pl-10 pr-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2"
            tabIndex={-1}
            style={{ 
              backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
              border: isDark ? '1px solid #334155' : '2px solid #cbd5e1',
              color: isDark ? 'white' : '#0f172a',
              fontWeight: 500
            }}
          />
        </div>
      </div>

      {/* Command List */}
      <div 
        className="flex-1 overflow-y-auto px-2 py-2"
        style={{ backgroundColor: isDark ? '#1e293b' : 'white' }}
      >
        {commands.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <svg 
              className="w-12 h-12 mb-3" 
              style={{ color: isDark ? '#475569' : '#94a3b8' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p 
              className="text-sm font-bold"
              style={{ color: isDark ? '#64748b' : '#475569' }}
            >
              {(t as any).commandRecallEmpty || 'No commands yet'}
            </p>
            <p 
              className="text-xs mt-1"
              style={{ color: isDark ? '#475569' : '#64748b' }}
            >
              {(t as any).commandRecallEmptyHint || 'Commands will appear here'}
            </p>
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p 
              className="text-sm font-bold"
              style={{ color: isDark ? '#64748b' : '#475569' }}
            >
              {(t as any).commandRecallNoMatch || 'No matches found'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredCommands.map((cmd) => (
              <div
                key={cmd.id}
                onClick={() => handleInsert(cmd.command)}
                onContextMenu={(e) => handleContextMenu(e, cmd)}
                className="px-2 py-2 rounded-lg cursor-pointer transition-all"
                style={{ 
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#e0f2fe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Command */}
                <div className="flex items-start gap-2">
                  <div 
                    className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: isDark ? '#0f172a' : '#cffafe' }}
                  >
                    <svg 
                      className="w-3.5 h-3.5" 
                      style={{ color: isDark ? '#22d3ee' : '#0891b2' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <code 
                      className="block text-xs font-mono truncate"
                      style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                      title={cmd.command}
                    >
                      {cmd.command}
                    </code>
                    
                    {/* Meta info */}
                    <div 
                      className="flex items-center gap-2 mt-1 text-xs"
                      style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                    >
                      <span>{commandRecallStore.formatRelativeTime(cmd.lastUsedAt)}</span>
                      <span>•</span>
                      <span>{cmd.execCount}x</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div 
        className="px-3 py-2 text-xs"
        style={{ 
          backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
          borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          color: isDark ? '#64748b' : '#64748b'
        }}
      >
        <div className="flex items-center justify-between">
          <span>{(t as any).rightClickForOptions || 'Right-click for options'}</span>
          {commands.length > 0 && (
            <button
              onClick={() => {
                if (confirm((t as any).commandRecallClearAll || 'Clear all history?')) {
                  commandRecallStore.clearServerHistory(serverId);
                }
              }}
              className="text-red-400 hover:text-red-300 transition"
              tabIndex={-1}
            >
              {(t as any).commandRecallClearAll || 'Clear'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(CommandRecallPanel);
