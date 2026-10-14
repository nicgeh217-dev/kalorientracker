import { el } from '../dom.js';

const de1 = (n) => String(n).replace('.', ',');

// Hinweiskarte, wenn der Gewichtstrend schneller als ca. 1 % pro Woche fällt. warning kommt aus fastLossWarning().
export function fastLossCard(warning) {
  if (!warning) return null;
  return el('div', { class: 'note bad', role: 'alert' },
    el('b', {}, 'Du nimmst sehr schnell ab. '),
    `Dein Trend liegt bei ${de1(Math.abs(warning.perWeekKg))} kg pro Woche (${de1(warning.percent)} % deines Gewichts). Empfohlen sind höchstens etwa 1 % pro Woche, meist 0,5 bis 1 kg. `,
    'Iss etwas mehr, das schützt Muskeln und Energie. Bei Schwäche, Schwindel oder wenn die schnelle Abnahme nicht beabsichtigt ist, sprich bitte mit einem Arzt oder einer Ärztin.');
}
