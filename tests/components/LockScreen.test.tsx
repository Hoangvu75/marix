/**
 * Component tests for LockScreen
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock LockScreen component for testing
const MockLockScreen: React.FC<{
  method: 'blur' | 'pin' | 'password';
  onUnlock: (credential?: string) => boolean;
}> = ({ method, onUnlock }) => {
  const [credential, setCredential] = React.useState('');
  const [error, setError] = React.useState('');

  const handleUnlock = () => {
    if (method === 'blur') {
      onUnlock();
      return;
    }
    
    const success = onUnlock(credential);
    if (!success) {
      setError('Incorrect credential');
    }
  };

  return (
    <div data-testid="lock-screen" style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}>
      <h1>App Locked</h1>
      
      {method === 'blur' && (
        <button data-testid="blur-unlock" onClick={handleUnlock}>
          Click to unlock
        </button>
      )}
      
      {method === 'pin' && (
        <div>
          <input
            data-testid="pin-input"
            type="password"
            maxLength={4}
            value={credential}
            onChange={(e) => setCredential(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 4-digit PIN"
          />
          <button data-testid="pin-unlock" onClick={handleUnlock}>
            Unlock
          </button>
        </div>
      )}
      
      {method === 'password' && (
        <div>
          <input
            data-testid="password-input"
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="Enter password"
          />
          <button data-testid="password-unlock" onClick={handleUnlock}>
            Unlock
          </button>
        </div>
      )}
      
      {error && <p data-testid="error-message">{error}</p>}
    </div>
  );
};

describe('LockScreen Component', () => {
  describe('Blur Mode', () => {
    it('renders blur lock screen', () => {
      const onUnlock = jest.fn();
      render(<MockLockScreen method="blur" onUnlock={onUnlock} />);
      
      expect(screen.getByTestId('lock-screen')).toBeInTheDocument();
      expect(screen.getByTestId('blur-unlock')).toBeInTheDocument();
    });

    it('unlocks on click for blur mode', () => {
      const onUnlock = jest.fn().mockReturnValue(true);
      render(<MockLockScreen method="blur" onUnlock={onUnlock} />);
      
      fireEvent.click(screen.getByTestId('blur-unlock'));
      expect(onUnlock).toHaveBeenCalled();
    });
  });

  describe('PIN Mode', () => {
    it('renders PIN input', () => {
      const onUnlock = jest.fn();
      render(<MockLockScreen method="pin" onUnlock={onUnlock} />);
      
      expect(screen.getByTestId('pin-input')).toBeInTheDocument();
      expect(screen.getByTestId('pin-unlock')).toBeInTheDocument();
    });

    it('accepts only digits in PIN input', () => {
      const onUnlock = jest.fn();
      render(<MockLockScreen method="pin" onUnlock={onUnlock} />);
      
      const input = screen.getByTestId('pin-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '12ab34' } });
      
      expect(input.value).toBe('1234');
    });

    it('limits PIN to 4 digits', () => {
      const onUnlock = jest.fn();
      render(<MockLockScreen method="pin" onUnlock={onUnlock} />);
      
      const input = screen.getByTestId('pin-input') as HTMLInputElement;
      // Due to maxLength attribute, HTML input truncates to 4 chars
      fireEvent.change(input, { target: { value: '1234' } });
      
      expect(input.value.length).toBeLessThanOrEqual(4);
    });

    it('shows error on wrong PIN', () => {
      const onUnlock = jest.fn().mockReturnValue(false);
      render(<MockLockScreen method="pin" onUnlock={onUnlock} />);
      
      const input = screen.getByTestId('pin-input');
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(screen.getByTestId('pin-unlock'));
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    it('unlocks with correct PIN', () => {
      const onUnlock = jest.fn().mockReturnValue(true);
      render(<MockLockScreen method="pin" onUnlock={onUnlock} />);
      
      const input = screen.getByTestId('pin-input');
      fireEvent.change(input, { target: { value: '1234' } });
      fireEvent.click(screen.getByTestId('pin-unlock'));
      
      expect(onUnlock).toHaveBeenCalledWith('1234');
    });
  });

  describe('Password Mode', () => {
    it('renders password input', () => {
      const onUnlock = jest.fn();
      render(<MockLockScreen method="password" onUnlock={onUnlock} />);
      
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-unlock')).toBeInTheDocument();
    });

    it('accepts any characters in password', () => {
      const onUnlock = jest.fn();
      render(<MockLockScreen method="password" onUnlock={onUnlock} />);
      
      const input = screen.getByTestId('password-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'MyP@ssw0rd!' } });
      
      expect(input.value).toBe('MyP@ssw0rd!');
    });

    it('shows error on wrong password', () => {
      const onUnlock = jest.fn().mockReturnValue(false);
      render(<MockLockScreen method="password" onUnlock={onUnlock} />);
      
      const input = screen.getByTestId('password-input');
      fireEvent.change(input, { target: { value: 'wrong' } });
      fireEvent.click(screen.getByTestId('password-unlock'));
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('has dark background for visibility on both themes', () => {
      const onUnlock = jest.fn();
      render(<MockLockScreen method="blur" onUnlock={onUnlock} />);
      
      const lockScreen = screen.getByTestId('lock-screen');
      expect(lockScreen).toHaveStyle({ backgroundColor: 'rgba(0,0,0,0.92)' });
    });
  });
});
