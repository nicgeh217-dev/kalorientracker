import { el } from '../dom.js';

const de1 = (n) => String(n).replace('.', ',');

// Hinweiskarte, wenn der Gewichtstrend schneller als ca. 1 % pro Woche fällt. warning kommt aus fastLossWarning().
export function fastLossCard(warning) {
  if (!warning) return null;
  return el('div', { class: 'note bad', role: 'alert' },
    el('b', {}, 'Du nimmst sehr schnell ab. '),
    `${de1(Math.abs(warning.perWeekKg))} kg pro Woche (${de1(warning.percent)} %). Empfohlen sind höchstens etwa 1 % pro Woche. Iss etwas mehr. Bei Schwäche oder Schwindel sprich bitte mit einem Arzt oder einer Ärztin.`);
}
