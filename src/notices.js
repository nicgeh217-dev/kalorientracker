// Auf "Heute" erscheint immer nur ein Hinweis, damit die Seite ruhig bleibt.
// Priorität: Warnung bei zu schneller Abnahme, dann Zielvorschlag, dann Sicherungs-Erinnerung.
const ORDER = ['fastLoss', 'suggestion', 'backup'];

export function pickNotice(candidates) {
  for (const kind of ORDER) {
    if (candidates[kind]) return { kind, data: candidates[kind] };
  }
  return null;
}
