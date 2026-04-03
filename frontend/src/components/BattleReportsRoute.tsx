import { useEffect, useState, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import { useCombatStore, type Unit } from '../stores/combatStore';
import { useAIKingdomStore } from '../stores/aiKingdomStore';
import type { BattleHistory, Army } from '../types/combat';
import type { Schema } from '../../../amplify/data/resource';
import { isDemoMode } from '../utils/authMode';
import { lazy, Suspense } from 'react';
import { LoadingSkeleton } from './ui/loading/LoadingSkeleton';

const BattleReports = lazy(() => import('./combat/BattleReports'));

function BattleReportsRoute({ kingdom }: { kingdom: Schema['Kingdom']['type'] }) {
  const rawHistory = useCombatStore((state) => state.battleHistory);
  const aiKingdoms = useAIKingdomStore((state) => state.aiKingdoms);
  const [serverHistory, setServerHistory] = useState<BattleHistory[]>([]);

  // In auth mode, fetch persisted battle reports from DynamoDB on mount
  useEffect(() => {
    if (isDemoMode()) return;
    const fetchServerHistory = async () => {
      try {
        const client = generateClient<Schema>();
        const { data } = await client.models.BattleReport.list({
          filter: { attackerId: { eq: kingdom.id } },
          limit: 50,
        });
        if (!data || data.length === 0) return;
        const parsed: BattleHistory[] = data.map(r => {
          const result = typeof r.result === 'string' ? JSON.parse(r.result) : (r.result ?? {});
          const outcome: 'victory' | 'defeat' | 'draw' =
            result.result === 'with_ease' || result.result === 'good_fight' || result.result === 'victory' ? 'victory'
            : result.result === 'failed' || result.result === 'defeat' ? 'defeat' : 'draw';
          const attackerInfo = { kingdomName: kingdom.name ?? 'Your Kingdom', race: kingdom.race ?? 'Human' };
          const defenderInfo = { kingdomName: r.defenderId };
          return {
            id: r.id,
            timestamp: new Date(r.timestamp),
            attackerId: r.attackerId,
            defenderId: r.defenderId,
            attacker: attackerInfo,
            defender: defenderInfo,
            outcome,
            result: { outcome, attacker: attackerInfo, defender: defenderInfo, attackType: ((r as Record<string, unknown>).attackType as string | undefined) ?? 'full_attack', success: outcome === 'victory', landGained: r.landGained ?? 0 },
            casualties: {},
            netGain: { gold: result.goldLooted ?? 0, land: r.landGained ?? 0, population: 0 },
            isAttacker: true,
            attackType: (((r as Record<string, unknown>).attackType as string | undefined) ?? 'full_attack') as BattleHistory['attackType'],
          } satisfies BattleHistory;
        });
        setServerHistory(parsed);
      } catch (err) {
        console.warn('[BattleReportsRoute] Server fetch failed:', err);
      }
    };
    void fetchServerHistory();
  }, [kingdom.id, kingdom.name, kingdom.race]);

  const battleHistory: BattleHistory[] = useMemo(() => {
    const unitsToArmy = (units: Unit[]): Army => {
      const army: Army = {};
      units.forEach(u => {
        army[u.type] = (army[u.type] ?? 0) + u.count;
      });
      return army;
    };

    const casualtiesToArmy = (casualties: Record<string, number>, units: Unit[]): Army => {
      const army: Army = {};
      Object.entries(casualties).forEach(([unitId, count]) => {
        const unit = units.find(u => u.id === unitId);
        const type = unit?.type ?? unitId;
        army[type] = (army[type] ?? 0) + count;
      });
      return army;
    };

    return rawHistory.map(report => {
      const defenderAI = aiKingdoms.find(k => k.id === report.defender);
      const defenderName = defenderAI?.name ?? report.defender;
      const defenderRace = defenderAI?.race ?? 'Unknown';
      const attackerName = kingdom.name ?? 'Your Kingdom';
      const attackerRace = kingdom.race ?? 'Human';

      const attackerArmyBefore = unitsToArmy(report.attackerUnits);
      const attackerCasualties = casualtiesToArmy(report.casualties.attacker, report.attackerUnits);
      const attackerArmyAfter: Army = { ...attackerArmyBefore };
      Object.entries(attackerCasualties).forEach(([type, lost]) => {
        attackerArmyAfter[type] = Math.max(0, (attackerArmyAfter[type] ?? 0) - (lost ?? 0));
      });

      const defenderArmyBefore = unitsToArmy(report.defenderUnits);
      const defenderCasualties = casualtiesToArmy(report.casualties.defender, report.defenderUnits);

      const attackerInfo = {
        kingdomName: attackerName,
        race: attackerRace,
        armyBefore: attackerArmyBefore,
        armyAfter: attackerArmyAfter,
        casualties: attackerCasualties,
      };
      const defenderInfo = {
        kingdomName: defenderName,
        race: defenderRace,
        armyBefore: Object.keys(defenderArmyBefore).length > 0 ? defenderArmyBefore : undefined,
        casualties: Object.keys(defenderCasualties).length > 0 ? defenderCasualties : undefined,
      };

      return {
        id: report.id,
        timestamp: new Date(report.timestamp),
        attackerId: report.attacker,
        defenderId: report.defender,
        attacker: attackerInfo,
        defender: defenderInfo,
        outcome: report.result,
        result: {
          outcome: report.result,
          attacker: attackerInfo,
          defender: defenderInfo,
          attackType: 'full_attack' as const,
          success: report.result === 'victory',
          spoils: {
            gold: report.resourcesGained?.gold ?? 0,
            population: 0,
            land: report.landGained ?? 0,
          },
          landGained: report.landGained,
        },
        casualties: { ...report.casualties.attacker, ...report.casualties.defender },
        netGain: {
          gold: report.resourcesGained?.gold ?? 0,
          land: report.landGained ?? 0,
          population: 0,
        },
        isAttacker: true,
        attackType: 'full_attack' as const,
      } satisfies BattleHistory;
    });
  }, [rawHistory, aiKingdoms, kingdom]);

  // Merge local session history with server-persisted history (dedup by id)
  const mergedHistory = useMemo(() => {
    const localIds = new Set(battleHistory.map(b => b.id));
    const serverOnly = serverHistory.filter(b => !localIds.has(b.id));
    return [...battleHistory, ...serverOnly].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [battleHistory, serverHistory]);

  return (
    <Suspense fallback={<LoadingSkeleton type="list" className="m-8" />}>
      <BattleReports battleHistory={mergedHistory} className="battle-reports-content" currentKingdomId={kingdom.id} />
    </Suspense>
  );
}

export default BattleReportsRoute;
