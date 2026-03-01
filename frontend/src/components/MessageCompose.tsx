/* eslint-disable */
/**
 * MessageCompose — Diplomatic messaging modal
 *
 * Allows a player to send a direct message to another kingdom.
 * In auth mode: writes a CombatNotification with type 'alliance' and a [DIPLOMACY]
 * prefix directly via AppSync (no Lambda required).
 * In demo mode: shows a success toast without writing to the backend.
 */

import React, { useState, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import toast from 'react-hot-toast';
import './MessageCompose.css';

const MAX_MESSAGE_LENGTH = 500;

export interface MessageTarget {
  id: string;
  name: string;
}

export interface MessageComposeProps {
  /** The sending kingdom */
  senderKingdom: { id: string; name: string };
  /** Pre-selected target (e.g. when opened from envelope icon). May be undefined when opened generically. */
  defaultTarget?: MessageTarget;
  /** All kingdoms the player can message (excludes their own). */
  availableTargets: MessageTarget[];
  /** Called when the modal should be closed. */
  onClose: () => void;
}

export const MessageCompose: React.FC<MessageComposeProps> = ({
  senderKingdom,
  defaultTarget,
  availableTargets,
  onClose,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    defaultTarget?.id ?? (availableTargets[0]?.id ?? '')
  );
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the textarea on open
  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close when clicking the backdrop
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const selectedTarget = availableTargets.find(t => t.id === selectedTargetId);
  const canSend = selectedTargetId && messageText.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend || !selectedTarget) return;

    setIsSending(true);
    const trimmed = messageText.trim();
    const fullMessage = `[DIPLOMACY from ${senderKingdom.name}] ${trimmed}`;

    if (isDemoMode()) {
      // Demo mode — simulate send without touching backend
      await new Promise(r => setTimeout(r, 400));
      toast.success(`Message sent to ${selectedTarget.name}!`);
      setIsSending(false);
      onClose();
      return;
    }

    try {
      const client = generateClient<Schema>();
      await client.models.CombatNotification.create({
        recipientId: selectedTarget.id,
        type: 'alliance',
        message: fullMessage,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: JSON.stringify({ senderId: senderKingdom.id, senderName: senderKingdom.name }),
      });
      toast.success(`Message sent to ${selectedTarget.name}!`);
      onClose();
    } catch (err) {
      console.error('[MessageCompose] Failed to send message:', err);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const charsLeft = MAX_MESSAGE_LENGTH - messageText.length;

  return (
    <div
      className="msg-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Send diplomatic message"
    >
      <div className="msg-modal">
        {/* Header */}
        <div className="msg-modal-header">
          <h3 className="msg-modal-title">
            <span className="msg-envelope-icon" aria-hidden="true">&#9993;</span>
            Send Diplomatic Message
          </h3>
          <button
            className="msg-close-btn"
            onClick={onClose}
            aria-label="Close message compose"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* From */}
        <div className="msg-field">
          <label className="msg-label">From</label>
          <div className="msg-from-value">{senderKingdom.name}</div>
        </div>

        {/* To (kingdom selector) */}
        <div className="msg-field">
          <label className="msg-label" htmlFor="msg-target-select">To</label>
          {availableTargets.length === 0 ? (
            <p className="msg-no-targets">No kingdoms available to message.</p>
          ) : (
            <select
              id="msg-target-select"
              className="msg-select"
              value={selectedTargetId}
              onChange={e => setSelectedTargetId(e.target.value)}
              disabled={isSending}
            >
              {availableTargets.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Message body */}
        <div className="msg-field">
          <label className="msg-label" htmlFor="msg-body">Message</label>
          <textarea
            id="msg-body"
            ref={textAreaRef}
            className="msg-textarea"
            value={messageText}
            onChange={e => setMessageText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Write your diplomatic message here…"
            rows={5}
            disabled={isSending}
            aria-describedby="msg-chars-remaining"
          />
          <span
            id="msg-chars-remaining"
            className={`msg-chars-remaining${charsLeft <= 50 ? ' msg-chars-remaining--warn' : ''}`}
          >
            {charsLeft} characters remaining
          </span>
        </div>

        {/* Actions */}
        <div className="msg-actions">
          <button
            className="msg-btn msg-btn--cancel"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            className="msg-btn msg-btn--send"
            onClick={handleSend}
            disabled={!canSend}
            aria-busy={isSending}
          >
            {isSending ? 'Sending…' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageCompose;
