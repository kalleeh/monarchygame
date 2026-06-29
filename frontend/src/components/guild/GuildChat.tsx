import React, { useState } from 'react';
import { GuildService, type GuildMessage } from '../../services/GuildService';
import { achievementTriggers } from '../../utils/achievementTriggers';
import { ToastService } from '../../services/toastService';

interface GuildChatProps {
  kingdom: { id: string; guildId?: string | null; name?: string | null };
  guildTag: string | undefined;
  messages: GuildMessage[];
  onMessageSent: (msg: GuildMessage) => void;
  onMessageFailed: (msgId: string) => void;
}

const GuildChat: React.FC<GuildChatProps> = ({
  kingdom,
  guildTag,
  messages,
  onMessageSent,
  onMessageFailed,
}) => {
  const [newMessage, setNewMessage] = useState('');
  // Targets currently being flagged as a planned strike (disables their CTA).
  const [planningStrike, setPlanningStrike] = useState<Record<string, boolean>>({});

  // Flag a shared-intel target as a guild planned strike. The server posts a
  // 'strike' rally message into chat and primes the combat coordination bonus.
  const handlePlanStrike = async (targetId: string) => {
    if (!kingdom.guildId || planningStrike[targetId]) return;
    setPlanningStrike(prev => ({ ...prev, [targetId]: true }));
    try {
      await GuildService.planScoutStrike({ kingdomId: kingdom.id, targetKingdomId: targetId });
      ToastService.success('Planned strike called — guildmates get the coordination bonus.');
    } catch (error) {
      ToastService.error('Failed to plan strike: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setPlanningStrike(prev => ({ ...prev, [targetId]: false }));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !kingdom.guildId) return;

    const content = newMessage.trim();

    // Optimistic update: add to local state immediately
    const optimisticMsg: GuildMessage = {
      id: `local-${Date.now()}`,
      guildId: kingdom.guildId,
      senderId: kingdom.id,
      senderName: kingdom.name || 'Unknown',
      content,
      messageType: 'CHAT',
      createdAt: new Date().toISOString(),
    };
    onMessageSent(optimisticMsg);
    setNewMessage('');

    try {
      await GuildService.sendGuildMessage({
        guildId: kingdom.guildId,
        content,
        senderId: kingdom.id,
        senderName: kingdom.name || 'Unknown',
      });
      achievementTriggers.onMessageSent();
    } catch (error) {
      console.error('[GuildChat] Failed to send message:', error);
      onMessageFailed(optimisticMsg.id);
    }
  };

  return (
    <div className="guild-chat">
      <div className="chat-header">
        <h3>Guild Chat - [{guildTag}]</h3>
      </div>

      <div className="chat-messages">
        {messages.map(message => {
          const isIntel = message.messageType === 'INTEL';
          const isStrike = message.messageType === 'STRIKE';
          // "Plan strike" CTA on a shared-intel message that carries a target id
          // (and only when the viewer is in a guild and didn't share it themselves).
          const canPlanStrike =
            isIntel && !!message.targetId && !!kingdom.guildId;
          return (
            <div
              key={message.id}
              className={`message ${message.messageType.toLowerCase()}`}
            >
              <div className="message-header">
                <span className="sender">
                  {isIntel ? '🔍 Intel' : isStrike ? '⚔️ Strike' : message.senderName}
                </span>
                <span className="timestamp">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">{message.content}</div>
              {canPlanStrike && (
                <div className="message-actions">
                  <button
                    type="button"
                    onClick={() => handlePlanStrike(message.targetId!)}
                    disabled={!!planningStrike[message.targetId!]}
                    aria-label="Plan a coordinated strike on this target"
                  >
                    {planningStrike[message.targetId!] ? 'Planning…' : '⚔️ Plan strike'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSendMessage} className="chat-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          maxLength={500}
        />
        <button type="submit" disabled={!newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default GuildChat;
