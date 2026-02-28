import React from 'react';

interface Props {
  title: string;
  message: string;
  onClose: () => void;
}

const ConnectionErrorModal: React.FC<Props> = ({ title, message, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
        style={{
          backgroundColor: '#1e1e2e',
          border: '1px solid rgba(255,255,255,0.08)',
          minWidth: 320,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 36,
              height: 36,
              backgroundColor: 'rgba(249,65,68,0.15)',
            }}
          >
            {/* X circle icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#f94144" strokeWidth="2" />
              <path
                d="M15 9L9 15M9 9L15 15"
                stroke="#f94144"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="font-semibold text-white text-base">{title}</span>
        </div>

        {/* Message */}
        <p
          className="text-sm leading-relaxed mb-5"
          style={{ color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-wrap' }}
        >
          {message}
        </p>

        {/* OK Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: '#f94144',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionErrorModal;
