/**
 * Get the image path for a unit, with race-specific variants for scouts.
 */
export const getUnitImagePath = (unitId: string, race: string): string => {
  if (unitId === 'scouts' || unitId === 'elite_scouts') {
    const racePrefix = race.toLowerCase().replace(/\s+/g, '-');
    return `/units/output/${racePrefix}-${unitId.replace(/_/g, '-')}-icon.png`;
  }
  return `/units/output/${unitId.replace(/_/g, '-')}-icon.png`;
};
