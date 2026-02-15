/**
 * SubscriptionManager Service
 * Centralized manager for all active GraphQL subscriptions.
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface Subscription {
  key: string;
  unsubscribe: () => void;
}

interface NotificationEvent {
  id: string;
  type: string;
  message: string;
  data: unknown;
  isRead: boolean;
  createdAt: string;
}

interface ChatMessageEvent {
  id: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
}

type NotificationCallback = (notifications: NotificationEvent[]) => void;
type ChatMessageCallback = (messages: ChatMessageEvent[]) => void;
type ErrorCallback = (error: unknown) => void;

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private onNotification: NotificationCallback | null = null;
  private onChatMessage: ChatMessageCallback | null = null;
  private onError: ErrorCallback | null = null;

  setNotificationCallback(callback: NotificationCallback): void {
    this.onNotification = callback;
  }

  setChatMessageCallback(callback: ChatMessageCallback): void {
    this.onChatMessage = callback;
  }

  setErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  subscribeToKingdom(kingdomId: string): void {
    const key = `kingdom:${kingdomId}`;
    this.unsubscribe(key);

    const sub = client.models.CombatNotification.observeQuery({
      filter: { recipientId: { eq: kingdomId } }
    }).subscribe({
      next: ({ items }) => {
        if (!this.onNotification) return;
        const mapped: NotificationEvent[] = items.map(item => ({
          id: item.id,
          type: (item.type as string) || 'unknown',
          message: item.message,
          data: item.data,
          isRead: item.isRead ?? false,
          createdAt: item.createdAt || new Date().toISOString(),
        }));
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.onNotification(mapped);
      },
      error: (err) => {
        console.error(`Kingdom subscription error [${kingdomId}]:`, err);
        this.onError?.(err);
      }
    });

    this.subscriptions.set(key, { key, unsubscribe: () => sub.unsubscribe() });
  }

  subscribeToGuild(guildId: string): void {
    const key = `guild:${guildId}`;
    this.unsubscribe(key);

    const sub = client.models.AllianceMessage.observeQuery({
      filter: { guildId: { eq: guildId } }
    }).subscribe({
      next: ({ items }) => {
        if (!this.onChatMessage) return;
        const mapped: ChatMessageEvent[] = items.map(item => ({
          id: item.id,
          senderId: item.senderId,
          content: item.content,
          type: (item.type as string) || 'general',
          createdAt: item.createdAt || new Date().toISOString(),
        }));
        mapped.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        this.onChatMessage(mapped);
      },
      error: (err) => {
        console.error(`Guild subscription error [${guildId}]:`, err);
        this.onError?.(err);
      }
    });

    this.subscriptions.set(key, { key, unsubscribe: () => sub.unsubscribe() });
  }

  private unsubscribe(key: string): void {
    const existing = this.subscriptions.get(key);
    if (existing) {
      try { existing.unsubscribe(); } catch { /* ignore */ }
      this.subscriptions.delete(key);
    }
  }

  unsubscribeAll(): void {
    for (const [, sub] of this.subscriptions) {
      try { sub.unsubscribe(); } catch { /* ignore */ }
    }
    this.subscriptions.clear();
    this.onNotification = null;
    this.onChatMessage = null;
    this.onError = null;
  }

  get activeCount(): number {
    return this.subscriptions.size;
  }
}

export const subscriptionManager = new SubscriptionManager();
