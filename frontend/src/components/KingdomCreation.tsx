import React, { useState, useCallback, memo } from 'react';
import { RACES } from "../shared-races";
import { StatBar } from './StatBar';
import './KingdomCreation.css';

const PLAYSTYLES = [
  { id: 'conqueror',  icon: '⚔️', label: 'Conqueror',  desc: 'Combat & expansion. Attack enemies, claim land.',         recommended: ['Droben', 'Goblin', 'Elemental'] },
  { id: 'sorcerer',   icon: '🔮', label: 'Sorcerer',   desc: 'Magic & spells. Cast powerful spells to weaken enemies.',  recommended: ['Sidhe', 'Elemental', 'Elven'] },
  { id: 'diplomat',   icon: '🤝', label: 'Diplomat',   desc: 'Trade & alliances. Build wealth through cooperation.',     recommended: ['Human', 'Fae', 'Elven'] },
  { id: 'saboteur',   icon: '🕵️', label: 'Saboteur',   desc: 'Espionage & disruption. Steal and undermine enemies.',    recommended: ['Centaur', 'Vampire', 'Human'] },
  { id: 'balanced',   icon: '⚖️', label: 'Balanced',   desc: 'Try everything. Good for exploring the game systems.',    recommended: ['Human'] },
] as const;

type PlaystyleId = typeof PLAYSTYLES[number]['id'];

const RACE_PLAYSTYLE: Record<string, { style: string; difficulty: 'Easy' | 'Medium' | 'Hard'; bestFor: string; color: string }> = {
  Human:    { style: '⚖️ Balanced',    difficulty: 'Easy',   bestFor: 'New players, trade & economy',   color: '#60a5fa' },
  Elven:    { style: '🛡️ Defensive',   difficulty: 'Easy',   bestFor: 'Building & magical defense',      color: '#34d399' },
  Goblin:   { style: '⚔️ Aggressive',  difficulty: 'Medium', bestFor: 'Early raiding, siege warfare',    color: '#f87171' },
  Droben:   { style: '⚔️ Warrior',     difficulty: 'Medium', bestFor: 'Elite combat, heavy offense',     color: '#fb923c' },
  Vampire:  { style: '🦇 Fortress',    difficulty: 'Hard',   bestFor: 'Experienced defenders (2× costs)', color: '#c084fc' },
  Elemental:{ style: '🔥 Hybrid',      difficulty: 'Medium', bestFor: 'Magic + combat combination',      color: '#38bdf8' },
  Centaur:  { style: '🕵️ Saboteur',    difficulty: 'Medium', bestFor: 'Espionage & disruption',          color: '#a78bfa' },
  Sidhe:    { style: '🔮 Sorcerer',    difficulty: 'Hard',   bestFor: 'Mastering the magic system',      color: '#e879f9' },
  Dwarven:  { style: '🏰 Defender',    difficulty: 'Easy',   bestFor: 'Strong fortifications, mining',   color: '#fbbf24' },
  Fae:      { style: '✨ Mystic',      difficulty: 'Medium', bestFor: 'High income, versatile magic',    color: '#f0abfc' },
};

const STAT_DESCRIPTIONS: Record<string, string> = {
  offense:  'Attack strength in combat — higher = more land gained',
  defense:  'Resistance to attacks — higher = fewer losses',
  sorcery:  'Spell casting power — higher = stronger magic damage',
  scum:     'Espionage skill — higher = better thievery operations',
  forts:    'Fortification strength — high forts resist spells & raids',
  tithe:    'Religious income — higher = more gold from temples',
  training: 'Unit training speed — higher = cheaper army upkeep',
  siege:    'Siege warfare bonus — affects controlled strikes',
  economy:  'Gold generation — higher = more income per turn',
  building: 'Construction speed — higher = faster BRT (build rate)',
};

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
  startingResources: race.startingResources || { gold: 2000, population: 500, land: 100, turns: 100 },
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

