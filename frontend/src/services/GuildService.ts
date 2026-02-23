/**
 * Guild Service - Real-time guild management
 * Handles guild operations, invitations, and messaging
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { AmplifyFunctionService } from './amplifyFunctionService';

const client = generateClient<Schema>();

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

export interface GuildWar {
  id: string;
  attackingGuildId: string;
  defendingGuildId: string;
  attackingGuildName: string;
  defendingGuildName: string;
  declaredAt: string;
  isActive: boolean;
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
