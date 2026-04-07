/**
 * SVG icon library for the Monarchy Game.
 * All icons scale with surrounding text (1em) and use currentColor.
 */
import React from 'react';

const s: React.CSSProperties = { width: '1em', height: '1em', flexShrink: 0 };
const svgProps = { fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

// ─── Menu Group Icons (existing) ────────────────────────────────────────────

/** Castle tower — Kingdom group */
export const KingdomIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M3 21h18M4 21V10l4-4v-3h2v2l2-2 2 2v-2h2v3l4 4v11" />
    <rect x="9" y="14" width="6" height="7" rx="1" />
    <line x1="12" y1="10" x2="12" y2="12" />
  </svg>
);

/** Crossed swords — Warfare group */
export const WarfareIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
    <path d="M13 19l6-6M16 16l4 4" />
    <path d="M9.5 17.5L21 6V3h-3L6.5 14.5" />
    <path d="M11 19l-6-6M8 16l-4 4" />
  </svg>
);

/** Handshake — Social group */
export const SocialIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M20 11H4a2 2 0 00-2 2v1a2 2 0 002 2h2l3 3 3-3h8a2 2 0 002-2v-1a2 2 0 00-2-2z" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

/** Crosshair target — Bounty Board */
export const BountyIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

/** Altar — Faith & Focus */
export const FaithIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 2L9 9h6L12 2z" />
    <path d="M12 9v6" />
    <path d="M8 15c0 2.2 1.8 4 4 4s4-1.8 4-4" />
    <path d="M6 19h12M4 22h16" />
  </svg>
);

/** Hooded figure — Espionage */
export const EspionageIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 2C8 2 5 5 5 8c0 2 1 3.5 2 4.5V14l5 3 5-3v-1.5c1-1 2-2.5 2-4.5 0-3-3-6-7-6z" />
    <circle cx="9.5" cy="9" r="1" fill="currentColor" />
    <circle cx="14.5" cy="9" r="1" fill="currentColor" />
    <path d="M8 20h8M10 22h4" />
  </svg>
);

/** Trophy — Leaderboard */
export const LeaderboardIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M6 9H3V5a1 1 0 011-1h2" />
    <path d="M18 9h3V5a1 1 0 00-1-1h-2" />
    <rect x="6" y="3" width="12" height="10" rx="2" />
    <path d="M12 13v4M8 21h8M10 17h4" />
    <circle cx="12" cy="8" r="2" />
  </svg>
);

// ─── Navigation / Feature Icons (PNG replacements) ──────────────────────────

/** Map with flag — Territories */
export const TerritoriesIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M3 3l6 3 6-3 6 3v15l-6-3-6 3-6-3V3z" />
    <path d="M9 6v15M15 3v15" />
  </svg>
);

/** Hammer and building — Buildings */
export const BuildingsIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <rect x="3" y="11" width="7" height="10" rx="1" />
    <path d="M6.5 7v4M5 7h3" />
    <rect x="14" y="8" width="7" height="13" rx="1" />
    <path d="M16 12h3M16 15h3M16 18h3" />
    <path d="M14 8l3.5-4L21 8" />
  </svg>
);

/** Globe — World Map */
export const WorldMapIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
  </svg>
);

/** Sword and shield — Combat */
export const CombatIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M4 16l4-4 4 4-4 4z" />
    <path d="M14.5 3L20 3v5.5L12.5 16l-3-3L17 5.5" />
    <path d="M17 7l3-3" />
  </svg>
);

/** Soldier figure — Train Units */
export const TrainUnitsIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="5" r="3" />
    <path d="M8 21v-6a4 4 0 018 0v6" />
    <path d="M12 11v4" />
    <path d="M7 14h10" />
  </svg>
);

/** Wand with sparkles — Magic Spells */
export const MagicSpellsIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M15 4l-11 11 4 4 11-11z" />
    <path d="M18 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
    <path d="M4 20l2-2" />
  </svg>
);

/** Scroll with sword — Battle Reports */
export const BattleReportsIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h10l4-4V5a2 2 0 00-2-2H5z" />
    <path d="M15 17v4l4-4h-4z" />
    <path d="M8 8h6M8 12h4" />
  </svg>
);

