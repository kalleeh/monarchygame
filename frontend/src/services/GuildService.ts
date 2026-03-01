/**
 * Guild Service - Real-time guild management
 * Handles guild operations, invitations, and messaging
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { AmplifyFunctionService } from './amplifyFunctionService';

const client = generateClient<Schema>();

export interface AllianceUpgradeRecord {
  key: string;
  purchasedAt: string;
  expiresAt: string;
  purchasedBy: string;
}

export interface AllianceRelationship {
  targetAllianceId: string;
  targetAllianceName?: string;
  relationship: 'neutral' | 'trade_pact' | 'non_aggression' | 'allied' | 'hostile';
}

export interface GuildStats {
  treasury?: number;
  activeUpgrades?: AllianceUpgradeRecord[];
  relationships?: AllianceRelationship[];
}

export interface GuildData {
  id: string;
  name: string;
  description?: string;
  tag: string;
  leaderId: string;
  leaderName: string;
  isPublic: boolean;
  maxMembers: number;
  memberCount: number;
  totalPower: number;
  createdAt: string;
  charter?: GuildCharter;
  ranking?: number;
  warDeclarations?: GuildWar[];
  stats?: GuildStats;
}

export interface GuildCharter {
  purpose: string;
  requirements: string;
  rules: string;
  autoApprove: boolean;
  password?: string;
}

export interface GuildPrivs {
  canInvite: boolean;
  canKick: boolean;
  canEditCharter: boolean;
  canDeclareWar: boolean;
  canManageRanks: boolean;
  canAcceptApplications: boolean;
}

export interface GuildApplication {
  id: string;
  guildId: string;
  kingdomId: string;
  kingdomName: string;
  race: string;
  networth: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface GuildWarContribution {
  kingdomId: string;
  kingdomName: string;
  guildId: string;
  score: number;
  attackCount: number;
}

export interface GuildWar {
  id: string;
  attackingGuildId: string;
  defendingGuildId: string;
  attackingGuildName: string;
  defendingGuildName: string;
  status: 'ACTIVE' | 'ENDED';
  declaredAt: string;
  endsAt: string;
  attackingScore: number;
  defendingScore: number;
  contributions: GuildWarContribution[];
  winnerId?: string;
  /** @deprecated Use status === 'ACTIVE' instead */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Guild War localStorage helpers
// Used as the sole store in demo mode, and as a read-through cache in auth
// mode so that findActiveWarBetween() can remain synchronous.
// ---------------------------------------------------------------------------
const GUILD_WARS_STORAGE_KEY = 'monarchygame_guild_wars';

