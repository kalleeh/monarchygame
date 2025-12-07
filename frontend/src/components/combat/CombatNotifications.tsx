/**
 * Combat Notifications Component
 * Display and manage combat-related notifications and alerts
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { CombatNotification } from '../../types/combat';

interface CombatNotificationsProps {
  notifications: CombatNotification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  className?: string;
}

type FilterType = 'all' | 'unread' | 'incoming' | 'results';

export const CombatNotifications: React.FC<CombatNotificationsProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  className = ''
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedNotification, setSelectedNotification] = useState<CombatNotification | null>(null);

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    switch (filter) {
      case 'unread':
        filtered = filtered.filter(n => !n.isRead);
        break;
      case 'incoming':
        filtered = filtered.filter(n => n.type === 'incoming_attack');
        break;
      case 'results':
        filtered = filtered.filter(n => n.type === 'attack_result' || n.type === 'defense_result');
        break;
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [notifications, filter]);

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.isRead).length
  , [notifications]);

  const handleNotificationClick = useCallback((notification: CombatNotification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    setSelectedNotification(notification);
  }, [onMarkAsRead]);

  const formatTimeAgo = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }, []);

  const formatTimeRemaining = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Arrived';
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    } else {
      return `${diffMins}m`;
    }
  }, []);

  const getNotificationIcon = useCallback((type: CombatNotification['type']): string => {
    switch (type) {
      case 'incoming_attack':
        return '⚠️';
      case 'attack_result':
        return '⚔️';
      case 'defense_result':
        return '🛡️';
      default:
        return '📢';
    }
  }, []);

  const getNotificationColor = useCallback((type: CombatNotification['type'], isRead: boolean): string => {
    if (isRead) return '#6b7280';
    
    switch (type) {
      case 'incoming_attack':
        return '#ef4444';
      case 'attack_result':
        return '#f59e0b';
      case 'defense_result':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  }, []);

  const getPriorityLevel = useCallback((notification: CombatNotification): 'high' | 'medium' | 'low' => {
    if (notification.type === 'incoming_attack') {
      if (notification.estimatedArrival) {
        const timeRemaining = notification.estimatedArrival.getTime() - Date.now();
        if (timeRemaining <= 300000) return 'high'; // 5 minutes or less
        if (timeRemaining <= 1800000) return 'medium'; // 30 minutes or less
      }
      return 'medium';
    }
    return 'low';
  }, []);

  if (selectedNotification) {
    return (
      <div className={`combat-notifications detailed-view ${className}`}>
        <div className="notification-header">
          <button
            type="button"
            className="back-button"
            onClick={() => setSelectedNotification(null)}
            aria-label="Back to notifications"
          >
            ← Back to Notifications
          </button>
          <h3>Notification Details</h3>
        </div>

        <div className="detailed-notification">
          <div className="notification-summary">
            <div className="notification-type">
              <span className="type-icon">{getNotificationIcon(selectedNotification.type)}</span>
              <span className="type-label">
                {selectedNotification.type.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            <div className="notification-time">
              <span className="time-label">Received:</span>
              <span className="time-value">{selectedNotification.timestamp.toLocaleString()}</span>
            </div>
          </div>

          <div className="notification-content">
            <h4>{selectedNotification.message}</h4>
            
            {selectedNotification.type === 'incoming_attack' && selectedNotification.estimatedArrival && (
              <div className="attack-details">
                <div className="detail-item">
                  <span className="detail-label">Attacker:</span>
                  <span className="detail-value">{selectedNotification.kingdomName}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Attack Type:</span>
                  <span className="detail-value">
                    {selectedNotification.attackType?.replace('_', ' ') || 'Unknown'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Estimated Arrival:</span>
                  <span className="detail-value">
                    {formatTimeRemaining(selectedNotification.estimatedArrival)}
                  </span>
                </div>
              </div>
            )}

            {selectedNotification.result && (
              <div className="battle-result">
                <h5>Battle Result</h5>
                <div className="result-summary">
                  <div className="result-item">
                    <span className="result-label">Outcome:</span>
                    <span className={`result-value ${selectedNotification.result.success ? 'success' : 'failure'}`}>
                      {selectedNotification.result.success ? 'Victory' : 'Defeat'}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Spoils:</span>
                    <span className="result-value">
                      {selectedNotification.result.spoils?.gold?.toLocaleString() ?? 0} gold, {' '}
                      {selectedNotification.result.spoils?.land ?? 0} land
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`combat-notifications ${className}`}>
      <div className="notifications-header">
        <h3>Combat Alerts</h3>
        <div className="header-actions">
          <span className="unread-count">
            {unreadCount > 0 && `${unreadCount} unread`}
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="mark-all-read"
              onClick={onMarkAllAsRead}
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      <div className="notifications-controls">
        <div className="filter-tabs">
          <button
            type="button"
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'incoming' ? 'active' : ''}`}
            onClick={() => setFilter('incoming')}
          >
            Incoming ({notifications.filter(n => n.type === 'incoming_attack').length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'results' ? 'active' : ''}`}
            onClick={() => setFilter('results')}
          >
            Results ({notifications.filter(n => n.type.includes('result')).length})
          </button>
        </div>
      </div>

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            <span className="no-notifications-icon">🔔</span>
            <span className="no-notifications-text">
              {filter === 'all' 
                ? 'No notifications available' 
                : `No ${filter} notifications`}
            </span>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const priority = getPriorityLevel(notification);
            const color = getNotificationColor(notification.type, notification.isRead ?? false);
            
            return (
              <div
                key={notification.id}
                className={`notification-item ${notification.isRead ? 'read' : 'unread'} priority-${priority}`}
                onClick={() => handleNotificationClick(notification)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleNotificationClick(notification);
                  }
                }}
              >
                <div className="notification-indicator" style={{ backgroundColor: color }} />
                
                <div className="notification-content">
                  <div className="notification-header">
                    <div className="notification-type">
                      <span className="type-icon">{getNotificationIcon(notification.type)}</span>
                      <span className="kingdom-name">{notification.kingdomName}</span>
                    </div>
                    <div className="notification-time">
                      <span className="time-ago">{formatTimeAgo(notification.timestamp)}</span>
                      {!notification.isRead && <span className="unread-dot" />}
                    </div>
                  </div>
                  
                  <div className="notification-message">
                    {notification.message}
                  </div>
                  
                  {notification.type === 'incoming_attack' && notification.estimatedArrival && (
                    <div className="notification-details">
                      <div className="attack-info">
                        <span className="attack-type">
                          {notification.attackType?.replace('_', ' ') || 'Unknown'} attack
                        </span>
                        <span className="arrival-time">
                          Arrives in {formatTimeRemaining(notification.estimatedArrival)}
                        </span>
                      </div>
                      {priority === 'high' && (
                        <div className="urgent-warning">
                          <span className="warning-icon">🚨</span>
                          <span className="warning-text">URGENT - Imminent Attack!</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {notification.result && (
                    <div className="notification-details">
                      <div className="result-preview">
                        <span className={`result-outcome ${notification.result.success ? 'victory' : 'defeat'}`}>
                          {notification.result.success ? '🏆 Victory' : '💀 Defeat'}
                        </span>
                        {notification.result.success && (
                          <span className="result-spoils">
                            +{notification.result.spoils?.gold?.toLocaleString() ?? 0} gold
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="notification-actions">
                  <button
                    type="button"
                    className="view-details"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotificationClick(notification);
                    }}
                    aria-label="View details"
                  >
                    →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CombatNotifications;
