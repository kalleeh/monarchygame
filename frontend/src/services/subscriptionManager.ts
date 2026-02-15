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

interface TradeOfferEvent {
  id: string;
  sellerId: string;
  resourceType: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  status: string;
  expiresAt: string;
}

interface WarDeclarationEvent {
  id: string;
  attackerId: string;
  defenderId: string;
  status: string;
  declaredAt: string;
}

interface TreatyEvent {
  id: string;
  proposerId: string;
  recipientId: string;
  type: string;
  status: string;
  proposedAt: string;
}

type NotificationCallback = (notifications: NotificationEvent[]) => void;
type ChatMessageCallback = (messages: ChatMessageEvent[]) => void;
type TradeOfferCallback = (offers: TradeOfferEvent[]) => void;
type WarDeclarationCallback = (wars: WarDeclarationEvent[]) => void;
type TreatyCallback = (treaties: TreatyEvent[]) => void;
type ErrorCallback = (error: unknown) => void;

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private onNotification: NotificationCallback | null = null;
  private onChatMessage: ChatMessageCallback | null = null;
  private onTradeOffer: TradeOfferCallback | null = null;
  private onWarDeclaration: WarDeclarationCallback | null = null;
  private onTreaty: TreatyCallback | null = null;
  private onError: ErrorCallback | null = null;

  setNotificationCallback(callback: NotificationCallback): void {
    this.onNotification = callback;
  }

  setChatMessageCallback(callback: ChatMessageCallback): void {
    this.onChatMessage = callback;
  }

  setTradeOfferCallback(callback: TradeOfferCallback): void {
    this.onTradeOffer = callback;
  }

  setWarDeclarationCallback(callback: WarDeclarationCallback): void {
    this.onWarDeclaration = callback;
  }

  setTreatyCallback(callback: TreatyCallback): void {
    this.onTreaty = callback;
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

  subscribeToTradeOffers(seasonId: string): void {
    const key = `trade:${seasonId}`;
    this.unsubscribe(key);

    const sub = client.models.TradeOffer.observeQuery({
      filter: { seasonId: { eq: seasonId }, status: { eq: 'open' } }
    }).subscribe({
      next: ({ items }) => {
        if (!this.onTradeOffer) return;
        const mapped: TradeOfferEvent[] = items.map(item => ({
          id: item.id,
          sellerId: item.sellerId,
          resourceType: item.resourceType,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          status: (item.status as string) || 'open',
          expiresAt: item.expiresAt,
        }));
        this.onTradeOffer(mapped);
      },
      error: (err) => {
        console.error(`Trade subscription error [${seasonId}]:`, err);
        this.onError?.(err);
      }
    });

    this.subscriptions.set(key, { key, unsubscribe: () => sub.unsubscribe() });
  }

  subscribeToWarDeclarations(kingdomId: string): void {
    const key = `war:${kingdomId}`;
    this.unsubscribe(key);

    const sub = client.models.WarDeclaration.observeQuery({
      filter: {
        or: [
          { attackerId: { eq: kingdomId } },
          { defenderId: { eq: kingdomId } }
        ]
      }
    }).subscribe({
      next: ({ items }) => {
        if (!this.onWarDeclaration) return;
        const mapped: WarDeclarationEvent[] = items.map(item => ({
          id: item.id,
          attackerId: item.attackerId,
          defenderId: item.defenderId,
          status: (item.status as string) || 'declared',
          declaredAt: item.declaredAt,
        }));
        this.onWarDeclaration(mapped);
      },
      error: (err) => {
        console.error(`War subscription error [${kingdomId}]:`, err);
        this.onError?.(err);
      }
    });

    this.subscriptions.set(key, { key, unsubscribe: () => sub.unsubscribe() });
  }

  subscribeToTreaties(kingdomId: string): void {
    const key = `treaty:${kingdomId}`;
    this.unsubscribe(key);

    const sub = client.models.Treaty.observeQuery({
      filter: {
        or: [
          { proposerId: { eq: kingdomId } },
          { recipientId: { eq: kingdomId } }
        ]
      }
    }).subscribe({
      next: ({ items }) => {
        if (!this.onTreaty) return;
        const mapped: TreatyEvent[] = items.map(item => ({
          id: item.id,
          proposerId: item.proposerId,
          recipientId: item.recipientId,
          type: (item.type as string) || 'non_aggression',
          status: (item.status as string) || 'proposed',
          proposedAt: item.proposedAt,
        }));
        this.onTreaty(mapped);
      },
      error: (err) => {
        console.error(`Treaty subscription error [${kingdomId}]:`, err);
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
    this.onTradeOffer = null;
    this.onWarDeclaration = null;
    this.onTreaty = null;
    this.onError = null;
  }

  get activeCount(): number {
    return this.subscriptions.size;
  }
}

export const subscriptionManager = new SubscriptionManager();
