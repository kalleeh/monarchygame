import React from 'react';

interface LoadingSkeletonProps {
  type?: 'dashboard' | 'list' | 'card' | 'page';
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'page', 
  className = '' 
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';

  switch (type) {
    case 'dashboard':
      return (
        <div className={`p-6 space-y-6 ${className}`}>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className={`h-8 w-48 ${baseClasses}`} />
            <div className={`h-8 w-24 ${baseClasses}`} />
          </div>
          
          {/* Resource cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow">
                <div className={`h-6 w-16 mb-2 ${baseClasses}`} />
                <div className={`h-4 w-12 ${baseClasses}`} />
              </div>
            ))}
          </div>
          
          {/* Action buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`h-12 ${baseClasses}`} />
            ))}
          </div>
        </div>
      );

    case 'list':
      return (
        <div className={`space-y-4 ${className}`}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 bg-white rounded-lg shadow">
              <div className={`h-12 w-12 rounded-full ${baseClasses}`} />
              <div className="flex-1 space-y-2">
                <div className={`h-4 w-3/4 ${baseClasses}`} />
                <div className={`h-3 w-1/2 ${baseClasses}`} />
              </div>
            </div>
          ))}
        </div>
      );

    case 'card':
      return (
        <div className={`p-6 bg-white rounded-lg shadow ${className}`}>
          <div className={`h-6 w-3/4 mb-4 ${baseClasses}`} />
          <div className="space-y-2">
            <div className={`h-4 w-full ${baseClasses}`} />
            <div className={`h-4 w-5/6 ${baseClasses}`} />
            <div className={`h-4 w-4/6 ${baseClasses}`} />
          </div>
        </div>
      );

    default:
      return (
        <div className={`flex items-center justify-center min-h-screen ${className}`}>
          <div className="text-center space-y-4">
            <div className={`h-16 w-16 rounded-full mx-auto ${baseClasses}`} />
            <div className={`h-4 w-32 mx-auto ${baseClasses}`} />
          </div>
        </div>
      );
  }
};
