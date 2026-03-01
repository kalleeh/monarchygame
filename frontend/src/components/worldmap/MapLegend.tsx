/**
 * MapLegend.tsx
 *
 * The colour-key legend strip shown in the WorldMap header.
 * Extracted from WorldMap.tsx.
 */

import React from 'react';

interface MapLegendProps {
  allianceControlledRegions: Record<string, string>;
}

export const MapLegend: React.FC<MapLegendProps> = ({ allianceControlledRegions }) => (
  <div className="map-legend">
    <div className="legend-item">
      <div className="legend-color" style={{ background: '#4ade80' }}></div>
      <span>Your Territory</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ background: '#1f2937', border: '1px dashed #4b5563' }}></div>
      <span>Neutral</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ background: '#dc2626' }}></div>
      <span>Enemy</span>
    </div>
    <div className="legend-item">
      <div
        className="legend-color fog-legend"
        style={{
          background: '#000',
          border: '1px dashed #374151',
          opacity: 0.4,
        }}
      ></div>
      <span>Fog of War</span>
    </div>
    {Object.keys(allianceControlledRegions).length > 0 && (
      <div className="legend-item">
        <div className="legend-color" style={{ background: '#4ade80', border: '3px solid #fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.5)' }}></div>
        <span title="+15% alliance income bonus">Your Controlled (+15%)</span>
      </div>
    )}
  </div>
);
