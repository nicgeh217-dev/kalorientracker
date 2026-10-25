export const SLOTS = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snack', label: 'Snacks' },
];

// Ortszeit: 5–10 Uhr Frühstück, 11–14 Mittag, 17–21 Abend, sonst Snack.
export function slotForTime(isoTimestamp) {
  const h = new Date(isoTimestamp).getHours();
  if (h >= 5 && h <= 10) return 'breakfast';
  if (h >= 11 && h <= 14) return 'lunch';
  if (h >= 17 && h <= 21) return 'dinner';
  return 'snack';
}

export function groupBySlot(meals) {
  return SLOTS.map(({ id, label }) => {
    const list = meals.filter((m) => (m.slot ?? slotForTime(m.timestamp)) === id);
    return { slot: id, label, meals: list, kcal: Math.round(list.reduce((sum, m) => sum + (m.kcal ?? 0), 0)) };
  });
}
