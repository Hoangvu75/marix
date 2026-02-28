import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface MessageModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  variant?: 'success' | 'error' | 'info';
}

const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
  variant = 'info',
}) => {
  const { t } = useLanguage();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && okRef.current) {
      okRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    success: {
      icon: (
        <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      border: 'border-emerald-500/30',
    },
    error: {
      icon: (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      border: 'border-red-500/30',
    },
    info: {
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      border: 'border-gray-600',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative bg-gray-800 rounded-lg shadow-xl border w-full max-w-md mx-4 ${style.border}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {style.icon}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <p className="text-gray-300 mb-6 pl-9 whitespace-pre-wrap">{message}</p>
          <div className="flex justify-end">
            <button
              ref={okRef}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            >
              {t('ok') || 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageModal;
