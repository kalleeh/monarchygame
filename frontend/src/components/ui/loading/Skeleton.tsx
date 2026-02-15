import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '',
  width = 'w-full',
  height = 'h-4'
}) => {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded ${width} ${height} ${className}`}
      role="status"
      aria-label="Loading content"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="flex flex-col space-y-3 p-4">
      <Skeleton height="h-32" className="rounded-xl" />
      <div className="space-y-2">
        <Skeleton height="h-4" />
        <Skeleton height="h-4" width="w-4/5" />
      </div>
    </div>
  );
};
