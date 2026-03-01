import React from 'react';

interface GuildCreateFormProps {
  loading: boolean;
  newGuildName: string;
  newGuildTag: string;
  newGuildDesc: string;
  charterPurpose: string;
  charterRequirements: string;
  charterRules: string;
  charterAutoApprove: boolean;
  onNewGuildNameChange: (v: string) => void;
  onNewGuildTagChange: (v: string) => void;
  onNewGuildDescChange: (v: string) => void;
  onCharterPurposeChange: (v: string) => void;
  onCharterRequirementsChange: (v: string) => void;
  onCharterRulesChange: (v: string) => void;
  onCharterAutoApproveChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const GuildCreateForm: React.FC<GuildCreateFormProps> = ({
  loading,
  newGuildName,
  newGuildTag,
  newGuildDesc,
  charterPurpose,
  charterRequirements,
  charterRules,
  charterAutoApprove,
  onNewGuildNameChange,
  onNewGuildTagChange,
  onNewGuildDescChange,
  onCharterPurposeChange,
  onCharterRequirementsChange,
  onCharterRulesChange,
  onCharterAutoApproveChange,
  onSubmit,
}) => {
  return (
    <div className="create-guild">
      <h3>Create New Alliance</h3>
      <form onSubmit={onSubmit} className="guild-form">
        <div className="form-group">
          <label htmlFor="guild-name">Guild Name</label>
          <input
            id="guild-name"
            type="text"
            value={newGuildName}
            onChange={(e) => onNewGuildNameChange(e.target.value)}
            placeholder="Enter guild name"
            maxLength={50}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="guild-tag">Guild Tag (3-5 characters)</label>
          <input
            id="guild-tag"
            type="text"
            value={newGuildTag}
            onChange={(e) => onNewGuildTagChange(e.target.value.toUpperCase())}
            placeholder="TAG"
            maxLength={5}
            minLength={3}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="guild-desc">Description (Optional)</label>
          <textarea
            id="guild-desc"
            value={newGuildDesc}
            onChange={(e) => onNewGuildDescChange(e.target.value)}
            placeholder="Describe your guild's goals and values"
            maxLength={500}
            rows={4}
          />
        </div>

        <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Guild Charter</h4>

        <div className="form-group">
          <label htmlFor="charter-purpose">Purpose</label>
          <textarea
            id="charter-purpose"
            value={charterPurpose}
            onChange={(e) => onCharterPurposeChange(e.target.value)}
            placeholder="What is the purpose of this guild?"
            maxLength={300}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="charter-requirements">Requirements</label>
          <textarea
            id="charter-requirements"
            value={charterRequirements}
            onChange={(e) => onCharterRequirementsChange(e.target.value)}
            placeholder="What are the requirements to join?"
            maxLength={300}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="charter-rules">Rules</label>
          <textarea
            id="charter-rules"
            value={charterRules}
            onChange={(e) => onCharterRulesChange(e.target.value)}
            placeholder="What are the guild rules?"
            maxLength={500}
            rows={4}
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={charterAutoApprove}
              onChange={(e) => onCharterAutoApproveChange(e.target.checked)}
            />
            {' '}Auto-approve applications
          </label>
        </div>

        <button type="submit" disabled={loading} className="create-btn">
          {loading ? 'Creating...' : 'Create Alliance'}
        </button>
      </form>
    </div>
  );
};

export default GuildCreateForm;