/** Memoized race grid — only re-renders when selectedRace changes, not on every name keystroke */
const RaceGrid = memo(function RaceGrid({
  races, selectedRaceId, onSelect,
}: { races: Race[]; selectedRaceId: string | undefined; onSelect: (race: Race) => void }) {
  return (
    <div className="race-grid">
      {races.map((race) => (
        <div
          key={race.id}
          className={`race-card ${selectedRaceId === race.id ? 'selected' : ''}`}
          onClick={() => onSelect(race)}
          role="button"
          tabIndex={0}
          aria-pressed={selectedRaceId === race.id}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(race);
            }
          }}
        >
          <img src={race.image} alt={race.name} />
          <h4>{race.name}</h4>
          {(() => {
            const ps = RACE_PLAYSTYLE[race.name];
            if (!ps) return null;
            return (
              <div className="race-playstyle">
                <span className="race-style-badge" style={{ color: ps.color }}>{ps.style}</span>
                <span className={`race-difficulty difficulty-${ps.difficulty.toLowerCase()}`}>{ps.difficulty}</span>
              </div>
            );
          })()}
          <p className="race-best-for">Best for: {RACE_PLAYSTYLE[race.name]?.bestFor}</p>
          <p>{race.description}</p>
          {race.name === 'Vampire' && (
            <div className="race-cost-warning">⚠️ Requires 2× resources to maintain</div>
          )}
          <div className="stats">
            <div title={STAT_DESCRIPTIONS['offense']}><StatBar value={race.stats.warOffense} statType="offense" /></div>
            <div title={STAT_DESCRIPTIONS['defense']}><StatBar value={race.stats.warDefense} statType="defense" /></div>
            <div title={STAT_DESCRIPTIONS['sorcery']}><StatBar value={race.stats.sorcery} statType="sorcery" /></div>
            <div title={STAT_DESCRIPTIONS['scum']}><StatBar value={race.stats.scum} statType="scum" /></div>
            <div title={STAT_DESCRIPTIONS['forts']}><StatBar value={race.stats.forts} statType="forts" /></div>
            <div title={STAT_DESCRIPTIONS['tithe']}><StatBar value={race.stats.tithe} statType="tithe" /></div>
            <div title={STAT_DESCRIPTIONS['training']}><StatBar value={race.stats.training} statType="training" /></div>
            <div title={STAT_DESCRIPTIONS['siege']}><StatBar value={race.stats.siege} statType="siege" /></div>
            <div title={STAT_DESCRIPTIONS['economy']}><StatBar value={race.stats.economy} statType="economy" /></div>
            <div title={STAT_DESCRIPTIONS['building']}><StatBar value={race.stats.building} statType="building" /></div>
          </div>
        </div>
      ))}
    </div>
  );
});

const KingdomCreation: React.FC<KingdomCreationProps> = ({ onKingdomCreated }) => {
  const [kingdomName, setKingdomName] = useState('');
  const [selectedRace, setSelectedRace] = useState<Race | null>(races[0]);
  const [errors, setErrors] = useState<{ name?: string; race?: string }>({});
  const [selectedPlaystyle, setSelectedPlaystyle] = useState<PlaystyleId>('balanced');

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
      // Store playstyle — will be read by KingdomDashboard to reorder actions
      // Use a temporary key that will be updated once we have the kingdom ID
      localStorage.setItem('pending-playstyle', selectedPlaystyle);
      onKingdomCreated(kingdomName.trim(), selectedRace.id);
    }
  }, [kingdomName, selectedRace, selectedPlaystyle, onKingdomCreated]);

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
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              {selectedRace.name === 'Vampire' ? '⚠️ All costs doubled for Vampire kingdoms' : ''}
            </p>
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
          
          <RaceGrid
            races={races}
            selectedRaceId={selectedRace?.id}
            onSelect={handleRaceSelect}
          />
        </div>

        {/* Playstyle Selector */}
        <div className="playstyle-section">
          <h3 className="playstyle-title">How do you want to play?</h3>
          <p className="playstyle-subtitle">This customises your dashboard layout. You can change it later.</p>
          <div className="playstyle-grid">
            {PLAYSTYLES.map((ps) => {
              const isRecommended = selectedRace && ps.recommended.includes(selectedRace.name as any);
              return (
                <div
                  key={ps.id}
                  className={`playstyle-card ${selectedPlaystyle === ps.id ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
                  onClick={() => setSelectedPlaystyle(ps.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedPlaystyle(ps.id)}
                >
                  <span className="playstyle-icon">{ps.icon}</span>
                  <span className="playstyle-label">{ps.label}</span>
                  <span className="playstyle-desc">{ps.desc}</span>
                  {isRecommended && <span className="playstyle-badge">✓ Good for {selectedRace?.name}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={!kingdomName.trim() || !selectedRace}>
          Create Kingdom
        </button>
      </form>
    </div>
  );
};

export { KingdomCreation };
export default KingdomCreation;
