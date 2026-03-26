export function normalizeRace(race: string | null | undefined): string {
  if (!race) return 'Human';
  return race.charAt(0).toUpperCase() + race.slice(1).toLowerCase();
}
