import React, { useState } from 'react';
import { GuildService, type GuildMessage } from '../../services/GuildService';
import { achievementTriggers } from '../../utils/achievementTriggers';

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
        {messages.map(message => (
          <div
            key={message.id}
            className={`message ${message.messageType.toLowerCase()}`}
          >
            <div className="message-header">
              <span className="sender">{message.senderName}</span>
              <span className="timestamp">
                {new Date(message.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">{message.content}</div>
          </div>
        ))}
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
