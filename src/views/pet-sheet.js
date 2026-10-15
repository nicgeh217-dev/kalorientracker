import { el, openSheet, closeSheet } from '../dom.js';
import { getSettings, saveSettings } from '../db.js';
import { refreshCurrent } from '../nav.js';
import { ACCESSORIES, accessoriesFor } from '../pet.js';
import { foxSvg } from './fox.js';

const DEFAULT_NAME = 'Foxi';

async function savePet(patch) {
  const fresh = await getSettings();
  await saveSettings({ ...fresh, pet: { name: DEFAULT_NAME, seenLevel: 0, ...(fresh.pet ?? {}), ...patch } });
  closeSheet();
  refreshCurrent();
}

const cleanName = (value) => value.trim().slice(0, 16) || DEFAULT_NAME;

// Beim allerersten Start: kennenlernen, benennen oder ablehnen.
export function openPetIntro(level) {
  const name = el('input', { value: DEFAULT_NAME, maxLength: 16, 'aria-label': 'Name des Fuchses' });
  openSheet(
    el('div', { class: 'pet-hero' }, foxSvg({ mood: 'happy', size: 150 })),
    el('h1', { style: 'text-align:center' }, 'Dein Begleiter'),
    el('div', { class: 'muted', style: 'text-align:center;margin:-8px 8px 12px' },
      'Der Fuchs freut sich über jeden Eintrag, egal wie viel du isst. Er bewertet nie dein Essen oder dein Gewicht und erinnert dich nur freundlich ans Tracken. Du kannst ihn jederzeit ausblenden.'),
    el('label', {}, 'Name'), name,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => savePet({ enabled: false, name: cleanName(name.value), seenLevel: level }) }, 'Ohne Begleiter'),
      el('button', { class: 'primary', onClick: () => savePet({ enabled: true, name: cleanName(name.value), seenLevel: level }) }, 'Los geht’s')));
}

// info: { name, level, total, streak: {current, best}, nextAt }
export function openPetSheet(info) {
  const name = el('input', { value: info.name, maxLength: 16, 'aria-label': 'Name des Fuchses' });
  const unlocked = accessoriesFor(info.level);
  const nextAcc = ACCESSORIES[info.level];
  const toNext = info.nextAt != null ? info.nextAt - info.total : null;

  openSheet(
    el('div', { class: 'pet-hero' }, foxSvg({ mood: 'happy', accessories: unlocked.map((a) => a.id), size: 170 })),
    el('h1', { style: 'text-align:center' }, info.name),
    el('div', { class: 'card' },
      el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Tage in Folge'), el('b', {}, String(info.streak.current))),
      el('div', { class: 'row', style: 'margin-top:8px' }, el('span', { class: 'muted' }, 'Rekord'), el('b', {}, String(info.streak.best))),
      el('div', { class: 'row', style: 'margin-top:8px' }, el('span', { class: 'muted' }, 'Tage mit Einträgen insgesamt'), el('b', {}, String(info.total)))),
    el('div', { class: 'card' },
      el('div', { class: 'muted', style: 'margin-bottom:8px' }, toNext != null
        ? `Noch ${toNext} ${toNext === 1 ? 'Tag' : 'Tage'} bis „${nextAcc.label}“. Jeder Tag mit mindestens einem Eintrag zählt.`
        : 'Alles freigeschaltet. Dein Fuchs ist komplett ausgestattet.'),
      el('div', { class: 'accs' }, ...ACCESSORIES.map((a, i) => el('span', { class: `acc${i < info.level ? ' on' : ''}` }, i < info.level ? a.label : `${a.label} (gesperrt)`)))),
    el('label', {}, 'Name'), name,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => savePet({ enabled: false }) }, 'Ausblenden'),
      el('button', { class: 'primary', onClick: () => savePet({ name: cleanName(name.value) }) }, 'Speichern'),
      el('button', { class: 'btn wide', onClick: closeSheet }, 'Schließen')),
    el('div', { class: 'muted', style: 'margin:8px 4px 0;font-size:13px' }, 'Der Fuchs zählt nur, ob du einträgst, nicht was oder wie viel. Wieder einblenden kannst du ihn in den Einstellungen.'));
}
