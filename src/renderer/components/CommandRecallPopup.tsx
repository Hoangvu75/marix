/**
 * Command Recall Popup
 * 
 * A command palette style popup for recalling previously used commands.
 * Triggered by Tab key when terminal input is empty.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { commandRecallStore, RecalledCommand } from '../services/commandRecallStore';

interface Props {
  serverId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (command: string) => void;
  onSaveAsSnippet: (command: string) => void;
  theme?: 'dark' | 'light';
}

const CommandRecallPopup: React.FC<Props> = ({
  serverId,
  isOpen,
  onClose,
  onSelectCommand,
  onSaveAsSnippet,
  theme = 'dark',
}) => {
  const { t } = useLanguage();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commands, setCommands] = useState<RecalledCommand[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load commands
  useEffect(() => {
    if (isOpen) {
      const history = commandRecallStore.getHistory(serverId);
      setCommands(history);
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, serverId]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands;
    const q = searchQuery.toLowerCase();
    return commands.filter(c => c.command.toLowerCase().includes(q));
  }, [commands, searchQuery]);

  // Keep selection in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const items = listRef.current.querySelectorAll('[data-command-item]');
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredCommands.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelectCommand(filteredCommands[selectedIndex].command);
          onClose();
        }
        break;
      case 'Escape':
      case 'Tab':
        e.preventDefault();
        onClose();
        break;
      case 'Delete':
        // Ctrl+Delete to remove command
        if (e.ctrlKey && filteredCommands[selectedIndex]) {
          e.preventDefault();
          commandRecallStore.deleteCommand(serverId, filteredCommands[selectedIndex].id);
          setCommands(commandRecallStore.getHistory(serverId));
        }
        break;
    }
  }, [filteredCommands, selectedIndex, serverId, onSelectCommand, onClose]);

  // Handle save as snippet
  const handleSaveAsSnippet = useCallback((command: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveAsSnippet(command);
    onClose();
  }, [onSaveAsSnippet, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Popup */}
      <div
        className={`relative w-full max-w-xl mx-4 rounded-lg shadow-2xl overflow-hidden ${isDark ? 'bg-navy-800 border border-navy-600' : 'bg-white border border-gray-200'
          }`}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className={`p-3 border-b ${isDark ? 'border-navy-600' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('commandRecallSearch')}
              className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                }`}
            />
            <kbd className={`px-2 py-0.5 text-xs rounded ${isDark ? 'bg-navy-700 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
              Esc
            </kbd>
          </div>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto"
        >
          {filteredCommands.length === 0 ? (
            <div className={`p-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {commands.length === 0 ? (
                <>
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">{t('commandRecallEmpty')}</p>
                  <p className="text-xs mt-1 opacity-70">{t('commandRecallEmptyHint')}</p>
                </>
              ) : (
                <p className="text-sm">{t('commandRecallNoMatch')}</p>
              )}
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                data-command-item
                onClick={() => {
                  onSelectCommand(cmd.command);
                  onClose();
                }}
                className={`group px-3 py-2 cursor-pointer flex items-center gap-3 ${index === selectedIndex
                    ? isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'
                    : isDark ? 'hover:bg-navy-700' : 'hover:bg-gray-50'
                  }`}
              >
                {/* Command Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${isDark ? 'bg-navy-700' : 'bg-gray-100'
                  }`}>
                  <svg className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* Command Text */}
                <div className="flex-1 min-w-0">
                  <code className={`block text-sm font-mono truncate ${isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                    {cmd.command}
                  </code>
                  <div className={`flex items-center gap-3 mt-0.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                    <span>{commandRecallStore.formatRelativeTime(cmd.lastUsedAt)}</span>
                    <span>•</span>
                    <span>{cmd.execCount}x</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Save as Snippet */}
                  <button
                    onClick={(e) => handleSaveAsSnippet(cmd.command, e)}
                    className={`p-1.5 rounded ${isDark
                        ? 'hover:bg-navy-600 text-gray-400 hover:text-emerald-400'
                        : 'hover:bg-gray-200 text-gray-500 hover:text-emerald-600'
                      }`}
                    title={t('commandRecallSaveSnippet')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      commandRecallStore.deleteCommand(serverId, cmd.id);
                      setCommands(commandRecallStore.getHistory(serverId));
                    }}
                    className={`p-1.5 rounded ${isDark
                        ? 'hover:bg-navy-600 text-gray-400 hover:text-red-400'
                        : 'hover:bg-gray-200 text-gray-500 hover:text-red-600'
                      }`}
                    title={t('commandRecallDelete')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`px-3 py-2 border-t text-xs flex items-center justify-between ${isDark ? 'border-navy-600 text-gray-500' : 'border-gray-200 text-gray-400'
          }`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-navy-700' : 'bg-gray-100'}`}>↑↓</kbd>
              {t('commandRecallNavigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-navy-700' : 'bg-gray-100'}`}>Enter</kbd>
              {t('commandRecallInsert')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-navy-700' : 'bg-gray-100'}`}>Ctrl+Del</kbd>
              {t('commandRecallClose')}
            </span>
          </div>
          <span>{filteredCommands.length} {t('wssMessages')}</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CommandRecallPopup);