/** Two shields — Alliance */
export const AllianceIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M5 3c0 7 3 11 5 13-2-2-5-6-5-13z" />
    <path d="M3 3h9s0 8-4.5 14C3 11 3 3 3 3z" />
    <path d="M19 3c0 7-3 11-5 13 2-2 5-6 5-13z" />
    <path d="M12 3h9s0 8-4.5 14C12 11 12 3 12 3z" />
  </svg>
);

/** Balance scales — Trade */
export const TradeIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 3v18" />
    <path d="M8 21h8" />
    <path d="M4 7l8-4 8 4" />
    <path d="M2 11l4-4 4 4" />
    <path d="M2 11a4 4 0 008 0" />
    <path d="M14 11l4-4 4 4" />
    <path d="M14 11a4 4 0 008 0" />
  </svg>
);

/** Dove — Diplomacy */
export const DiplomacyIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 8c-3 0-6 2-6 5s3 5 6 5 6-2 6-5-3-5-6-5z" />
    <path d="M12 8V3l4 3-4 2z" />
    <path d="M6 13l-3 2M18 13l3 2" />
    <path d="M9 21h6" />
  </svg>
);

/** Star medal — Achievements */
export const AchievementsIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="9" r="6" />
    <path d="M12 3l1.5 3 3.5.5-2.5 2.5.5 3.5L12 11l-3 1.5.5-3.5L7 6.5 10.5 6z" />
    <path d="M8 15l-2 7 6-3 6 3-2-7" />
  </svg>
);

// ─── Resource Icons ─────────────────────────────────────────────────────────

/** Gold coin */
export const GoldIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M9 9.5h4.5a2 2 0 010 4H9.5h4a2 2 0 010 0" />
  </svg>
);

/** People group — Population */
export const PopulationIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="9" cy="7" r="3" />
    <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
    <circle cx="17" cy="8" r="2.5" />
    <path d="M21 21v-1.5a3.5 3.5 0 00-3-3.5" />
  </svg>
);

/** Mountain — Land */
export const LandIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M2 20L8.5 7l4 7 3.5-4L22 20H2z" />
    <path d="M14 10l-1.5 2.5" />
  </svg>
);

/** Hourglass — Turns */
export const TurnsIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M6 2h12M6 22h12" />
    <path d="M7 2v4a5 5 0 005 5 5 5 0 005-5V2" />
    <path d="M7 22v-4a5 5 0 015-5 5 5 0 015 5v4" />
  </svg>
);

/** Flame — Élan */
export const ElanIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 22c-4 0-7-3-7-7 0-5 7-13 7-13s7 8 7 13c0 4-3 7-7 7z" />
    <path d="M12 22c-1.5 0-3-1.5-3-3.5 0-2.5 3-6.5 3-6.5s3 4 3 6.5c0 2-1.5 3.5-3 3.5z" />
  </svg>
);

// ─── Battle Result Icons ────────────────────────────────────────────────────

/** Raised sword — Victory */
export const VictoryIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 2l1 10h-2L12 2z" />
    <path d="M8 12h8" />
    <path d="M10 14v3l2 5 2-5v-3" />
  </svg>
);

/** Broken shield — Defeat */
export const DefeatIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M5 3h14s0 8-7 16c-7-8-7-16-7-16z" />
    <path d="M10 3l2 8-2 8" />
  </svg>
);

// ─── UI Utility Icons ───────────────────────────────────────────────────────

/** Padlock — Lock */
export const LockIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

/** Wagon — Settlers */
export const SettlersIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M3 14h14V8H7L3 14z" />
    <path d="M3 14l2 3h12l2-3" />
    <circle cx="7" cy="19" r="2" />
    <circle cx="15" cy="19" r="2" />
    <path d="M17 8c0-3-2-5-5-5" />
  </svg>
);

/** Arrow up in circle — Upgrade */
export const UpgradeIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16V8M8 12l4-4 4 4" />
  </svg>
);

/** Exclamation triangle — Warning */
export const WarningIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 2L2 20h20L12 2z" />
    <path d="M12 9v5M12 17h.01" />
  </svg>
);

/** i in circle — Info */
export const InfoIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

/** Royal crown */
export const CrownIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M2 17l3-10 4 5 3-8 3 8 4-5 3 10H2z" />
    <path d="M2 17h20v3H2z" />
  </svg>
);