function loadAllGuildWars(): GuildWar[] {
  try {
    const raw = localStorage.getItem(GUILD_WARS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GuildWar[];
  } catch {
    return [];
  }
}

function saveAllGuildWars(wars: GuildWar[]): void {
  localStorage.setItem(GUILD_WARS_STORAGE_KEY, JSON.stringify(wars));
}

export interface GuildInvitation {
  id: string;
  guildId: string;
  targetKingdomId: string;
  targetKingdomName: string;
  invitedBy: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'declined' | 'EXPIRED';
  message?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface GuildMessage {
  id: string;
  guildId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  createdAt: string;
}

// Demo mode mock data
const DEMO_GUILDS: GuildData[] = [
  {
    id: 'demo-guild-1',
    name: 'The Iron Throne',
    description: 'A powerful guild of strategic kingdoms',
    tag: 'IRON',
    leaderId: 'demo-player-1',
    leaderName: 'King Arthur',
    isPublic: true,
    maxMembers: 50,
    memberCount: 23,
    totalPower: 45000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'demo-guild-2',
    name: 'Shadow Realm',
    description: 'Masters of stealth and strategy',
    tag: 'SHDW',
    leaderId: 'demo-player-2',
    leaderName: 'Dark Lord',
    isPublic: false,
    maxMembers: 30,
    memberCount: 15,
    totalPower: 32000,
    createdAt: new Date().toISOString()
  }
];

const DEMO_MESSAGES: GuildMessage[] = [
  {
    id: 'demo-msg-1',
    guildId: 'demo-guild-1',
    senderId: 'demo-player-1',
    senderName: 'King Arthur',
    content: 'Welcome to our guild! Let\'s coordinate our next attack.',
    messageType: 'CHAT',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'demo-msg-2',
    guildId: 'demo-guild-1',
    senderId: 'demo-player-3',
    senderName: 'Knight Lancelot',
    content: 'Ready for battle, my lord!',
    messageType: 'CHAT',
    createdAt: new Date(Date.now() - 1800000).toISOString()
  }
];

export class GuildService {
  /**
   * Create a new alliance
   */
  static async createGuild(data: {
    name: string;
    description?: string;
    tag: string;
    isPublic?: boolean;
    maxMembers?: number;
    kingdomId?: string;
  }): Promise<GuildData> {
    if (isDemoMode()) {
      // Demo mode: simulate alliance creation
      const newAlliance: GuildData = {
        id: `demo-guild-${Date.now()}`,
        name: data.name,
        description: data.description,
        tag: data.tag.toUpperCase(),
        leaderId: 'demo-player',
        leaderName: 'Demo Player',
        isPublic: data.isPublic ?? true,
        maxMembers: data.maxMembers ?? 20,
        memberCount: 1,
        totalPower: 1000,
        createdAt: new Date().toISOString()
      };

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return newAlliance;
    }

    try {
      const result = await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId: data.kingdomId || '',
        action: 'create',
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? true,
      });
      const parsed = JSON.parse((result as Record<string, string>).result || '{}');
      return {
        id: parsed.allianceId || `alliance-${Date.now()}`,
        name: data.name,
        description: data.description,
        tag: data.tag.toUpperCase(),
        leaderId: data.kingdomId || '',
        leaderName: '',
        isPublic: data.isPublic ?? true,
        maxMembers: data.maxMembers ?? 20,
        memberCount: 1,
        totalPower: 0,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating alliance:', error);
      throw error;
    }
  }

  /**
   * Get all public alliances
   */
  static async getPublicGuilds(): Promise<GuildData[]> {
    if (isDemoMode()) {
      // Demo mode: return mock data
      await new Promise(resolve => setTimeout(resolve, 300));
      return DEMO_GUILDS.filter(a => a.isPublic);
    }

    try {
      const response = await client.models.Alliance.list({
        filter: { isPublic: { eq: true } }
      });

      if (response.errors) {
        throw new Error(`Failed to fetch alliances: ${response.errors[0].message}`);
      }

      return response.data as unknown as GuildData[];
    } catch (error) {
      console.error('Error fetching alliances:', error);
      throw error;
    }
  }

  /**
   * Join an alliance
   */
  static async joinGuild(guildId: string, kingdomId: string): Promise<void> {
    if (isDemoMode()) {
      // Demo mode: simulate joining
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Joined alliance', guildId);
      return;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'join',
        allianceId: guildId,
      });
    } catch (error) {
      console.error('Error joining alliance:', error);
      throw error;
    }
  }

  /**
   * Leave an alliance
   */
  static async leaveGuild(kingdomId: string, allianceId?: string): Promise<void> {
    if (isDemoMode()) {
      // Demo mode: simulate leaving
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Left alliance');
      return;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'leave',
        allianceId,
      });
    } catch (error) {
      console.error('Error leaving alliance:', error);
      throw error;
    }
  }

  /**
   * Kick a member from the alliance
   */
  static async kickMember(kingdomId: string, allianceId: string, targetKingdomId: string): Promise<void> {
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Kicked member', targetKingdomId);
      return;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'kick',
        allianceId,
        targetKingdomId,
      });
    } catch (error) {
      console.error('Error kicking alliance member:', error);
      throw error;
    }
  }

  /**
   * Send alliance invitation
   */
  static async sendInvitation(data: {
    guildId: string;
    targetKingdomId: string;
    targetKingdomName: string;
    kingdomId?: string;
    message?: string;
  }): Promise<GuildInvitation> {
    if (isDemoMode()) {
      // Demo mode: simulate invitation
      const invitation: GuildInvitation = {
        id: `demo-invite-${Date.now()}`,
        guildId: data.guildId,
        targetKingdomId: data.targetKingdomId,
        targetKingdomName: data.targetKingdomName,
        invitedBy: 'demo-player',
        inviterName: 'Demo Player',
        status: 'pending',
        message: data.message,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      };

      await new Promise(resolve => setTimeout(resolve, 500));
      return invitation;
    }

    try {
      await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId: data.kingdomId || '',
        action: 'invite',
        allianceId: data.guildId,
        targetKingdomId: data.targetKingdomId,
      });

      return {
        id: `invite-${Date.now()}`,
        guildId: data.guildId,
        targetKingdomId: data.targetKingdomId,
        targetKingdomName: data.targetKingdomName,
        invitedBy: data.kingdomId || '',
        inviterName: '',
        status: 'pending',
        message: data.message,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending invitation:', error);
      throw error;
    }
  }

  /**
   * Respond to alliance invitation
   */
  static async respondToInvitation(
    invitationId: string,
    response: 'accepted' | 'declined'
  ): Promise<void> {
    if (isDemoMode()) {
      // Demo mode: simulate responding to invitation
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`Demo mode: Invitation ${invitationId} ${response}`);
      return;
    }

    try {
      const updateResponse = await (client.models as unknown as Record<string, { update: (data: unknown) => Promise<{ errors?: { message: string }[] }> }>).GuildInvitation.update({
        id: invitationId,
        status: response,
      });

      if (updateResponse.errors) {
        throw new Error(`Failed to respond to invitation: ${updateResponse.errors[0].message}`);
      }

      // If accepted, join the alliance
      if (response === 'accepted') {
        // Additional logic to join guild would go here
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      throw error;
    }
  }

  /**
   * Send alliance message
   */
  static async sendGuildMessage(data: {
    guildId: string;
    content: string;
    senderId?: string;
    senderName?: string;
    messageType?: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  }): Promise<GuildMessage> {
    if (isDemoMode()) {
      // Demo mode: simulate message sending
      const message: GuildMessage = {
        id: `demo-msg-${Date.now()}`,
        guildId: data.guildId,
        senderId: data.senderId ?? 'demo-player',
        senderName: data.senderName ?? 'Demo Player',
        content: data.content,
        messageType: data.messageType ?? 'CHAT',
        createdAt: new Date().toISOString()
      };

      await new Promise(resolve => setTimeout(resolve, 300));
      return message;
    }

    // Auth mode: persist to AllianceMessage in AppSync
    try {
      const typeMap: Record<string, 'general' | 'announcement' | 'war' | 'diplomacy'> = {
        CHAT: 'general',
        ANNOUNCEMENT: 'announcement',
        SYSTEM: 'general',
      };
      const appSyncType = typeMap[data.messageType ?? 'CHAT'] ?? 'general';

      const response = await client.models.AllianceMessage.create({
        guildId: data.guildId,
        senderId: data.senderId ?? 'unknown',
        content: data.content,
        type: appSyncType,
        createdAt: new Date().toISOString(),
      });

      if (response.errors) {
        throw new Error(`Failed to send message: ${response.errors[0].message}`);
      }

      const item = response.data;
      return {
        id: item?.id ?? `msg-${Date.now()}`,
        guildId: item?.guildId ?? data.guildId,
        senderId: item?.senderId ?? data.senderId ?? 'unknown',
        senderName: data.senderName ?? item?.senderId ?? 'Unknown',
        content: item?.content ?? data.content,
        messageType: data.messageType ?? 'CHAT',
        createdAt: item?.createdAt ?? new Date().toISOString(),
      };
    } catch (error) {
      console.error('[GuildService] Error sending alliance message:', error);
      throw error;
    }
  }

  /**
   * Get alliance messages
   */
  static async getGuildMessages(guildId: string): Promise<GuildMessage[]> {
    if (isDemoMode()) {
      // Demo mode: return mock messages
      await new Promise(resolve => setTimeout(resolve, 300));
      return DEMO_MESSAGES.filter(m => m.guildId === guildId);
    }

    // Auth mode: fetch from AllianceMessage in AppSync
    try {
      const response = await client.models.AllianceMessage.list({
        filter: { guildId: { eq: guildId } }
      });

      if (response.errors) {
        throw new Error(`Failed to fetch messages: ${response.errors[0].message}`);
      }

      return (response.data ?? []).map(item => ({
        id: item.id,
        guildId: item.guildId,
        senderId: item.senderId,
        senderName: item.senderId, // AllianceMessage has no senderName; use senderId as fallback
        content: item.content,
        messageType: 'CHAT' as const,
        createdAt: item.createdAt ?? new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[GuildService] Error fetching alliance messages:', error);
      throw error;
    }
  }

  /**
   * Subscribe to alliance messages for real-time updates
   */
  static subscribeToGuildMessages(
    guildId: string,
    onMessage: (message: GuildMessage) => void
  ) {
    if (isDemoMode()) {
      // Demo mode: return mock subscription
      return {
        unsubscribe: () => console.log('Demo mode: Unsubscribed from messages')
      };
    }

    // Auth mode: subscribe via AllianceMessage.onCreate
    const sub = client.models.AllianceMessage.onCreate({
      filter: { guildId: { eq: guildId } }
    }).subscribe({
      next: (item) => {
        if (item) {
          onMessage({
            id: item.id,
            guildId: item.guildId,
            senderId: item.senderId,
            senderName: item.senderId,
            content: item.content,
            messageType: 'CHAT',
            createdAt: item.createdAt ?? new Date().toISOString(),
          });
        }
      },
      error: (error: unknown) => {
        console.error('[GuildService] Alliance message subscription error:', error);
      }
    });

    return sub;
  }

  // =========================================================================
  // Guild War operations
  // Demo mode: stored in localStorage only.
  // Auth mode: persisted to the GuildWar Amplify model; localStorage is kept
  // as a read-through cache so findActiveWarBetween() works synchronously.
  // =========================================================================

  /**
   * Declare a guild war.
   * Input: attackingGuildId, defendingGuildId, declaringKingdomId,
   *        attackingGuildName, defendingGuildName
   */
  static async declareGuildWar(data: {
    attackingGuildId: string;
    defendingGuildId: string;
    declaringKingdomId: string;
    attackingGuildName: string;
    defendingGuildName: string;
  }): Promise<GuildWar> {
    const { attackingGuildId, defendingGuildId, attackingGuildName, defendingGuildName } = data;

    if (attackingGuildId === defendingGuildId) {
      throw new Error('Cannot declare war on your own guild');
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours

    if (isDemoMode()) {
      const existing = loadAllGuildWars();

      // Check if already in active guild war between these two guilds
      const alreadyAtWar = existing.some(
        w =>
          w.status === 'ACTIVE' &&
          ((w.attackingGuildId === attackingGuildId && w.defendingGuildId === defendingGuildId) ||
            (w.attackingGuildId === defendingGuildId && w.defendingGuildId === attackingGuildId))
      );
      if (alreadyAtWar) {
        throw new Error('Already in an active war between these guilds');
      }

      const war: GuildWar = {
        id: `guildwar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        attackingGuildId,
        defendingGuildId,
        attackingGuildName,
        defendingGuildName,
        status: 'ACTIVE',
        declaredAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        attackingScore: 0,
        defendingScore: 0,
        contributions: [],
        isActive: true,
      };

      saveAllGuildWars([...existing, war]);
      return war;
    }

    // Auth mode: persist to Amplify backend
    try {
      // Check no active war already exists
      const checkAttacking = await client.models.GuildWar.list({
        filter: { attackingGuildId: { eq: attackingGuildId }, status: { eq: 'ACTIVE' } }
      });
      const checkDefending = await client.models.GuildWar.list({
        filter: { defendingGuildId: { eq: attackingGuildId }, status: { eq: 'ACTIVE' } }
      });
      const allActive = [
        ...(checkAttacking.data ?? []),
        ...(checkDefending.data ?? []),
      ];
      const alreadyAtWar = allActive.some(
        w =>
          (w.attackingGuildId === attackingGuildId && w.defendingGuildId === defendingGuildId) ||
          (w.attackingGuildId === defendingGuildId && w.defendingGuildId === attackingGuildId)
      );
      if (alreadyAtWar) {
        throw new Error('Already in an active war between these guilds');
      }

      const response = await client.models.GuildWar.create({
        attackingGuildId,
        defendingGuildId,
        attackingGuildName,
        defendingGuildName,
        status: 'ACTIVE',
        declaredAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        attackingScore: 0,
        defendingScore: 0,
        contributions: JSON.stringify([]),
      });

      if (response.errors) {
        throw new Error(`Failed to declare guild war: ${response.errors[0].message}`);
      }

      const item = response.data!;
      const war: GuildWar = {
        id: item.id,
        attackingGuildId: item.attackingGuildId,
        defendingGuildId: item.defendingGuildId,
        attackingGuildName: item.attackingGuildName,
        defendingGuildName: item.defendingGuildName,
        status: 'ACTIVE',
        declaredAt: item.declaredAt,
        endsAt: item.endsAt,
        attackingScore: item.attackingScore ?? 0,
        defendingScore: item.defendingScore ?? 0,
        contributions: item.contributions ? (JSON.parse(item.contributions as string) as GuildWarContribution[]) : [],
        winnerId: item.winnerId ?? undefined,
        isActive: true,
      };
      // Mirror to localStorage cache so findActiveWarBetween works synchronously
      const cached = loadAllGuildWars().filter(w => w.id !== war.id);
      saveAllGuildWars([...cached, war]);
      return war;
    } catch (error) {
      console.error('[GuildService] declareGuildWar auth error:', error);
      throw error;
    }
  }

  /**
   * Resolve a guild war — set status to ENDED, determine winner.
   */
  static async resolveGuildWar(warId: string): Promise<GuildWar> {
    if (isDemoMode()) {
      const wars = loadAllGuildWars();
      const idx = wars.findIndex(w => w.id === warId);
      if (idx === -1) throw new Error('Guild war not found');

      const war = wars[idx];
      let winnerId: string | undefined;
      if (war.attackingScore > war.defendingScore) {
        winnerId = war.attackingGuildId;
      } else if (war.defendingScore > war.attackingScore) {
        winnerId = war.defendingGuildId;
      }
      // tie → no winner (winnerId stays undefined)

      const updated: GuildWar = { ...war, status: 'ENDED', isActive: false, winnerId };
      wars[idx] = updated;
      saveAllGuildWars(wars);
      return updated;
    }

    // Auth mode: fetch war, determine winner, update via Amplify
    try {
      const getResponse = await client.models.GuildWar.get({ id: warId });
      if (getResponse.errors) {
        throw new Error(`Failed to fetch guild war: ${getResponse.errors[0].message}`);
      }
      const item = getResponse.data;
      if (!item) throw new Error('Guild war not found');

      const attackingScore = item.attackingScore ?? 0;
      const defendingScore = item.defendingScore ?? 0;
      let winnerId: string | undefined;
      if (attackingScore > defendingScore) {
        winnerId = item.attackingGuildId;
      } else if (defendingScore > attackingScore) {
        winnerId = item.defendingGuildId;
      }

      const updateResponse = await client.models.GuildWar.update({
        id: warId,
        status: 'ENDED',
        winnerId: winnerId ?? null,
      });
      if (updateResponse.errors) {
        throw new Error(`Failed to resolve guild war: ${updateResponse.errors[0].message}`);
      }

      const updated: GuildWar = {
        id: item.id,
        attackingGuildId: item.attackingGuildId,
        defendingGuildId: item.defendingGuildId,
        attackingGuildName: item.attackingGuildName,
        defendingGuildName: item.defendingGuildName,
        status: 'ENDED',
        declaredAt: item.declaredAt,
        endsAt: item.endsAt,
        attackingScore,
        defendingScore,
        contributions: item.contributions ? (JSON.parse(item.contributions as string) as GuildWarContribution[]) : [],
        winnerId,
        isActive: false,
      };
      // Update localStorage cache
      const wars = loadAllGuildWars();
      const idx = wars.findIndex(w => w.id === warId);
      if (idx !== -1) {
        wars[idx] = updated;
        saveAllGuildWars(wars);
      }
      return updated;
    } catch (error) {
      console.error('[GuildService] resolveGuildWar auth error:', error);
      throw error;
    }
  }

  /**
   * Record a guild war contribution after a successful attack.
   * Adds points to the appropriate guild's score and upserts the
   * contributor record. Does NOT throw — safe for fire-and-forget use.
   */
  static recordGuildWarContribution(params: {
    warId: string;
    kingdomId: string;
    kingdomName: string;
    guildId: string;
    points: number;
  }): void {
    try {
      const { warId, kingdomId, kingdomName, guildId, points } = params;
      if (points <= 0) return;

      // Always update localStorage cache first (used by findActiveWarBetween sync path)
      const wars = loadAllGuildWars();
      const idx = wars.findIndex(w => w.id === warId);
      if (idx !== -1) {
        const war = { ...wars[idx] };
        if (war.status === 'ACTIVE') {
          if (guildId === war.attackingGuildId) {
            war.attackingScore = (war.attackingScore || 0) + points;
          } else if (guildId === war.defendingGuildId) {
            war.defendingScore = (war.defendingScore || 0) + points;
          }
          const contributions = [...(war.contributions || [])];
          const contribIdx = contributions.findIndex(
            c => c.kingdomId === kingdomId && c.guildId === guildId
          );
          if (contribIdx === -1) {
            contributions.push({ kingdomId, kingdomName, guildId, score: points, attackCount: 1 });
          } else {
            contributions[contribIdx] = {
              ...contributions[contribIdx],
              score: contributions[contribIdx].score + points,
              attackCount: contributions[contribIdx].attackCount + 1,
            };
          }
          war.contributions = contributions;
          wars[idx] = war;
          saveAllGuildWars(wars);
        }
      }

      if (!isDemoMode()) {
        // Auth mode: persist to Amplify asynchronously (fire-and-forget)
        GuildService._recordGuildWarContributionAsync(params).catch(e => {
          console.warn('[GuildService] recordGuildWarContribution Amplify sync failed silently:', e);
        });
      }
    } catch (e) {
      // Fire-and-forget: never let this crash the caller
      console.warn('[GuildService] recordGuildWarContribution failed silently:', e);
    }
  }

  /** @internal Auth-mode async helper for recordGuildWarContribution. */
  private static async _recordGuildWarContributionAsync(params: {
    warId: string;
    kingdomId: string;
    kingdomName: string;
    guildId: string;
    points: number;
  }): Promise<void> {
    const { warId, kingdomId, kingdomName, guildId, points } = params;

    const getResponse = await client.models.GuildWar.get({ id: warId });
    if (getResponse.errors || !getResponse.data) return;

    const item = getResponse.data;
    if (item.status !== 'ACTIVE') return;

    let attackingScore = item.attackingScore ?? 0;
    let defendingScore = item.defendingScore ?? 0;

    if (guildId === item.attackingGuildId) {
      attackingScore += points;
    } else if (guildId === item.defendingGuildId) {
      defendingScore += points;
    } else {
      return; // kingdom not in this war
    }

    const contributions: GuildWarContribution[] = item.contributions
      ? (JSON.parse(item.contributions as string) as GuildWarContribution[])
      : [];
    const contribIdx = contributions.findIndex(
      c => c.kingdomId === kingdomId && c.guildId === guildId
    );
    if (contribIdx === -1) {
      contributions.push({ kingdomId, kingdomName, guildId, score: points, attackCount: 1 });
    } else {
      contributions[contribIdx] = {
        ...contributions[contribIdx],
        score: contributions[contribIdx].score + points,
        attackCount: contributions[contribIdx].attackCount + 1,
      };
    }

    await client.models.GuildWar.update({
      id: warId,
      attackingScore,
      defendingScore,
      contributions: JSON.stringify(contributions),
    });
  }

  /**
   * Concede an active guild war (sets status to ENDED with the other guild as winner).
   * Only callable by the conceding guild.
   */
  static async concedeGuildWar(warId: string, concedingGuildId: string): Promise<GuildWar> {
    if (isDemoMode()) {
      const wars = loadAllGuildWars();
      const idx = wars.findIndex(w => w.id === warId);
      if (idx === -1) throw new Error('Guild war not found');

      const war = wars[idx];
      if (war.status !== 'ACTIVE') throw new Error('War is not active');

      const winnerId =
        concedingGuildId === war.attackingGuildId
          ? war.defendingGuildId
          : war.attackingGuildId;

      const updated: GuildWar = { ...war, status: 'ENDED', isActive: false, winnerId };
      wars[idx] = updated;
      saveAllGuildWars(wars);
      return updated;
    }

    // Auth mode: fetch war, set winner to opposite guild, update via Amplify
    try {
      const getResponse = await client.models.GuildWar.get({ id: warId });
      if (getResponse.errors) {
        throw new Error(`Failed to fetch guild war: ${getResponse.errors[0].message}`);
      }
      const item = getResponse.data;
      if (!item) throw new Error('Guild war not found');
      if (item.status !== 'ACTIVE') throw new Error('War is not active');

      const winnerId =
        concedingGuildId === item.attackingGuildId
          ? item.defendingGuildId
          : item.attackingGuildId;

      const updateResponse = await client.models.GuildWar.update({
        id: warId,
        status: 'ENDED',
        winnerId,
      });
      if (updateResponse.errors) {
        throw new Error(`Failed to concede guild war: ${updateResponse.errors[0].message}`);
      }

      const updated: GuildWar = {
        id: item.id,
        attackingGuildId: item.attackingGuildId,
        defendingGuildId: item.defendingGuildId,
        attackingGuildName: item.attackingGuildName,
        defendingGuildName: item.defendingGuildName,
        status: 'ENDED',
        declaredAt: item.declaredAt,
        endsAt: item.endsAt,
        attackingScore: item.attackingScore ?? 0,
        defendingScore: item.defendingScore ?? 0,
        contributions: item.contributions ? (JSON.parse(item.contributions as string) as GuildWarContribution[]) : [],
        winnerId,
        isActive: false,
      };
      // Update localStorage cache
      const wars = loadAllGuildWars();
      const idx = wars.findIndex(w => w.id === warId);
      if (idx !== -1) {
        wars[idx] = updated;
        saveAllGuildWars(wars);
      }
      return updated;
    } catch (error) {
      console.error('[GuildService] concedeGuildWar auth error:', error);
      throw error;
    }
  }

  /**
   * Load guild wars for a given guild (active + recent ended).
   * Returns wars sorted newest first.
   */
  static async loadGuildWars(guildId: string): Promise<{ active: GuildWar[]; history: GuildWar[] }> {
    if (isDemoMode()) {
      // Simulate async I/O
      await new Promise(resolve => setTimeout(resolve, 0));

      // Auto-expire any wars past their endsAt timestamp
      const now = new Date();
      let wars = loadAllGuildWars();
      let dirty = false;
      wars = wars.map(w => {
        if (w.status === 'ACTIVE' && new Date(w.endsAt) < now) {
          dirty = true;
          let winnerId: string | undefined;
          if (w.attackingScore > w.defendingScore) winnerId = w.attackingGuildId;
          else if (w.defendingScore > w.attackingScore) winnerId = w.defendingGuildId;
          return { ...w, status: 'ENDED' as const, isActive: false, winnerId };
        }
        return w;
      });
      if (dirty) saveAllGuildWars(wars);

      const relevant = wars.filter(
        w => w.attackingGuildId === guildId || w.defendingGuildId === guildId
      );

      const active = relevant
        .filter(w => w.status === 'ACTIVE')
        .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime());

      const history = relevant
        .filter(w => w.status === 'ENDED')
        .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime())
        .slice(0, 10); // Keep last 10

      return { active, history };
    }

    // Auth mode: query Amplify for wars where this guild is attacker or defender
    try {
      const [attackingRes, defendingRes] = await Promise.all([
        client.models.GuildWar.list({ filter: { attackingGuildId: { eq: guildId } } }),
        client.models.GuildWar.list({ filter: { defendingGuildId: { eq: guildId } } }),
      ]);

      const allItems = [
        ...(attackingRes.data ?? []),
        ...(defendingRes.data ?? []),
      ];

      // De-duplicate by id (a war won't appear in both queries, but guard anyway)
      const seen = new Set<string>();
      const now = new Date();

      const wars: GuildWar[] = allItems
        .filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .map(item => {
          const isExpired = item.status === 'ACTIVE' && new Date(item.endsAt) < now;
          const effectiveStatus: 'ACTIVE' | 'ENDED' = isExpired ? 'ENDED' : (item.status as 'ACTIVE' | 'ENDED');
          let winnerId: string | undefined = item.winnerId ?? undefined;
          if (isExpired && !winnerId) {
            const as = item.attackingScore ?? 0;
            const ds = item.defendingScore ?? 0;
            if (as > ds) winnerId = item.attackingGuildId;
            else if (ds > as) winnerId = item.defendingGuildId;
          }
          return {
            id: item.id,
            attackingGuildId: item.attackingGuildId,
            defendingGuildId: item.defendingGuildId,
            attackingGuildName: item.attackingGuildName,
            defendingGuildName: item.defendingGuildName,
            status: effectiveStatus,
            declaredAt: item.declaredAt,
            endsAt: item.endsAt,
            attackingScore: item.attackingScore ?? 0,
            defendingScore: item.defendingScore ?? 0,
            contributions: item.contributions ? (JSON.parse(item.contributions as string) as GuildWarContribution[]) : [],
            winnerId,
            isActive: effectiveStatus === 'ACTIVE',
          };
        });

      // Mirror all fetched wars into the localStorage cache for findActiveWarBetween
      const cached = loadAllGuildWars();
      const cachedMap = new Map(cached.map(w => [w.id, w]));
      for (const w of wars) {
        cachedMap.set(w.id, w);
      }
      saveAllGuildWars(Array.from(cachedMap.values()));

      const active = wars
        .filter(w => w.status === 'ACTIVE')
        .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime());

      const history = wars
        .filter(w => w.status === 'ENDED')
        .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime())
        .slice(0, 10);

      return { active, history };
    } catch (error) {
      console.error('[GuildService] loadGuildWars auth error:', error);
      // Fall back to localStorage cache on error
      const wars = loadAllGuildWars().filter(
        w => w.attackingGuildId === guildId || w.defendingGuildId === guildId
      );
      return {
        active: wars.filter(w => w.status === 'ACTIVE'),
        history: wars.filter(w => w.status === 'ENDED').slice(0, 10),
      };
    }
  }

  /**
   * Find an active guild war where both guildA and guildB are participants.
   * Returns null if none found. Used by the combat hook for war scoring.
   * Always reads from the localStorage cache for synchronous access.
   * In auth mode, call findActiveWarBetweenAsync to refresh the cache first.
   */
  static findActiveWarBetween(guildIdA: string, guildIdB: string): GuildWar | null {
    const wars = loadAllGuildWars();
    return (
      wars.find(
        w =>
          w.status === 'ACTIVE' &&
          ((w.attackingGuildId === guildIdA && w.defendingGuildId === guildIdB) ||
            (w.attackingGuildId === guildIdB && w.defendingGuildId === guildIdA))
      ) ?? null
    );
  }

  /**
   * Async version of findActiveWarBetween for auth mode.
   * Queries Amplify and updates the localStorage cache, then returns the result.
   * Falls back to the cache if the query fails.
   */
  static async findActiveWarBetweenAsync(guildIdA: string, guildIdB: string): Promise<GuildWar | null> {
    if (isDemoMode()) {
      return GuildService.findActiveWarBetween(guildIdA, guildIdB);
    }

    try {
      const [resA, resB] = await Promise.all([
        client.models.GuildWar.list({
          filter: { attackingGuildId: { eq: guildIdA }, status: { eq: 'ACTIVE' } }
        }),
        client.models.GuildWar.list({
          filter: { attackingGuildId: { eq: guildIdB }, status: { eq: 'ACTIVE' } }
        }),
      ]);

      const candidates = [
        ...(resA.data ?? []),
        ...(resB.data ?? []),
      ].filter(
        item =>
          (item.attackingGuildId === guildIdA && item.defendingGuildId === guildIdB) ||
          (item.attackingGuildId === guildIdB && item.defendingGuildId === guildIdA)
      );

      if (candidates.length === 0) return null;

      const item = candidates[0];
      const now = new Date();
      const isExpired = new Date(item.endsAt) < now;
      if (isExpired) return null;

      const war: GuildWar = {
        id: item.id,
        attackingGuildId: item.attackingGuildId,
        defendingGuildId: item.defendingGuildId,
        attackingGuildName: item.attackingGuildName,
        defendingGuildName: item.defendingGuildName,
        status: 'ACTIVE',
        declaredAt: item.declaredAt,
        endsAt: item.endsAt,
        attackingScore: item.attackingScore ?? 0,
        defendingScore: item.defendingScore ?? 0,
        contributions: item.contributions ? (JSON.parse(item.contributions as string) as GuildWarContribution[]) : [],
        winnerId: item.winnerId ?? undefined,
        isActive: true,
      };

      // Update the localStorage cache
      const cached = loadAllGuildWars();
      const idx = cached.findIndex(w => w.id === war.id);
      if (idx === -1) {
        saveAllGuildWars([...cached, war]);
      } else {
        cached[idx] = war;
        saveAllGuildWars(cached);
      }

      return war;
    } catch (error) {
      console.warn('[GuildService] findActiveWarBetweenAsync failed, using cache:', error);
      return GuildService.findActiveWarBetween(guildIdA, guildIdB);
    }
  }

  // =========================================================================
  // Alliance composition bonus
  // =========================================================================

  /**
   * Read the current composition bonus stored in alliance stats.
   * Returns default multipliers (all 1.0) if not yet computed.
   */
  static async getCompositionBonus(allianceId: string): Promise<{ income: number; combat: number; espionage: number }> {
    const defaultBonus = { income: 1.0, combat: 1.0, espionage: 1.0 };

    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return defaultBonus;
    }

    try {
      const response = await client.models.Alliance.get({ id: allianceId });
      if (response.errors || !response.data) return defaultBonus;

      const rawStats = response.data.stats as unknown;
      const stats: Record<string, unknown> = rawStats
        ? (typeof rawStats === 'string' ? JSON.parse(rawStats as string) : (rawStats as Record<string, unknown>))
        : {};

      return (stats.compositionBonus as { income: number; combat: number; espionage: number }) ?? defaultBonus;
    } catch (error) {
      console.error('[GuildService] getCompositionBonus error:', error);
      return defaultBonus;
    }
  }

  // =========================================================================
  // Alliance treasury upgrades
  // =========================================================================

  /**
   * Purchase a guild-wide timed upgrade from the alliance treasury.
   * Only the alliance leader may call this.
   * Returns the upgrade type and its expiry timestamp.
   */
  static async purchaseUpgrade(
    allianceId: string,
    kingdomId: string,
    upgradeType: string
  ): Promise<{ upgradeType: string; expiresAt: string }> {
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        upgradeType,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      };
    }

    try {
      const result = await AmplifyFunctionService.callFunction('alliance-treasury', {
        kingdomId,
        action: 'upgrade',
        allianceId,
        upgradeType,
      });
      const parsed = JSON.parse((result as Record<string, string>).result || '{}');
      return {
        upgradeType: (parsed.upgradeType as string) ?? upgradeType,
        expiresAt: (parsed.expiresAt as string) ?? new Date().toISOString(),
      };
    } catch (error) {
      console.error('[GuildService] purchaseUpgrade error:', error);
      throw error;
    }
  }

  /**
   * Read active (non-expired) upgrades from alliance stats.
   */
  static async getActiveUpgrades(allianceId: string): Promise<Array<{ type: string; expiresAt: string; effect: Record<string, number> }>> {
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return [];
    }

    try {
      const response = await client.models.Alliance.get({ id: allianceId });
      if (response.errors || !response.data) return [];

      const rawStats = response.data.stats as unknown;
      const stats: Record<string, unknown> = rawStats
        ? (typeof rawStats === 'string' ? JSON.parse(rawStats as string) : (rawStats as Record<string, unknown>))
        : {};

      const upgrades = (stats.activeUpgrades as Array<{ type: string; expiresAt: string; effect: Record<string, number> }>) ?? [];
      const now = Date.now();
      return upgrades.filter(u => new Date(u.expiresAt).getTime() > now);
    } catch (error) {
      console.error('[GuildService] getActiveUpgrades error:', error);
      return [];
    }
  }

  // =========================================================================
  // Inter-alliance diplomacy
  // =========================================================================

  /**
   * Set a formal relationship status between this alliance and another.
   * Only the alliance leader may call this.
   * Valid relationship values: 'neutral' | 'trade_pact' | 'non_aggression' | 'allied' | 'hostile'
   */
  static async setInterAllianceRelationship(
    allianceId: string,
    kingdomId: string,
    targetAllianceId: string,
    relationship: 'neutral' | 'trade_pact' | 'non_aggression' | 'allied' | 'hostile'
  ): Promise<{ allianceId: string; targetAllianceId: string; relationship: string }> {
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { allianceId, targetAllianceId, relationship };
    }

    try {
      const result = await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'set_relationship',
        allianceId,
        targetAllianceId,
        relationship,
      });
      const parsed = JSON.parse((result as Record<string, string>).result || '{}');
      return {
        allianceId: (parsed.allianceId as string) ?? allianceId,
        targetAllianceId: (parsed.targetAllianceId as string) ?? targetAllianceId,
        relationship: (parsed.relationship as string) ?? relationship,
      };
    } catch (error) {
      console.error('[GuildService] setInterAllianceRelationship error:', error);
      throw error;
    }
  }

  /**
   * Retrieve the current relationship status between two alliances.
   * Returns 'neutral' when no formal relationship has been recorded.
   */
  static async getInterAllianceRelationship(
    allianceId: string,
    kingdomId: string,
    targetAllianceId: string
  ): Promise<string> {
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return 'neutral';
    }

    try {
      const result = await AmplifyFunctionService.callFunction('alliance-manager', {
        kingdomId,
        action: 'get_relationship',
        allianceId,
        targetAllianceId,
      });
      const parsed = JSON.parse((result as Record<string, string>).result || '{}');
      return (parsed.relationship as string) ?? 'neutral';
    } catch (error) {
      console.error('[GuildService] getInterAllianceRelationship error:', error);
      return 'neutral';
    }
  }

  /**
   * Subscribe to alliance invitations
   */
  static subscribeToInvitations(
    kingdomId: string,
    onInvitation: (invitation: GuildInvitation) => void
  ) {
    if (isDemoMode()) {
      // Demo mode: return mock subscription
      return {
        unsubscribe: () => console.log('Demo mode: Unsubscribed from invitations')
      };
    }

    return (client.models as unknown as Record<string, { onCreate: (options: unknown) => { subscribe: (handlers: { next: (data: unknown) => void; error: (error: unknown) => void }) => { unsubscribe: () => void } } }>).GuildInvitation.onCreate({
      filter: { inviteeId: { eq: kingdomId } }
    }).subscribe({
      next: (data: unknown) => {
        if (data) {
          onInvitation(data as unknown as GuildInvitation);
        }
      },
      error: (error: unknown) => {
        console.error('Alliance invitation subscription error:', error);
      }
    });
  }
}
