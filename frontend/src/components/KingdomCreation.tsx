import React, { useState, useCallback } from 'react';
import { RACES } from "../shared-races";
import { StatBar } from './StatBar';
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

// Convert game-data races to component format  
const races = Object.values(RACES).map(race => ({
  id: race.id,
  name: race.name,
  description: race.description,
  image: `/output/${race.id}-kingdom.png`,
  specialAbility: race.specialAbility.description,
  stats: race.stats,
  unitTypes: race.unitTypes || ['Basic Units'],
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

const KingdomCreation: React.FC<KingdomCreationProps> = ({ onKingdomCreated }) => {
  const [kingdomName, setKingdomName] = useState('');
  const [selectedRace, setSelectedRace] = useState<Race | null>(races[0]);
  const [errors, setErrors] = useState<{ name?: string; race?: string }>({});

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // Inline validation
    const newErrors: { name?: string; race?: string } = {};
    
    if (!kingdomName.trim()) {
      newErrors.name = 'Kingdom name is required';
    } else if (kingdomName.trim().length < 3) {
      newErrors.name = 'Kingdom name must be at least 3 characters';
    }
    
    if (!selectedRace) {
      newErrors.race = 'Please select a race for your kingdom';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    if (kingdomName.trim() && selectedRace) {
      onKingdomCreated(kingdomName.trim(), selectedRace.id);
    }
  }, [kingdomName, selectedRace, onKingdomCreated]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKingdomName(e.target.value);
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: undefined }));
    }
  };

  const handleRaceSelect = (race: Race) => {
    setSelectedRace(race);
    if (errors.race) {
      setErrors(prev => ({ ...prev, race: undefined }));
    }
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
              onChange={handleNameChange}
              placeholder="Enter your kingdom name"
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              className={errors.name ? 'error' : ''}
            />
            <button 
              type="button" 
              className="random-name-btn"
              onClick={() => setKingdomName(generateRandomName())}
              title="Generate random kingdom name"
              aria-label="Generate random kingdom name"
            >
              🎲
            </button>
          </div>
          {errors.name && (
            <div id="name-error" className="error-message" role="alert">
              {errors.name}
            </div>
          )}
        </div>
        
        {selectedRace && (
          <div className="starting-resources">
            <h4>Starting Resources:</h4>
            <div className="resources-grid">
              <div className="resource-item">
                <img src="/gold-resource-icon.png" alt="Gold" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-label">Gold: {selectedRace.startingResources.gold}</span>
                </div>
              </div>
              <div className="resource-item">
                <img src="/population-resource-icon.png" alt="Population" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-label">Population: {selectedRace.startingResources.population}</span>
                </div>
              </div>
              <div className="resource-item">
                <img src="/land-resource-icon.png" alt="Land" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-label">Land: {selectedRace.startingResources.land}</span>
                </div>
              </div>
              <div className="resource-item">
                <img src="/time-turns-icon.png" alt="Turns" className="resource-icon" />
                <div className="resource-info">
                  <span className="resource-label">Turns: {selectedRace.startingResources.turns}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedRace && (
          <div className="race-details">
            <h4>{selectedRace.name} Details</h4>
            <p>{selectedRace.specialAbility}</p>
          </div>
        )}

        <div className="race-selection">
          <h3>Choose Your Race:</h3>
          {errors.race && (
            <div className="error-message" role="alert">
              {errors.race}
            </div>
          )}
          
          <div className="race-grid">
            {races.map((race) => (
              <div
                key={race.id}
                className={`race-card ${selectedRace?.id === race.id ? 'selected' : ''}`}
                onClick={() => handleRaceSelect(race)}
                role="button"
                tabIndex={0}
                aria-pressed={selectedRace?.id === race.id}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRaceSelect(race);
                  }
                }}
              >
                <img src={race.image} alt={race.name} />
                <h4>{race.name}</h4>
                <p>{race.description}</p>

                <div className="stats">
                <StatBar value={race.stats.warOffense} statType="offense" />
                <StatBar value={race.stats.warDefense} statType="defense" />
                <StatBar value={race.stats.sorcery} statType="sorcery" />
                <StatBar value={race.stats.scum} statType="scum" />
                <StatBar value={race.stats.forts} statType="forts" />
                <StatBar value={race.stats.tithe} statType="tithe" />
                <StatBar value={race.stats.training} statType="training" />
                <StatBar value={race.stats.siege} statType="siege" />
                <StatBar value={race.stats.economy} statType="economy" />
                <StatBar value={race.stats.building} statType="building" />
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

export default KingdomCreation;
