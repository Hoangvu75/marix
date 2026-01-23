import React, { useState, useEffect } from 'react';
import { getAllThemes, ThemeInfo } from '../themeService';

interface Props {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  direction?: 'up' | 'down';
}

const ThemeSelector: React.FC<Props> = ({ currentTheme, onThemeChange, direction = 'up' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Load themes on mount
  useEffect(() => {
    getAllThemes().then(list => {
      setThemes(list);
      setLoading(false);
    });
  }, []);

  const filteredThemes = themes.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const isUp = direction === 'up';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs bg-navy-700 text-gray-300 border border-navy-600 rounded hover:bg-navy-600 transition focus:outline-none focus:ring-1 focus:ring-teal-500 flex items-center gap-2"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <span className="max-w-[120px] truncate">{currentTheme}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? (isUp ? 'rotate-180' : '') : (isUp ? '' : 'rotate-180')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={`absolute right-0 ${isUp ? 'bottom-full mb-2 flex-col-reverse' : 'top-full mt-2 flex-col'} w-64 bg-navy-800 border border-navy-700 rounded-lg shadow-2xl z-50 max-h-96 flex`}>
            <div className={`p-2 ${isUp ? 'border-t' : 'border-b'} border-navy-700`}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search themes..."
                className="w-full px-3 py-1.5 bg-navy-900 border border-navy-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
                autoFocus
              />
              <div className="text-xs text-gray-500 mt-1 px-1">
                {filteredThemes.length} themes
              </div>
            </div>
            <div className="overflow-y-auto">
              {filteredThemes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => {
                    onThemeChange(theme.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-navy-700 transition ${
                    currentTheme === theme.name ? 'bg-navy-700 text-teal-400' : 'text-gray-300'
                  }`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(ThemeSelector);
