/**
 * useRealtimeChat Hook
 * Subscribes to AllianceMessage model for real-time guild chat.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
}

export function useRealtimeChat(guildId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    if (!guildId) return;

    const sub = client.models.AllianceMessage.observeQuery({
      filter: { guildId: { eq: guildId } }
    }).subscribe({
      next: ({ items }) => {
        const mapped = items.map(item => ({
          id: item.id,
          senderId: item.senderId,
          content: item.content,
          type: (item.type as string) || 'general',
          createdAt: item.createdAt || new Date().toISOString(),
        }));
        mapped.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(mapped);
        setIsConnected(true);
      },
      error: (err) => {
        console.error('Chat subscription error:', err);
        setIsConnected(false);
      }
    });

    subscriptionRef.current = sub;

    return () => {
      sub.unsubscribe();
      subscriptionRef.current = null;
      setIsConnected(false);
    };
  }, [guildId]);

  const sendMessage = useCallback(async (
    senderId: string,
    content: string,
    type: 'general' | 'announcement' | 'war' | 'diplomacy' = 'general'
  ) => {
    if (!guildId) throw new Error('No guild ID');

    await client.models.AllianceMessage.create({
      guildId,
      senderId,
      content,
      type,
      createdAt: new Date().toISOString(),
    });
  }, [guildId]);

  return { messages, isConnected, sendMessage };
}
