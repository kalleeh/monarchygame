/**
 * Alliance Service - Real-time alliance management
 * Handles alliance operations, invitations, and messaging
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

export interface AllianceData {
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
}

export interface AllianceInvitation {
  id: string;
  allianceId: string;
  targetKingdomId: string;
  targetKingdomName: string;
  invitedBy: string;
  inviterName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  message?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AllianceMessage {
  id: string;
  allianceId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  createdAt: string;
}

// Demo mode mock data
const DEMO_ALLIANCES: AllianceData[] = [
  {
    id: 'demo-alliance-1',
    name: 'The Iron Throne',
    description: 'A powerful alliance of strategic kingdoms',
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
    id: 'demo-alliance-2',
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

const DEMO_MESSAGES: AllianceMessage[] = [
  {
    id: 'demo-msg-1',
    allianceId: 'demo-alliance-1',
    senderId: 'demo-player-1',
    senderName: 'King Arthur',
    content: 'Welcome to our alliance! Let\'s coordinate our next attack.',
    messageType: 'CHAT',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'demo-msg-2',
    allianceId: 'demo-alliance-1',
    senderId: 'demo-player-3',
    senderName: 'Knight Lancelot',
    content: 'Ready for battle, my lord!',
    messageType: 'CHAT',
    createdAt: new Date(Date.now() - 1800000).toISOString()
  }
];

export class AllianceService {
  private static isDemoMode(): boolean {
    return localStorage.getItem('demo-mode') === 'true';
  }

  /**
   * Create a new alliance
   */
  static async createAlliance(data: {
    name: string;
    description?: string;
    tag: string;
    isPublic?: boolean;
    maxMembers?: number;
  }): Promise<AllianceData> {
    if (this.isDemoMode()) {
      // Demo mode: simulate alliance creation
      const newAlliance: AllianceData = {
        id: `demo-alliance-${Date.now()}`,
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
        tag: data.tag.toUpperCase(),
        leaderId: 'current-user-id', // Will be replaced with actual user ID
        leaderName: 'Current User', // Will be replaced with actual user name
        isPublic: data.isPublic ?? true,
        maxMembers: data.maxMembers ?? 20,
        memberCount: 1,
        totalPower: 0,
        createdAt: new Date().toISOString(),
      });

      if (response.errors) {
        throw new Error(`Failed to create alliance: ${response.errors[0].message}`);
      }

      return response.data as AllianceData;
    } catch (error) {
      console.error('Error creating alliance:', error);
      throw error;
    }
  }

  /**
   * Get all public alliances
   */
  static async getPublicAlliances(): Promise<AllianceData[]> {
    if (this.isDemoMode()) {
      // Demo mode: return mock data
      await new Promise(resolve => setTimeout(resolve, 300));
      return DEMO_ALLIANCES.filter(a => a.isPublic);
    }

    try {
      const response = await client.models.Alliance.list({
        filter: { isPublic: { eq: true } }
      });

      if (response.errors) {
        throw new Error(`Failed to fetch alliances: ${response.errors[0].message}`);
      }

      return response.data as AllianceData[];
    } catch (error) {
      console.error('Error fetching alliances:', error);
      throw error;
    }
  }

  /**
   * Join an alliance
   */
  static async joinAlliance(allianceId: string, kingdomId: string): Promise<void> {
    if (this.isDemoMode()) {
      // Demo mode: simulate joining
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Joined alliance', allianceId);
      return;
    }

    try {
      // Update kingdom with alliance ID
      const response = await client.models.Kingdom.update({
        id: kingdomId,
        allianceId: allianceId,
      });

      if (response.errors) {
        throw new Error(`Failed to join alliance: ${response.errors[0].message}`);
      }

      // Send system message to alliance
      await this.sendAllianceMessage({
        allianceId,
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
  static async leaveAlliance(kingdomId: string): Promise<void> {
    if (this.isDemoMode()) {
      // Demo mode: simulate leaving
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Demo mode: Left alliance');
      return;
    }

    try {
      const response = await client.models.Kingdom.update({
        id: kingdomId,
        allianceId: null,
      });

      if (response.errors) {
        throw new Error(`Failed to leave alliance: ${response.errors[0].message}`);
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
    allianceId: string;
    targetKingdomId: string;
    targetKingdomName: string;
    message?: string;
  }): Promise<AllianceInvitation> {
    if (this.isDemoMode()) {
      // Demo mode: simulate invitation
      const invitation: AllianceInvitation = {
        id: `demo-invite-${Date.now()}`,
        allianceId: data.allianceId,
        targetKingdomId: data.targetKingdomId,
        targetKingdomName: data.targetKingdomName,
        invitedBy: 'demo-player',
        inviterName: 'Demo Player',
        status: 'PENDING',
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

      const response = await client.models.AllianceInvitation.create({
        allianceId: data.allianceId,
        targetKingdomId: data.targetKingdomId,
        targetKingdomName: data.targetKingdomName,
        invitedBy: 'current-user-id',
        inviterName: 'Current User',
        status: 'PENDING',
        message: data.message,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      });

      if (response.errors) {
        throw new Error(`Failed to send invitation: ${response.errors[0].message}`);
      }

      return response.data as AllianceInvitation;
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
    response: 'ACCEPTED' | 'DECLINED'
  ): Promise<void> {
    try {
      const updateResponse = await client.models.AllianceInvitation.update({
        id: invitationId,
        status: response,
      });

      if (updateResponse.errors) {
        throw new Error(`Failed to respond to invitation: ${updateResponse.errors[0].message}`);
      }

      // If accepted, join the alliance
      if (response === 'ACCEPTED') {
        // Additional logic to join alliance would go here
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      throw error;
    }
  }

  /**
   * Send alliance message
   */
  static async sendAllianceMessage(data: {
    allianceId: string;
    content: string;
    messageType?: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  }): Promise<AllianceMessage> {
    if (this.isDemoMode()) {
      // Demo mode: simulate message sending
      const message: AllianceMessage = {
        id: `demo-msg-${Date.now()}`,
        allianceId: data.allianceId,
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
      const response = await client.models.AllianceMessage.create({
        allianceId: data.allianceId,
        senderId: 'current-user-id',
        senderName: 'Current User',
        content: data.content,
        messageType: data.messageType ?? 'CHAT',
        createdAt: new Date().toISOString(),
      });

      if (response.errors) {
        throw new Error(`Failed to send message: ${response.errors[0].message}`);
      }

      return response.data as AllianceMessage;
    } catch (error) {
      console.error('Error sending alliance message:', error);
      throw error;
    }
  }

  /**
   * Get alliance messages
   */
  static async getAllianceMessages(allianceId: string): Promise<AllianceMessage[]> {
    if (this.isDemoMode()) {
      // Demo mode: return mock messages
      await new Promise(resolve => setTimeout(resolve, 300));
      return DEMO_MESSAGES.filter(m => m.allianceId === allianceId);
    }

    try {
      const response = await client.models.AllianceMessage.list({
        filter: { allianceId: { eq: allianceId } }
      });

      if (response.errors) {
        throw new Error(`Failed to fetch messages: ${response.errors[0].message}`);
      }

      return response.data as AllianceMessage[];
    } catch (error) {
      console.error('Error fetching alliance messages:', error);
      throw error;
    }
  }

  /**
   * Subscribe to alliance messages for real-time updates
   */
  static subscribeToAllianceMessages(
    allianceId: string,
    onMessage: (message: AllianceMessage) => void
  ) {
    if (this.isDemoMode()) {
      // Demo mode: return mock subscription
      return {
        unsubscribe: () => console.log('Demo mode: Unsubscribed from messages')
      };
    }

    return client.models.AllianceMessage.onCreate({
      filter: { allianceId: { eq: allianceId } }
    }).subscribe({
      next: (data) => {
        if (data.data) {
          onMessage(data.data as AllianceMessage);
        }
      },
      error: (error) => {
        console.error('Alliance message subscription error:', error);
      }
    });
  }

  /**
   * Subscribe to alliance invitations
   */
  static subscribeToInvitations(
    kingdomId: string,
    onInvitation: (invitation: AllianceInvitation) => void
  ) {
    if (this.isDemoMode()) {
      // Demo mode: return mock subscription
      return {
        unsubscribe: () => console.log('Demo mode: Unsubscribed from invitations')
      };
    }

    return client.models.AllianceInvitation.onCreate({
      filter: { targetKingdomId: { eq: kingdomId } }
    }).subscribe({
      next: (data) => {
        if (data.data) {
          onInvitation(data.data as AllianceInvitation);
        }
      },
      error: (error) => {
        console.error('Alliance invitation subscription error:', error);
      }
    });
  }
}
