/**
 * AdminDashboard — Dark-fantasy styled admin panel for the Monarchy Game.
 * Guarded by VITE_ADMIN_EMAILS env var (comma-separated) or demo mode.
 *
 * The individual panels live in ./panels/* and shared helpers in ./adminShared.
 */

import { useState, useEffect } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { isDemoMode } from '../../utils/authMode';
import { ActiveSeasonPanel } from './panels/ActiveSeasonPanel';
import { KingdomOverviewPanel } from './panels/KingdomOverviewPanel';
import { KingdomManagementPanel } from './panels/KingdomManagementPanel';
import { TurnManagementPanel } from './panels/TurnManagementPanel';
import { SeasonHistoryPanel } from './panels/SeasonHistoryPanel';
import './AdminDashboard.css';

export default function AdminDashboard() {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');

  useEffect(() => {
    const demo = isDemoMode();
    if (demo) {
      setIsAdmin(true);
      setCurrentEmail('demo@demo');
      setAuthChecked(true);
      return;
    }
    fetchUserAttributes()
      .then((attrs) => {
        const email = attrs.email || '';
        setCurrentEmail(email);
        const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
          .split(',')
          .map((e: string) => e.trim())
          .filter(Boolean);
        setIsAdmin(adminEmails.includes(email));
        setAuthChecked(true);
      })
      .catch(() => {
        setIsAdmin(false);
        setAuthChecked(true);
      });
  }, []);

  if (!authChecked) {
    return (
      <div className="admin-page">
        <div className="admin-loading">Verifying credentials…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-access-denied">
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
          <p className="admin-access-email">{currentEmail || 'Not signed in'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1 className="admin-title">
          <span className="admin-title-icon">⚙</span>
          Monarchy Admin
        </h1>
        {isDemoMode() && (
          <span className="admin-demo-badge">Demo Mode — changes won't persist</span>
        )}
      </header>

      <div className="admin-panels">
        <ActiveSeasonPanel />
        <KingdomOverviewPanel />
        <KingdomManagementPanel />
        <TurnManagementPanel />
        <SeasonHistoryPanel />
      </div>
    </div>
  );
}
