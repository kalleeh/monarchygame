/**
 * useRealtimeNotifications Hook
 * Subscribes to CombatNotification model for real-time combat alerts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface Notification {
  id: string;
  type: string;
  message: string;
  data: unknown;
  isRead: boolean;
  createdAt: string;
}

export function useRealtimeNotifications(kingdomId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    if (!kingdomId) return;

    const sub = client.models.CombatNotification.observeQuery({
      filter: { recipientId: { eq: kingdomId } }
    }).subscribe({
      next: ({ items }) => {
        const mapped = items.map(item => ({
          id: item.id,
          type: (item.type as string) || 'unknown',
          message: item.message,
          data: item.data,
          isRead: item.isRead ?? false,
          createdAt: item.createdAt || new Date().toISOString(),
        }));
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(mapped);
        setUnreadCount(mapped.filter(n => !n.isRead).length);
      },
      error: (err) => {
        console.error('Notification subscription error:', err);
      }
    });

    subscriptionRef.current = sub;

    return () => {
      sub.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [kingdomId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await client.models.CombatNotification.update({
        id: notificationId,
        isRead: true,
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.isRead);
    await Promise.allSettled(
      unread.map(n => client.models.CombatNotification.update({ id: n.id, isRead: true }))
    );
  }, [notifications]);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
