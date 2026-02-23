/* eslint-disable */
/**
 * Notification Center Component
 * Displays a bell icon with unread count badge, drops down a panel of CombatNotifications.
 * In auth mode: polls AppSync CombatNotification model every 30 seconds.
 * In demo mode: shows a single mock notification for visual purposes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { isDemoMode } from '../../utils/authMode';
import './NotificationCenter.css';

export interface NotificationCenterProps {
  kingdomId: string;
}

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt?: string | null;
}

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'demo-1',
    type: 'attack',
    message: 'Your kingdom was attacked! Repel the invaders and fortify your borders.',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ kingdomId }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Load notifications from AppSync (auth mode) or use demo data
  useEffect(() => {
    if (isDemoMode()) {
      setNotifications(DEMO_NOTIFICATIONS);
      return;
    }

    if (!kingdomId) return;

    const loadNotifications = async () => {
      try {
        const client = generateClient<Schema>();
        const { data } = await client.models.CombatNotification.list({
          filter: { recipientId: { eq: kingdomId } },
        });
        const items: NotificationItem[] = ((data || []) as any[]).map((n) => ({
          id: n.id as string,
          type: (n.type as string) || 'attack',
          message: (n.message as string) || '',
          isRead: Boolean(n.isRead),
          createdAt: (n.createdAt as string | null | undefined) ?? null,
        }));
        // Keep last 20, newest first
        setNotifications(items.slice(-20).reverse());
      } catch (err) {
        console.error('[NotificationCenter] Failed to load notifications:', err);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [kingdomId]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (notificationId: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );

    if (isDemoMode()) return;

    try {
      const client = generateClient<Schema>();
      await client.models.CombatNotification.update({ id: notificationId, isRead: true });
    } catch (err) {
      console.error('[NotificationCenter] Failed to mark notification as read:', err);
      // Revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: false } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    if (isDemoMode()) return;

    try {
      const client = generateClient<Schema>();
      await Promise.all(
        unread.map((n) =>
          client.models.CombatNotification.update({ id: n.id, isRead: true })
        )
      );
    } catch (err) {
      console.error('[NotificationCenter] Failed to mark all as read:', err);
    }
  };

  const formatTime = (createdAt: string | null | undefined): string => {
    if (!createdAt) return '';
    try {
      return new Date(createdAt).toLocaleString();
    } catch {
      return '';
    }
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      attack: 'Attack',
      defense: 'Defense',
      victory: 'Victory',
      defeat: 'Defeat',
      alliance: 'Alliance',
      trade: 'Trade',
    };
    return labels[type] || type;
  };

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        className="notification-bell"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        <span className="notification-bell-icon" aria-hidden="true">
          {'\uD83D\uDD14'}
        </span>
        {unreadCount > 0 && (
          <span className="notification-badge" aria-label={`${unreadCount} unread`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel" role="dialog" aria-label="Notification panel">
          <div className="notification-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="no-notifications">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notification-item${!n.isRead ? ' unread' : ''}`}
                >
                  <div className="notification-item-header">
                    <span className={`notification-type notification-type--${n.type}`}>
                      {getTypeLabel(n.type)}
                    </span>
                    {!n.isRead && (
                      <button
                        className="mark-read-btn"
                        onClick={() => markAsRead(n.id)}
                        aria-label="Mark as read"
                        title="Mark as read"
                      >
                        {'\u2713'}
                      </button>
                    )}
                  </div>
                  <p className="notification-message">{n.message}</p>
                  {n.createdAt && (
                    <span className="notification-time">{formatTime(n.createdAt)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
