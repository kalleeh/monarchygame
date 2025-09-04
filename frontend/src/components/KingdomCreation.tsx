import React, { useState } from 'react';
import { RACES } from '@game-data/races';
import './KingdomCreation.css';

// Simple random name generator
const generateRandomName = (): string => {
  const prefixes = ['North', 'South', 'East', 'West', 'High', 'Low', 'Great', 'New', 'Old'];
  const bases = ['haven', 'shire', 'land', 'realm', 'kingdom', 'empire', 'domain', 'territory'];
  const suffixes = ['ia', 'burg', 'ton', 'ford', 'wick', 'ham', 'dale', 'moor'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const base = bases[Math.floor(Math.random() * bases.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${prefix}${base}${suffix}`;
};

interface RaceData {
  id: string;
  name: string;
  description: string;
  stats: { warOffense: number; warDefense: number; sorcery: number; economy: number };
  specialAbility: { description: string };
  unitTypes: { name: string }[];
  startingResources: { gold: number; population: number; land: number; turns: number };
}

// Convert game-data races to component format  
const races = Object.values(RACES).map(race => ({
  id: race.id,
  name: race.name,
  description: race.description,
  image: `/output/${race.id}-kingdom.png`,
  specialAbility: race.specialAbility.description,
  stats: race.stats,
  unitTypes: race.unitTypes?.map(u => u.name) || ['Basic Units'],
  startingResources: race.startingResources || { gold: 1000, population: 500, land: 100, turns: 50 },
  gameplayTips: {
    strengths: [race.specialAbility.strategicValue || 'Balanced approach'],
    weaknesses: [race.specialAbility.limitations || 'No major weaknesses'], 
    strategy: race.specialAbility.strategicValue || 'Adapt to situation'
  }
}));

interface Race {
  id: string;
  name: string;
  description: string;
  image: string;
  specialAbility: string;
  stats: {
    warOffense: number;
    warDefense: number;
    sorcery: number;
    economy: number;
  };
  unitTypes: string[];
  startingResources: {
    gold: number;
    population: number;
    land: number;
    turns: number;
  };
  gameplayTips: {
    strengths: string[];
    weaknesses: string[];
    strategy: string;
  };
}

interface KingdomCreationProps {
  onKingdomCreated: (kingdomName: string, race: string) => void;
}

export const KingdomCreation: React.FC<KingdomCreationProps> = ({ onKingdomCreated }) => {
  const [kingdomName, setKingdomName] = useState('');
  const [selectedRace, setSelectedRace] = useState<Race | null>(races[0]);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kingdomName.trim() && selectedRace) {
      onKingdomCreated(kingdomName.trim(), selectedRace.id);
    }
  };

  const renderStatBar = (value: number, statType: string, max: number = 5) => {
    return (
      <div className="stat-bar">
        {Array.from({ length: max }, (_, i) => (
          <div
            key={i}
            className={`stat-dot ${i < value ? `filled ${statType}` : ''}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="kingdom-creation">
      <h2>Create Your Kingdom</h2>
      <form className="creation-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="kingdom-name">Kingdom Name:</label>
          <div className="name-input-group">
            <input
              type="text"
              id="kingdom-name"
              value={kingdomName}
              onChange={(e) => setKingdomName(e.target.value)}
              placeholder="Enter your kingdom name"
              required
            />
            <button 
              type="button" 
              className="random-name-btn"
              onClick={() => setKingdomName(generateRandomName())}
              title="Generate random kingdom name"
            >
              🎲
            </button>
          </div>
        </div>
        
        {selectedRace && (
          <div className="starting-resources">
            <h4>Starting Resources for {selectedRace.name}</h4>
            <div className="resources-grid">
              <div className="resource-item">
                <img src="/gold-resource-icon.png" alt="Gold" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-value">{selectedRace.startingResources.gold}</span>
                  <span className="resource-label">Gold</span>
                </div>
              </div>
              <div className="resource-item">
                <img src="/population-resource-icon.png" alt="Population" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-value">{selectedRace.startingResources.population}</span>
                  <span className="resource-label">Population</span>
                </div>
              </div>
              <div className="resource-item">
                <img src="/land-resource-icon.png" alt="Land" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-value">{selectedRace.startingResources.land}</span>
                  <span className="resource-label">Land</span>
                </div>
              </div>
              <div className="resource-item">
                <img src="/time-turns-icon.png" alt="Turns" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-value">{selectedRace.startingResources.turns}</span>
                  <span className="resource-label">Turns</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="race-selection">
          <h3>Choose Your Race</h3>
          
          <div className="race-grid">
            {races.map((race) => (
              <div
                key={race.id}
                className={`race-card ${selectedRace?.id === race.id ? 'selected' : ''}`}
                onClick={() => setSelectedRace(race)}
              >
                <img src={race.image} alt={race.name} />
                <h4>{race.name}</h4>
                <p>{race.description}</p>

                <div className="stats">
                  <div><span>War Offense:</span> {renderStatBar(race.stats.warOffense, 'offense')}</div>
                  <div><span>War Defense:</span> {renderStatBar(race.stats.warDefense, 'defense')}</div>
                  <div><span>Sorcery:</span> {renderStatBar(race.stats.sorcery, 'sorcery')}</div>
                  <div><span>Scum:</span> {renderStatBar(race.stats.scum, 'scum')}</div>
                  <div><span>Forts:</span> {renderStatBar(race.stats.forts, 'forts')}</div>
                  <div><span>Tithe:</span> {renderStatBar(race.stats.tithe, 'tithe')}</div>
                  <div><span>Training:</span> {renderStatBar(race.stats.training, 'training')}</div>
                  <div><span>Siege:</span> {renderStatBar(race.stats.siege, 'siege')}</div>
                  <div><span>Economy:</span> {renderStatBar(race.stats.economy, 'economy')}</div>
                  <div><span>Building:</span> {renderStatBar(race.stats.building, 'building')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <button type="submit" disabled={!kingdomName.trim() || !selectedRace}>
          Create Kingdom
        </button>
      </form>
    </div>
  );
};