/** Parchment scroll */
export const ScrollIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M8 3H6a2 2 0 00-2 2v14a2 2 0 002 2h2" />
    <path d="M16 3h2a2 2 0 012 2v14a2 2 0 01-2 2h-2" />
    <rect x="8" y="2" width="8" height="20" rx="1" />
    <path d="M10 8h4M10 12h4M10 16h2" />
  </svg>
);

/** Single shield — Defense */
export const ShieldIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 2l8 4v5c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z" />
  </svg>
);

/** Single sword — Offense */
export const SwordIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M14.5 3L21 3v6.5L12 18.5l-2-2L18.5 8" />
    <path d="M10 16.5L4 22.5" />
    <path d="M7.5 17.5l-3 .5.5-3" />
  </svg>
);

/** 5-point star */
export const StarIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
  </svg>
);

/** Eye — Spy/Thievery */
export const SpyIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/** Heart with plus — Heal */
export const HealIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 21C12 21 4 14 4 8.5A4.5 4.5 0 0112 5a4.5 4.5 0 018 3.5C20 14 12 21 12 21z" />
    <path d="M12 10v4M10 12h4" />
  </svg>
);

// ─── Age / Season Icons ─────────────────────────────────────────────────────

/** Flame — Fire / Late Age */
export const FireIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 22c-4 0-7-3-7-7 0-5 7-13 7-13s7 8 7 13c0 4-3 7-7 7z" />
    <path d="M10 17c0 1.1.9 2 2 2s2-.9 2-2c0-2-2-4-2-4s-2 2-2 4z" />
  </svg>
);

/** Sprout — Seedling / Early Age */
export const SeedlingIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 22V10" />
    <path d="M6 10c0-4 6-8 6-8s6 4 6 8c0 0-3-2-6-2s-6 2-6 2z" />
    <path d="M8 22c0-3 2-5 4-5s4 2 4 5" />
  </svg>
);

/** Lightning bolt — Middle Age */
export const BoltIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

// ─── Misc Game Icons ────────────────────────────────────────────────────────

/** Trophy cup — Leaderboard entries */
export const TrophyIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M6 9H3V5a1 1 0 011-1h2M18 9h3V5a1 1 0 00-1-1h-2" />
    <rect x="6" y="3" width="12" height="10" rx="2" />
    <path d="M12 13v4M8 21h8M10 17h4" />
  </svg>
);

/** Banner — Guild */
export const GuildIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M5 2v20" />
    <path d="M5 2h14l-4 5 4 5H5" />
  </svg>
);

/** Treasure chest — Loot */
export const ChestIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <rect x="3" y="11" width="18" height="9" rx="1" />
    <path d="M3 11l2-6h14l2 6" />
    <path d="M12 11v4" />
    <circle cx="12" cy="15" r="1.5" />
    <path d="M7 5v6M17 5v6" />
  </svg>
);

/** Skull — Casualties */
export const SkullIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M12 2C7.6 2 4 5.6 4 10c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7 0-4.4-3.6-8-8-8z" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
    <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    <path d="M10 20v2M14 20v2" />
    <path d="M9.5 15c1 1 4 1 5 0" />
  </svg>
);

/** Blacksmith hammer — Building */
export const HammerIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M10 12L3 19l2 2 7-7" />
    <path d="M10 12l2-2 6-1 3-3-4-4-3 3-1 6-2 2" />
  </svg>
);

/** Open book — Help/Tutorial */
export const BookIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <path d="M2 4h8c1.1 0 2 .9 2 2v14c-1-1-2.5-1-4-1H2V4z" />
    <path d="M22 4h-8c-1.1 0-2 .9-2 2v14c1-1 2.5-1 4-1h6V4z" />
  </svg>
);

/** Compass rose — Exploration */
export const CompassIcon = () => (
  <svg style={s} viewBox="0 0 24 24" {...svgProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
  </svg>
);

/* ── Terrain icons ─────────────────────────────────────────────────── */

/** Wheat/grain — Plains */
export const PlainsIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V10" /><path d="M8 10c0-3 2-6 4-8 2 2 4 5 4 8" /><path d="M6 14c2-1 4 0 6 2 2-2 4-3 6-2" />
  </svg>
);

