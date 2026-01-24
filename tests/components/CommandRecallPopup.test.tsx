/**
 * Component tests for CommandRecallPopup
 * Tests the command history popup UI and interactions
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock command entry type
interface CommandEntry {
  id: string;
  command: string;
  timestamp: number;
  count: number;
}

// Mock CommandRecallPopup component for testing
const MockCommandRecallPopup: React.FC<{
  isOpen: boolean;
  commands: CommandEntry[];
  onSelect: (command: string) => void;
  onClose: () => void;
  onSaveAsSnippet: (command: string) => void;
  onDelete: (id: string) => void;
}> = ({ isOpen, commands, onSelect, onClose, onSaveAsSnippet, onDelete }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const filteredCommands = React.useMemo(() => {
    if (!searchQuery) return commands;
    const lowered = searchQuery.toLowerCase();
    return commands.filter(cmd => cmd.command.toLowerCase().includes(lowered));
  }, [commands, searchQuery]);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
          onSelect(filteredCommands[selectedIndex].command);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      data-testid="command-recall-popup" 
      className="popup"
      onKeyDown={handleKeyDown}
    >
      <div className="header">
        <span data-testid="popup-title">Command History</span>
        <button data-testid="close-button" onClick={onClose}>×</button>
      </div>

      <input
        data-testid="search-input"
        type="text"
        placeholder="Search commands..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoFocus
      />

      <div data-testid="command-list" className="command-list">
        {filteredCommands.length === 0 ? (
          <div data-testid="empty-state">
            {searchQuery ? 'No matching commands' : 'No commands yet'}
          </div>
        ) : (
          filteredCommands.map((cmd, index) => (
            <div
              key={cmd.id}
              data-testid={`command-item-${index}`}
              className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(cmd.command)}
            >
              <span data-testid={`command-text-${index}`} className="command-text">
                {cmd.command}
              </span>
              <span data-testid={`command-meta-${index}`} className="command-meta">
                {formatTime(cmd.timestamp)} • Used {cmd.count} times
              </span>
              <div className="command-actions">
                <button
                  data-testid={`save-snippet-${index}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAsSnippet(cmd.command);
                  }}
                >
                  Save as Snippet
                </button>
                <button
                  data-testid={`delete-${index}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(cmd.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div data-testid="keyboard-hints" className="hints">
        <span>↑↓ navigate</span>
        <span>Enter select</span>
        <span>Esc close</span>
      </div>
    </div>
  );
};

describe('CommandRecallPopup Component', () => {
  const mockCommands: CommandEntry[] = [
    { id: '1', command: 'docker ps', timestamp: Date.now() - 60000, count: 5 },
    { id: '2', command: 'docker images', timestamp: Date.now() - 120000, count: 3 },
    { id: '3', command: 'ls -la', timestamp: Date.now() - 300000, count: 10 },
    { id: '4', command: 'cat /etc/hosts', timestamp: Date.now() - 600000, count: 2 },
    { id: '5', command: 'npm install', timestamp: Date.now() - 3600000, count: 1 },
  ];

  const defaultProps = {
    isOpen: true,
    commands: mockCommands,
    onSelect: jest.fn(),
    onClose: jest.fn(),
    onSaveAsSnippet: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders when isOpen is true', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      expect(screen.getByTestId('command-recall-popup')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<MockCommandRecallPopup {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('command-recall-popup')).not.toBeInTheDocument();
    });

    it('displays popup title', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      expect(screen.getByTestId('popup-title')).toHaveTextContent('Command History');
    });
  });

  describe('Command List', () => {
    it('displays all commands', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      mockCommands.forEach((cmd, index) => {
        expect(screen.getByTestId(`command-text-${index}`)).toHaveTextContent(cmd.command);
      });
    });

    it('displays command metadata (time and count)', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const meta = screen.getByTestId('command-meta-0');
      expect(meta).toHaveTextContent(/ago/);
      expect(meta).toHaveTextContent(/Used.*times/);
    });

    it('shows empty state when no commands', () => {
      render(<MockCommandRecallPopup {...defaultProps} commands={[]} />);
      
      expect(screen.getByTestId('empty-state')).toHaveTextContent('No commands yet');
    });

    it('shows no match message when search has no results', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      expect(screen.getByTestId('empty-state')).toHaveTextContent('No matching commands');
    });
  });

  describe('Search Functionality', () => {
    it('renders search input', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('filters commands based on search query', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'docker' } });
      
      // Should show only docker commands
      expect(screen.getByTestId('command-text-0')).toHaveTextContent('docker');
      expect(screen.getByTestId('command-text-1')).toHaveTextContent('docker');
      expect(screen.queryByTestId('command-text-2')).not.toBeInTheDocument();
    });

    it('search is case-insensitive', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'DOCKER' } });
      
      expect(screen.getByTestId('command-text-0')).toHaveTextContent('docker');
    });

    it('has autofocus on search input', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      expect(screen.getByTestId('search-input')).toHaveFocus();
    });
  });

  describe('Selection', () => {
    it('calls onSelect when clicking a command', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('command-item-0'));
      
      expect(defaultProps.onSelect).toHaveBeenCalledWith('docker ps');
    });

    it('highlights selected item', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const firstItem = screen.getByTestId('command-item-0');
      expect(firstItem).toHaveClass('selected');
    });
  });

  describe('Keyboard Navigation', () => {
    it('selects next item on ArrowDown', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const popup = screen.getByTestId('command-recall-popup');
      fireEvent.keyDown(popup, { key: 'ArrowDown' });
      
      const secondItem = screen.getByTestId('command-item-1');
      expect(secondItem).toHaveClass('selected');
    });

    it('selects previous item on ArrowUp', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const popup = screen.getByTestId('command-recall-popup');
      fireEvent.keyDown(popup, { key: 'ArrowDown' });
      fireEvent.keyDown(popup, { key: 'ArrowUp' });
      
      const firstItem = screen.getByTestId('command-item-0');
      expect(firstItem).toHaveClass('selected');
    });

    it('does not go below first item', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const popup = screen.getByTestId('command-recall-popup');
      fireEvent.keyDown(popup, { key: 'ArrowUp' });
      fireEvent.keyDown(popup, { key: 'ArrowUp' });
      
      const firstItem = screen.getByTestId('command-item-0');
      expect(firstItem).toHaveClass('selected');
    });

    it('does not go above last item', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const popup = screen.getByTestId('command-recall-popup');
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(popup, { key: 'ArrowDown' });
      }
      
      const lastItem = screen.getByTestId(`command-item-${mockCommands.length - 1}`);
      expect(lastItem).toHaveClass('selected');
    });

    it('calls onSelect on Enter key', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const popup = screen.getByTestId('command-recall-popup');
      fireEvent.keyDown(popup, { key: 'Enter' });
      
      expect(defaultProps.onSelect).toHaveBeenCalledWith('docker ps');
    });

    it('calls onClose on Escape key', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const popup = screen.getByTestId('command-recall-popup');
      fireEvent.keyDown(popup, { key: 'Escape' });
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('displays keyboard hints', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const hints = screen.getByTestId('keyboard-hints');
      expect(hints).toHaveTextContent('navigate');
      expect(hints).toHaveTextContent('select');
      expect(hints).toHaveTextContent('close');
    });
  });

  describe('Close Button', () => {
    it('renders close button', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });

    it('calls onClose when clicking close button', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('close-button'));
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Save as Snippet', () => {
    it('renders save as snippet button for each command', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      mockCommands.forEach((_, index) => {
        expect(screen.getByTestId(`save-snippet-${index}`)).toBeInTheDocument();
      });
    });

    it('calls onSaveAsSnippet with command when clicking save button', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('save-snippet-0'));
      
      expect(defaultProps.onSaveAsSnippet).toHaveBeenCalledWith('docker ps');
    });

    it('does not select command when clicking save button', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('save-snippet-0'));
      
      expect(defaultProps.onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Delete Command', () => {
    it('renders delete button for each command', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      mockCommands.forEach((_, index) => {
        expect(screen.getByTestId(`delete-${index}`)).toBeInTheDocument();
      });
    });

    it('calls onDelete with command id when clicking delete button', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('delete-0'));
      
      expect(defaultProps.onDelete).toHaveBeenCalledWith('1');
    });

    it('does not select command when clicking delete button', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('delete-0'));
      
      expect(defaultProps.onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Time Formatting', () => {
    it('displays minutes for recent commands', () => {
      const recentCommands = [
        { id: '1', command: 'test', timestamp: Date.now() - 60000, count: 1 }, // 1 min ago
      ];
      
      render(<MockCommandRecallPopup {...defaultProps} commands={recentCommands} />);
      
      expect(screen.getByTestId('command-meta-0')).toHaveTextContent('1m ago');
    });

    it('displays hours for older commands', () => {
      const olderCommands = [
        { id: '1', command: 'test', timestamp: Date.now() - 3600000, count: 1 }, // 1 hour ago
      ];
      
      render(<MockCommandRecallPopup {...defaultProps} commands={olderCommands} />);
      
      expect(screen.getByTestId('command-meta-0')).toHaveTextContent('1h ago');
    });

    it('displays days for very old commands', () => {
      const veryOldCommands = [
        { id: '1', command: 'test', timestamp: Date.now() - 86400000, count: 1 }, // 1 day ago
      ];
      
      render(<MockCommandRecallPopup {...defaultProps} commands={veryOldCommands} />);
      
      expect(screen.getByTestId('command-meta-0')).toHaveTextContent('1d ago');
    });
  });

  describe('Search State Reset', () => {
    it('resets selection to first item when search query changes', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      const popup = screen.getByTestId('command-recall-popup');
      const searchInput = screen.getByTestId('search-input');
      
      // Navigate to second item
      fireEvent.keyDown(popup, { key: 'ArrowDown' });
      expect(screen.getByTestId('command-item-1')).toHaveClass('selected');
      
      // Type in search
      fireEvent.change(searchInput, { target: { value: 'ls' } });
      
      // Selection should reset to first filtered item
      expect(screen.getByTestId('command-item-0')).toHaveClass('selected');
    });
  });

  describe('Accessibility', () => {
    it('has placeholder text on search input', () => {
      render(<MockCommandRecallPopup {...defaultProps} />);
      
      expect(screen.getByTestId('search-input')).toHaveAttribute('placeholder', 'Search commands...');
    });
  });
});
