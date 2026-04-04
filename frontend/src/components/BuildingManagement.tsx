/**
 * Building Management Component
 * Allows players to construct buildings on their land.
 * Uses the building-constructor Lambda via BuildingService.
 *
 * Valid building types (from handler.ts): castle, barracks, farm, mine, temple, tower, wall
 * Cost: 250 gold per building, 1 turn per construction action.
 */

import React, { useState, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { useKingdomStore } from '../stores/kingdomStore';
import { TopNavigation } from './TopNavigation';
import { constructBuildings } from '../services/domain/BuildingService';
import { refreshKingdomResources } from '../services/domain/CombatService';
import { ToastService } from '../services/toastService';
import { getBuildingName, getBuildingImage } from '../utils/buildingMechanics';
import { isDemoMode } from '../utils/authMode';
import './BuildingManagement.css';

let _amplifyClient: ReturnType<typeof generateClient<Schema>> | null = null;
const getAmplifyClient = () => { if (!_amplifyClient) _amplifyClient = generateClient<Schema>(); return _amplifyClient; };

interface BuildingManagementProps {
  kingdomId: string;
  race: string;
  onBack: () => void;
}

interface BuildingDef {
  id: 'castle' | 'barracks' | 'farm' | 'mine' | 'temple' | 'tower' | 'wall';
  category: string;
  description: string;
  effect: string;
  goldCost: number;
}

// Lambda accepts exactly these building types
const BUILDING_DEFS: BuildingDef[] = [
  {
    id: 'mine',
    category: 'buildrate',
    description: 'Increases your build rate (BRT), allowing faster construction.',
    effect: '+BRT per turn',
    goldCost: 250,
  },
  {
    id: 'farm',
    category: 'peasant',
    description: 'Houses the peasant population and boosts food production.',
    effect: '+Population growth',
    goldCost: 250,
  },
  {
    id: 'barracks',
    category: 'troop',
    description: 'Trains soldiers and lowers unit upkeep costs.',
    effect: '+Training rate',
    goldCost: 250,
  },
  {
    id: 'tower',
    category: 'income',
    description: 'Generates tax revenue for your kingdom.',
    effect: '+Gold income',
    goldCost: 250,
  },
  {
    id: 'temple',
    category: 'magic',
    description: 'Boosts magical power and elan generation.',
    effect: '+Elan/mana',
    goldCost: 250,
  },
  {
    id: 'wall',
    category: 'fortress',
    description: 'Defensive fortifications protecting your kingdom from attacks.',
    effect: '+Defense bonus',
    goldCost: 250,
  },
  {
    id: 'castle',
    category: 'castle',
    description: 'A grand castle — prestige structure providing defense and leadership.',
    effect: '+Defense + prestige',
    goldCost: 250,
  },
];

const GOLD_PER_BUILDING = 250;

export default function BuildingManagement({
  kingdomId,
  race,
  onBack,
}: BuildingManagementProps) {
  const resources = useKingdomStore((state) => state.resources);
  const addGold = useKingdomStore((state) => state.addGold);
  const addTurns = useKingdomStore((state) => state.addTurns);

  // Store the raw kingdom buildings so we can display current counts
  const [kingdomBuildings, setKingdomBuildings] = useState<Record<string, number>>({});

  // Load initial building counts — from Amplify in auth mode, localStorage in demo mode
  React.useEffect(() => {
    let cancelled = false;

    const loadBuildings = async () => {
      // Helper: parse buildings from a stored localStorage entry
      const getLocalBuildings = (): Record<string, number> => {
        const stored = localStorage.getItem(`kingdom-${kingdomId}`);
        if (!stored) return {};
        try {
          const data = JSON.parse(stored) as Record<string, unknown>;
          const b = data.buildings;
          if (!b) return {};
          return typeof b === 'string' ? (JSON.parse(b) as Record<string, number>) : (b as Record<string, number>);
        } catch {
          return {};
        }
      };

      if (isDemoMode()) {
        setKingdomBuildings(getLocalBuildings());
        return;
      }

      // Auth mode: fetch from Amplify, fall back to localStorage
      try {
        const result = await getAmplifyClient().models.Kingdom.get({ id: kingdomId });
        if (cancelled) return;
        if (result.data?.buildings) {
          const raw = result.data.buildings;
          const parsed: Record<string, number> =
            typeof raw === 'string' ? (JSON.parse(raw) as Record<string, number>) : (raw as Record<string, number>);
          setKingdomBuildings(parsed);
        } else {
          setKingdomBuildings(getLocalBuildings());
        }
      } catch (err) {
        console.warn('[BuildingManagement] Failed to load buildings from server, using local cache:', err);
        if (!cancelled) setKingdomBuildings(getLocalBuildings());
      }
    };

    void loadBuildings();
    return () => { cancelled = true; };
  }, [kingdomId]);

  // Per-building loading state
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  // Quantity selectors per building
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(BUILDING_DEFS.map((b) => [b.id, 1]))
  );

  const gold = resources.gold ?? 0;
  const turns = resources.turns ?? 0;

  const handleQuantityChange = useCallback((buildingId: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [buildingId]: Math.max(1, Math.min(1000, value)),
    }));
  }, []);

  const handleBuild = useCallback(
    async (building: BuildingDef) => {
      if (loading[building.id]) return;
      const quantity = quantities[building.id] ?? 1;
      const totalCost = quantity * GOLD_PER_BUILDING;

      if (gold < totalCost) {
        ToastService.error(
          `Not enough gold. Need ${totalCost.toLocaleString()} gold to build ${quantity} ${getBuildingName(race, building.category)}.`
        );
        return;
      }
      if (turns < 1) {
        ToastService.error('Not enough turns to construct buildings.');
        return;
      }

      setLoading((prev) => ({ ...prev, [building.id]: true }));
      try {
        const result = await constructBuildings({
          kingdomId,
          buildingType: building.id,
          quantity,
        });

        if (!result.success) {
          const errMsg = result.error || 'Construction failed.';
          ToastService.error(errMsg);
          return;
        }

        // In demo mode, deduct gold and turns locally (no server to sync from).
        // In auth mode, refreshKingdomResources() below syncs authoritative state.
        if (isDemoMode()) {
          addGold(-totalCost);
          addTurns(-1);
        }

        // Update displayed building counts from server response
        const buildingsStr = result.buildings;
        if (buildingsStr) {
          try {
            const updated = JSON.parse(buildingsStr) as Record<string, number>;
            setKingdomBuildings(updated);
            // Always write to localStorage as a fast local cache
            const stored = localStorage.getItem(`kingdom-${kingdomId}`);
            if (stored) {
              const data = JSON.parse(stored) as Record<string, unknown>;
              data.buildings = updated;
              localStorage.setItem(`kingdom-${kingdomId}`, JSON.stringify(data));
            }
            // The building-constructor Lambda already wrote the authoritative buildings
            // value to DynamoDB — no redundant client-side Kingdom.update needed.
          } catch {
            // non-fatal — store update was already done
          }
        } else {
          // Optimistically update local buildings count
          setKingdomBuildings((prev) => ({
            ...prev,
            [building.id]: (prev[building.id] ?? 0) + quantity,
          }));
        }

        ToastService.success(
          `Built ${quantity} ${getBuildingName(race, building.category)} for ${totalCost.toLocaleString()} gold.`
        );

        // Refresh from server after Lambda updates turns balance
        await refreshKingdomResources(kingdomId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Construction failed.';
        ToastService.error(message);
      } finally {
        setLoading((prev) => ({ ...prev, [building.id]: false }));
      }
    },
    [kingdomId, race, quantities, gold, turns, addGold, addTurns]
  );

  return (
    <div className="building-management">
      <TopNavigation
        title={
          <>
            <img
              src="/buildings-economy-icon.png"
              style={{ width: 28, height: 28, objectFit: 'contain', verticalAlign: 'middle', marginRight: 8 }}
              alt=""
            />
            Construct Buildings
          </>
        }
        onBack={onBack}
        backLabel="Back to Kingdom"
        subtitle="Build structures to strengthen your kingdom"
        kingdomId={kingdomId}
      />

      <div className="bm-content">
        {/* Resource summary bar */}
        <div className="bm-resources">
          <span className="bm-resource-item">
            <span className="bm-resource-icon">💰</span>
            <span className="bm-resource-label">Gold:</span>
            <span className="bm-resource-value">{gold.toLocaleString()}</span>
          </span>
          <span className="bm-resource-item">
            <span className="bm-resource-icon">⏱️</span>
            <span className="bm-resource-label">Turns:</span>
            <span className="bm-resource-value">{turns}</span>
          </span>
          <span className="bm-resource-hint">Each construction costs 250 gold &amp; 1 turn</span>
        </div>

        {/* Building cards */}
        <div className="bm-grid">
          {BUILDING_DEFS.map((building) => {
            const quantity = quantities[building.id] ?? 1;
            const totalCost = quantity * GOLD_PER_BUILDING;
            const canAfford = gold >= totalCost && turns >= 1;
            const currentCount = kingdomBuildings[building.id] ?? 0;
            const displayName = getBuildingName(race, building.category);
            const imageSrc = getBuildingImage(race, building.category);
            const isLoading = loading[building.id] ?? false;

            return (
              <div
                key={building.id}
                className={`bm-card${!canAfford ? ' bm-card--unaffordable' : ''}`}
              >
                {imageSrc && (
                  <div className="bm-card-image">
                    <img
                      src={imageSrc}
                      alt={displayName}
                      style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '8px 8px 0 0', display: 'block' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="bm-card-header">
                  <div className="bm-card-title-row">
                    <span className="bm-card-name">{displayName}</span>
                    <span className="bm-card-count" title="Currently owned">
                      Owned: {currentCount}
                    </span>
                  </div>
                  <p className="bm-card-description">{building.description}</p>
                  <span className="bm-card-effect">{building.effect}</span>
                </div>

                <div className="bm-card-footer">
                  <div className="bm-quantity-row">
                    <button
                      className="bm-qty-btn"
                      onClick={() => handleQuantityChange(building.id, quantity - 1)}
                      disabled={quantity <= 1 || isLoading}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="bm-qty-input"
                      min={1}
                      max={1000}
                      value={quantity}
                      onChange={(e) =>
                        handleQuantityChange(building.id, parseInt(e.target.value, 10) || 1)
                      }
                      disabled={isLoading}
                      aria-label="Quantity"
                    />
                    <button
                      className="bm-qty-btn"
                      onClick={() => handleQuantityChange(building.id, quantity + 1)}
                      disabled={quantity >= 1000 || isLoading}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div className="bm-cost-row">
                    <span className="bm-cost-label">Cost:</span>
                    <span className={`bm-cost-value${!canAfford ? ' bm-cost--unaffordable' : ''}`}>
                      💰 {totalCost.toLocaleString()} gold + 1 turn
                    </span>
                  </div>

                  <button
                    className="bm-build-btn"
                    onClick={() => handleBuild(building)}
                    disabled={!canAfford || isLoading}
                    title={
                      !canAfford
                        ? `Need ${totalCost.toLocaleString()} gold and 1 turn`
                        : `Build ${quantity} ${displayName}`
                    }
                  >
                    {isLoading ? 'Building...' : `Build ${quantity}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
