import { FormationType } from '../../types/combat';
import { FORMATIONS } from '../../data/formations';
import './CombatEnhancements.css';

interface FormationSelectorProps {
  selectedFormation: FormationType;
  onFormationChange: (formation: FormationType) => void;
}

export const FormationSelector = ({ selectedFormation, onFormationChange }: FormationSelectorProps) => {
  return (
    <div className="formation-selector">
      <h3>⚔️ Battle Formation</h3>
      
      <div className="formation-grid">
        {FORMATIONS.map((formation) => (
          <button
            key={formation.type}
            className={`formation-option ${selectedFormation === formation.type ? 'selected' : ''}`}
            onClick={() => onFormationChange(formation.type)}
          >
            <span className="formation-icon">{formation.icon}</span>
            <div className="formation-info">
              <span className="formation-name">{formation.name}</span>
              <span className="formation-description">{formation.description}</span>
              <div className="formation-modifiers">
                <span className={formation.modifiers.defense > 0 ? 'positive' : 'negative'}>
                  🛡️ {formation.modifiers.defense > 0 ? '+' : ''}{(formation.modifiers.defense * 100).toFixed(0)}%
                </span>
                <span className={formation.modifiers.offense > 0 ? 'positive' : 'negative'}>
                  ⚔️ {formation.modifiers.offense > 0 ? '+' : ''}{(formation.modifiers.offense * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