/** Pine tree — Forest */
export const ForestIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3L6 13h4l-2 4h8l-2-4h4L12 3z" /><line x1="12" y1="17" x2="12" y2="22" />
  </svg>
);

/** Mountain peak — Mountains */
export const MountainIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20L8 8l4 6 4-10 6 16H2z" />
  </svg>
);

/** Reeds/marsh — Swamp */
export const SwampIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22v-6c0-2 2-4 3-5" /><path d="M12 22v-8c0-2 2-4 3-5" /><path d="M18 22v-6c0-2-2-4-3-5" />
    <path d="M3 18c3-1 6 0 9 0s6-1 9 0" />
  </svg>
);

/** Sand dune — Desert */
export const DesertIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 18c4-4 8-2 10 0s6-4 10 0" /><circle cx="18" cy="6" r="3" /><path d="M2 22h20" />
  </svg>
);

/** Wave — Coastal */
export const CoastalIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  </svg>
);

/** Robot/gear — AI kingdom */
export const AIBotIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="8" width="14" height="12" rx="2" /><circle cx="9" cy="14" r="1.5" fill="currentColor" /><circle cx="15" cy="14" r="1.5" fill="currentColor" />
    <line x1="12" y1="4" x2="12" y2="8" /><circle cx="12" cy="3" r="1" />
  </svg>
);

/* ── Race icons ────────────────────────────────────────────────────── */

/** Human silhouette */
export const RaceHumanIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0114 0v2" />
  </svg>
);

/** Pointed ears — Elven */
export const RaceElvenIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="10" r="4" /><path d="M7 6L4 2" /><path d="M17 6l3-4" /><path d="M6 21v-2a6 6 0 0112 0v2" />
  </svg>
);

/** Horned face — Goblin */
export const RaceGoblinIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="10" r="5" /><path d="M7 5L5 2" /><path d="M17 5l2-3" /><path d="M10 12h4" /><path d="M6 21v-2a6 6 0 0112 0v2" />
  </svg>
);

/** Dragon head — Droben */
export const RaceDrobenIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c-3 0-6 3-6 7 0 3 2 5 4 6v5h4v-5c2-1 4-3 4-6 0-4-3-7-6-7z" /><path d="M6 8L3 5" /><path d="M18 8l3-3" /><circle cx="10" cy="10" r="1" fill="currentColor" /><circle cx="14" cy="10" r="1" fill="currentColor" />
  </svg>
);

/** Fangs — Vampire */
export const RaceVampireIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="9" r="5" /><path d="M10 14l-1 3" /><path d="M14 14l1 3" /><path d="M6 21v-2a6 6 0 0112 0v2" />
  </svg>
);

/** Flame — Elemental */
export const RaceElementalIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c-4 6-7 9-7 13a7 7 0 0014 0c0-4-3-7-7-13z" /><path d="M12 12c-1 2-2 3-2 5a2 2 0 004 0c0-2-1-3-2-5z" />
  </svg>
);

/** Horse body — Centaur */
export const RaceCentaurIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5" r="3" /><path d="M8 8v4l6 1 4-3" /><path d="M14 13l-2 9" /><path d="M18 10l2 12" /><path d="M6 12l-2 10" />
  </svg>
);

/** Fairy wings — Sidhe */
export const RaceSidheIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3" /><path d="M12 11v6" /><path d="M8 8c-3-2-5 0-5 3s3 3 5 1" /><path d="M16 8c3-2 5 0 5 3s-3 3-5 1" /><path d="M10 22h4" />
  </svg>
);

/** Helmet with beard — Dwarven */
export const RaceDwarvenIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 10a6 6 0 0112 0" /><rect x="6" y="10" width="12" height="5" rx="1" /><path d="M9 15v4" /><path d="M12 15v5" /><path d="M15 15v4" /><line x1="6" y1="7" x2="18" y2="7" />
  </svg>
);

/** Sparkle wings — Fae */
export const RaceFaeIcon = () => (
  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="9" r="3" /><path d="M12 12v5" /><path d="M7 7c-2-3-1-5 1-5s3 3 4 5" /><path d="M17 7c2-3 1-5-1-5s-3 3-4 5" /><path d="M9 22l3-5 3 5" />
  </svg>
);
