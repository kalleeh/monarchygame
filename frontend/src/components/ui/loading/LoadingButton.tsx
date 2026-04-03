import React from 'react';
import { Spinner } from './Spinner';

interface LoadingButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  disabled = false,
  children,
  onClick,
  className = '',
  type = 'button',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        background: loading || disabled ? 'rgba(78,205,196,0.3)' : 'rgba(78,205,196,0.15)',
        color: '#4ecdc4',
        border: '1px solid rgba(78,205,196,0.4)',
        borderRadius: '6px',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.6 : 1,
        transition: 'background 0.2s, opacity 0.2s',
      }}
      aria-label={loading ? 'Loading...' : undefined}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
};
