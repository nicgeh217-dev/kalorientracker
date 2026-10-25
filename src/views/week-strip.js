import { el } from '../dom.js';
import { weekOf } from '../week.js';

const DAY_LETTERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STATUS_TEXT = { rest: 'Ruhetag', sick: 'krank' };

// counts: { [dateKey]: Anzahl Einträge }, statuses: { [dateKey]: 'rest' | 'sick' }
export function weekStrip({ selected, todayKey, counts = {}, statuses = {}, onSelect, onShift }) {
  const days = weekOf(selected);
  const cells = days.map((key, i) => {
    const future = key > todayKey;
    const status = statuses[key];
    const label = `${DAY_LETTERS[i]} ${Number(key.slice(8))}${counts[key] ? ', Einträge vorhanden' : ''}${status ? `, ${STATUS_TEXT[status]}` : ''}`;
    return el('button', {
      type: 'button', class: `wd${key === selected ? ' sel' : ''}${key === todayKey ? ' today' : ''}`,
      disabled: future, 'aria-label': label, 'aria-pressed': key === selected ? 'true' : 'false',
      onClick: () => onSelect(key),
    },
      el('span', { class: 'wl' }, DAY_LETTERS[i]),
      el('span', { class: 'wn' }, String(Number(key.slice(8)))),
      el('span', { class: `wsdot${status ? ` ${status}` : counts[key] ? ' has' : ''}` }));
  });
  const nextDisabled = days[6] >= todayKey;
  return el('div', { class: 'weekstrip' },
    el('button', { type: 'button', class: 'wnav', 'aria-label': 'Vorherige Woche', onClick: () => onShift(-1) }, '‹'),
    el('div', { class: 'wdays' }, ...cells),
    el('button', { type: 'button', class: 'wnav', 'aria-label': 'Nächste Woche', disabled: nextDisabled, onClick: () => onShift(1) }, '›'));
}
