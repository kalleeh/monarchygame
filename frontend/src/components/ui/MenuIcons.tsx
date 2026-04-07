/**
 * SVG menu icons for KingdomActionBar.
 * Crisp at any size, no image loading required.
 */
import React from 'react';

const s: React.CSSProperties = { width: '1.5rem', height: '1.5rem', flexShrink: 0 };

/** Castle tower — Kingdom group */
export const KingdomIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M4 21V10l4-4v-3h2v2l2-2 2 2v-2h2v3l4 4v11" />
    <rect x="9" y="14" width="6" height="7" rx="1" />
    <line x1="12" y1="10" x2="12" y2="12" />
  </svg>
);

/** Crossed swords — Warfare group */
export const WarfareIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
    <path d="M13 19l6-6" />
    <path d="M16 16l4 4" />
    <path d="M9.5 17.5L21 6V3h-3L6.5 14.5" />
    <path d="M11 19l-6-6" />
    <path d="M8 16l-4 4" />
  </svg>
);

/** Handshake — Social group */
export const SocialIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11H4a2 2 0 00-2 2v1a2 2 0 002 2h2l3 3 3-3h8a2 2 0 002-2v-1a2 2 0 00-2-2z" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

/** Crosshair target — Bounty Board */
export const BountyIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

/** Praying hands / altar — Faith & Focus */
export const FaithIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9 9h6L12 2z" />
    <path d="M12 9v6" />
    <path d="M8 15c0 2.2 1.8 4 4 4s4-1.8 4-4" />
    <path d="M6 19h12" />
    <path d="M4 22h16" />
  </svg>
);

/** Hooded figure — Espionage */
export const EspionageIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C8 2 5 5 5 8c0 2 1 3.5 2 4.5V14l5 3 5-3v-1.5c1-1 2-2.5 2-4.5 0-3-3-6-7-6z" />
    <circle cx="9.5" cy="9" r="1" fill="currentColor" />
    <circle cx="14.5" cy="9" r="1" fill="currentColor" />
    <path d="M8 20h8" />
    <path d="M10 22h4" />
  </svg>
);

/** Trophy / scroll — Kingdom Scrolls (Leaderboard) */
export const LeaderboardIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H3V5a1 1 0 011-1h2" />
    <path d="M18 9h3V5a1 1 0 00-1-1h-2" />
    <rect x="6" y="3" width="12" height="10" rx="2" />
    <path d="M12 13v4" />
    <path d="M8 21h8" />
    <path d="M10 17h4" />
    <circle cx="12" cy="8" r="2" />
  </svg>
);
