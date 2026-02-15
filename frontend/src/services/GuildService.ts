/**
 * Guild Service - Real-time guild management
 * Handles guild operations, invitations, and messaging
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

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
  private static isDemoMode(): boolean {
    return localStorage.getItem('demo-mode') === 'true';
  }

  /**
   * Create a new alliance
   */
  static async createGuild(data: {
    name: string;
    description?: string;
    tag: string;
    isPublic?: boolean;
    maxMembers?: number;
  }): Promise<GuildData> {
    if (this.isDemoMode()) {
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
      const response = await client.models.Alliance.create({
        name: data.name,
        description: data.description,
        leaderId: 'current-user-id', // Will be replaced with actual user ID
        memberIds: [],
        isPublic: data.isPublic ?? true,
        maxMembers: data.maxMembers ?? 20,
        createdAt: new Date().toISOString(),
      });

      if (response.errors) {
        throw new Error(`Failed to create guild: ${response.errors[0].message}`);
      }

      return response.data as unknown as GuildData;
    } catch (error) {
      console.error('Error creating alliance:', error);
      throw error;
    }
  }

  /**
   * Get all public alliances
   */
  static async getPublicGuilds(): Promise<GuildData[]> {
    if (this.isDemoMode()) {
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
    if (this.isDemoMode()) {
      // Demo mode: simulate joining
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Joined alliance', guildId);
      return;
    }

    try {
      // Update kingdom with alliance ID
      const response = await client.models.Kingdom.update({
        id: kingdomId,
        guildId: guildId,
      });

      if (response.errors) {
        throw new Error(`Failed to join guild: ${response.errors[0].message}`);
      }

      // Send system message to alliance
      await this.sendGuildMessage({
        guildId,
        content: `A new kingdom has joined the alliance!`,
        messageType: 'SYSTEM',
      });
    } catch (error) {
      console.error('Error joining alliance:', error);
      throw error;
    }
  }

  /**
   * Leave an alliance
   */
  static async leaveGuild(kingdomId: string): Promise<void> {
    if (this.isDemoMode()) {
      // Demo mode: simulate leaving
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Left alliance');
      return;
    }

    try {
      const response = await client.models.Kingdom.update({
        id: kingdomId,
        guildId: null,
      });

      if (response.errors) {
        throw new Error(`Failed to leave guild: ${response.errors[0].message}`);
      }
    } catch (error) {
      console.error('Error leaving alliance:', error);
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
    message?: string;
  }): Promise<GuildInvitation> {
    if (this.isDemoMode()) {
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
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const response = await (client.models as unknown as Record<string, { create: (data: unknown) => Promise<unknown> }>).GuildInvitation.create({
        guildId: data.guildId,
        inviterId: 'current-user-id',
        inviteeId: data.targetKingdomId,
        status: 'pending',
        message: data.message,
        createdAt: new Date().toISOString(),
      });

      const typedResponse = response as { errors?: Array<{ message: string }>; data?: unknown };
      if (typedResponse.errors) {
        throw new Error(`Failed to send invitation: ${typedResponse.errors[0].message}`);
      }

      return typedResponse.data as unknown as GuildInvitation;
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
    messageType?: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  }): Promise<GuildMessage> {
    if (this.isDemoMode()) {
      // Demo mode: simulate message sending
      const message: GuildMessage = {
        id: `demo-msg-${Date.now()}`,
        guildId: data.guildId,
        senderId: 'demo-player',
        senderName: 'Demo Player',
        content: data.content,
        messageType: data.messageType ?? 'CHAT',
        createdAt: new Date().toISOString()
      };
      
      await new Promise(resolve => setTimeout(resolve, 300));
      return message;
    }

    try {
      const response = await (client.models as unknown as Record<string, { create: (data: unknown) => Promise<{ errors?: { message: string }[]; data?: unknown }> }>).GuildMessage.create({
        guildId: data.guildId,
        senderId: 'current-user-id',
        content: data.content,
        createdAt: new Date().toISOString(),
      });

      if (response.errors) {
        throw new Error(`Failed to send message: ${response.errors[0].message}`);
      }

      return response.data as unknown as GuildMessage;
    } catch (error) {
      console.error('Error sending alliance message:', error);
      throw error;
    }
  }

  /**
   * Get alliance messages
   */
  static async getGuildMessages(guildId: string): Promise<GuildMessage[]> {
    if (this.isDemoMode()) {
      // Demo mode: return mock messages
      await new Promise(resolve => setTimeout(resolve, 300));
      return DEMO_MESSAGES.filter(m => m.guildId === guildId);
    }

    try {
      const response = await (client.models as unknown as Record<string, { list: (options: unknown) => Promise<{ errors?: { message: string }[]; data?: unknown }> }>).GuildMessage.list({
        filter: { guildId: { eq: guildId } }
      });

      if (response.errors) {
        throw new Error(`Failed to fetch messages: ${response.errors[0].message}`);
      }

      return response.data as unknown as GuildMessage[];
    } catch (error) {
      console.error('Error fetching alliance messages:', error);
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
    if (this.isDemoMode()) {
      // Demo mode: return mock subscription
      return {
        unsubscribe: () => console.log('Demo mode: Unsubscribed from messages')
      };
    }

    return (client.models as unknown as Record<string, { onCreate: (options: unknown) => { subscribe: (handlers: { next: (data: unknown) => void; error: (error: unknown) => void }) => { unsubscribe: () => void } } }>).GuildMessage.onCreate({
      filter: { guildId: { eq: guildId } }
    }).subscribe({
      next: (data: unknown) => {
        if (data) {
          onMessage(data as unknown as GuildMessage);
        }
      },
      error: (error: unknown) => {
        console.error('Alliance message subscription error:', error);
      }
    });
  }

  /**
   * Subscribe to alliance invitations
   */
  static subscribeToInvitations(
    kingdomId: string,
    onInvitation: (invitation: GuildInvitation) => void
  ) {
    if (this.isDemoMode()) {
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
