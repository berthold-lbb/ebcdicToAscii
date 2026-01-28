/**
 * Retourne le dernier jour du mois précédent
 * au format YYYY-MM-DD.
 *
 * Exemple :
 *  - 2026-01-28 => 2025-12-31
 */
export function lastDayOfPreviousMonth(baseDate: Date = new Date()): string {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth(); // 0 = janvier

  // Jour 0 du mois courant = dernier jour du mois précédent
  const lastDay = new Date(year, month, 0);

  return formatYyyyMmDd(lastDay);
}

function formatYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}
