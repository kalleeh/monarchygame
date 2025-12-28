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
  type = 'button'
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2 
        bg-blue-600 text-white rounded-md hover:bg-blue-700 
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
        ${className}
      `}
      aria-label={loading ? 'Loading...' : undefined}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
};
