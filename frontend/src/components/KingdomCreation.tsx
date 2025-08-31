import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { RACES } from '../../../game-data/races';
import type { RaceType } from '../types/amplify';

const client = generateClient<Schema>();

type RaceKey = keyof typeof RACES;

interface KingdomCreationProps {
  onKingdomCreated: () => void;
}

export function KingdomCreation({ onKingdomCreated }: KingdomCreationProps) {
  const [selectedRace, setSelectedRace] = useState<RaceKey>('Human');
  const [kingdomName, setKingdomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateKingdom = async () => {
    if (!kingdomName.trim()) {
      alert('Please enter a kingdom name');
      return;
    }

    setIsCreating(true);
    try {
      const race = RACES[selectedRace];
      
      // Create kingdom with race's starting resources
      await client.models.Kingdom.create({
        name: kingdomName.trim(),
        race: selectedRace as RaceType,
        resources: race.startingResources,
        stats: race.stats,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });

      onKingdomCreated();
    } catch (error) {
      console.error('Failed to create kingdom:', error);
      alert('Failed to create kingdom. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedRaceData = RACES[selectedRace];

  return (
    <div className="kingdom-creation">
      <h2>Create Your Kingdom</h2>
      
      <div className="creation-form">
        <div className="form-group">
          <label htmlFor="kingdom-name">Kingdom Name:</label>
          <input
            id="kingdom-name"
            type="text"
            value={kingdomName}
            onChange={(e) => setKingdomName(e.target.value)}
            placeholder="Enter your kingdom name"
            maxLength={50}
          />
        </div>

        <div className="form-group">
          <label>Choose Your Race:</label>
          <div className="race-selection">
            {Object.entries(RACES).map(([raceKey, raceData]) => (
              <div
                key={raceKey}
                className={`race-option ${selectedRace === raceKey ? 'selected' : ''}`}
                onClick={() => setSelectedRace(raceKey as RaceKey)}
              >
                <h3>{raceData.name}</h3>
                <p>{raceData.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="race-details">
          <h3>{selectedRaceData.name} Details</h3>
          <p><strong>Special Ability:</strong> {selectedRaceData.specialAbility}</p>
          
          <div className="stats-grid">
            <div className="stat">
              <span>War Offense:</span>
              <div className="stat-bar">
                <div 
                  className="stat-fill" 
                  style={{ width: `${selectedRaceData.stats.warOffense * 20}%` }}
                />
              </div>
            </div>
            <div className="stat">
              <span>War Defense:</span>
              <div className="stat-bar">
                <div 
                  className="stat-fill" 
                  style={{ width: `${selectedRaceData.stats.warDefense * 20}%` }}
                />
              </div>
            </div>
            <div className="stat">
              <span>Sorcery:</span>
              <div className="stat-bar">
                <div 
                  className="stat-fill" 
                  style={{ width: `${selectedRaceData.stats.sorcery * 20}%` }}
                />
              </div>
            </div>
            <div className="stat">
              <span>Economy:</span>
              <div className="stat-bar">
                <div 
                  className="stat-fill" 
                  style={{ width: `${selectedRaceData.stats.economy * 20}%` }}
                />
              </div>
            </div>
          </div>

          <div className="unit-types">
            <strong>Unit Types:</strong>
            <ul>
              {selectedRaceData.unitTypes.map((unit, index) => (
                <li key={index}>{unit}</li>
              ))}
            </ul>
          </div>

          <div className="starting-resources">
            <strong>Starting Resources:</strong>
            <div className="resources-grid">
              <div>Gold: {selectedRaceData.startingResources.gold}</div>
              <div>Population: {selectedRaceData.startingResources.population}</div>
              <div>Land: {selectedRaceData.startingResources.land}</div>
              <div>Turns: {selectedRaceData.startingResources.turns}</div>
            </div>
          </div>
        </div>

        <button 
          className="create-button"
          onClick={handleCreateKingdom}
          disabled={isCreating || !kingdomName.trim()}
        >
          {isCreating ? 'Creating Kingdom...' : 'Create Kingdom'}
        </button>
      </div>
    </div>
  );
}
