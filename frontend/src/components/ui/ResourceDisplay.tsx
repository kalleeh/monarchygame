import React, { memo } from 'react';

interface ResourceDisplayProps {
  gold: number;
  land: number;
  population: number;
  mana: number;
  className?: string;
}

export const ResourceDisplay = memo(function ResourceDisplay({
  gold,
  land,
  population,
  mana,
  className = ""
}: ResourceDisplayProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-600">{gold.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Gold</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">{land.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Land</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{population.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Population</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">{mana.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Mana</div>
      </div>
    </div>
  );
});
