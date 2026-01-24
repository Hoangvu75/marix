/**
 * Lock Screen Component
 * 
 * Displays when app is locked due to inactivity.
 * Supports 3 unlock methods:
 * - blur: Just click to continue
 * - pin: Enter 4 digit PIN
 * - password: Enter password
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const { ipcRenderer } = window.electron;

export type LockMethod = 'blur' | 'pin' | 'password';

interface LockScreenProps {
  method: LockMethod;
  onUnlock: () => void;
  appTheme: 'light' | 'dark';
}

const LockScreen: React.FC<LockScreenProps> = ({ method, onUnlock, appTheme }) => {
  const { t } = useLanguage();
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const pinInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus first input
    if (method === 'pin' && pinInputsRef.current[0]) {
      pinInputsRef.current[0].focus();
    } else if (method === 'password' && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [method]);

  const handleBlurUnlock = () => {
    onUnlock();
  };

  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Move to next input
    if (value && index < 3 && pinInputsRef.current[index + 1]) {
      pinInputsRef.current[index + 1]?.focus();
    }

    // Check if PIN is complete (4 digits)
    const pinString = newPin.join('');
    if (pinString.length === 4 && newPin.every(d => d !== '')) {
      verifyCredential(pinString);
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinInputsRef.current[index - 1]?.focus();
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      verifyCredential(password);
    }
  };

  const verifyCredential = async (credential: string) => {
    try {
      const isValid = await ipcRenderer.invoke('settings:verifyAppLockCredential', credential);
      if (isValid) {
        onUnlock();
      } else {
        setError(t('appLockWrongCredential') || 'Incorrect. Please try again.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        if (method === 'pin') {
          setPin(['', '', '', '']);
          pinInputsRef.current[0]?.focus();
        }
      }
    } catch (err) {
      console.error('[LockScreen] Verify error:', err);
    }
  };

  const isDark = appTheme === 'dark';

  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.92)'
      }}
    >
      <div className={`${shake ? 'animate-shake' : ''}`}>
        {/* Lock Icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '5rem', 
            height: '5rem', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: '1rem',
            backgroundColor: '#1f2937',
            border: '2px solid #4b5563'
          }}>
            <svg style={{ width: '2.5rem', height: '2.5rem', color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem', color: '#ffffff' }}>
            {t('appLocked') || 'App Locked'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            {method === 'blur' 
              ? (t('appLockClickToContinue') || 'Click anywhere to continue')
              : method === 'pin'
              ? (t('appLockEnterPin') || 'Enter your PIN to unlock')
              : (t('appLockEnterPassword') || 'Enter your password to unlock')
            }
          </p>
        </div>

        {/* Blur method - just click */}
        {method === 'blur' && (
          <button
            onClick={handleBlurUnlock}
            style={{
              width: '100%',
              padding: '1rem 2rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '0.75rem',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            {t('appLockUnlock') || 'Unlock'}
          </button>
        )}

        {/* PIN method */}
        {method === 'pin' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { pinInputsRef.current[index] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handlePinChange(index, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(index, e)}
                  style={{
                    width: '3rem',
                    height: '3.5rem',
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    borderRadius: '0.5rem',
                    border: error ? '2px solid #ef4444' : '2px solid #4b5563',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    outline: 'none'
                  }}
                />
              ))}
            </div>
            {error && (
              <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
            )}
            <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {t('appLockPinHint') || 'Enter 4 digit PIN'}
            </p>
          </div>
        )}

        {/* Password method */}
        {method === 'password' && (
          <form onSubmit={handlePasswordSubmit} style={{ width: '20rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder={t('password') || 'Password'}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: error ? '2px solid #ef4444' : '2px solid #4b5563',
                  backgroundColor: '#1f2937',
                  color: '#ffffff',
                  outline: 'none'
                }}
              />
              {error && (
                <p style={{ color: '#f87171', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>
              )}
            </div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                borderRadius: '0.5rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {t('appLockUnlock') || 'Unlock'}
            </button>
          </form>
        )}
      </div>

      {/* Add shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};

export default LockScreen;
