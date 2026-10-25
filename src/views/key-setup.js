import { el, openSheet, closeSheet, toast } from '../dom.js';
import { getSettings, saveSettings } from '../db.js';
import { cleanGeminiKey } from '../gemini-key.js';

const KEY_URL = 'https://aistudio.google.com/apikey';

// Kurze Einrichtung für die Foto-Erkennung: Jeder braucht einen eigenen, kostenlosen Gemini-Schlüssel.
export function openKeySetup({ onDone = null } = {}) {
  const key = el('input', { type: 'password', autocomplete: 'off', placeholder: 'AIza …', 'aria-label': 'Gemini-Schlüssel' });
  const msg = el('div');
  const step = (n, text) => el('div', { class: 'row', style: 'justify-content:flex-start;align-items:flex-start;margin-bottom:10px' },
    el('b', { class: 'num', style: 'font-size:26px;color:var(--orange-text);min-width:22px' }, String(n)), el('div', {}, text));
  const save = el('button', { class: 'primary' }, 'Speichern');
  save.addEventListener('click', async () => {
    const r = cleanGeminiKey(key.value);
    if (!r.ok) return msg.replaceChildren(el('div', { class: 'note bad' }, r.error));
    save.disabled = true;
    await saveSettings({ ...(await getSettings()), geminiKey: r.key });
    closeSheet();
    toast('Gemini-Schlüssel gespeichert. Du kannst jetzt Fotos scannen.');
    return onDone?.();
  });
  openSheet(
    el('h1', {}, 'Foto-Erkennung einrichten'),
    el('div', { class: 'muted', style: 'margin:-8px 4px 12px' }, 'Die App liest Nährwerttabellen mit Googles Gemini. Dafür braucht jede Person einen eigenen, kostenlosen Schlüssel. So läuft nichts über das Konto anderer.'),
    el('div', { class: 'card' },
      step(1, el('span', {}, 'Öffne ', el('a', { href: KEY_URL, target: '_blank', rel: 'noopener' }, 'Google AI Studio'), ' und melde dich mit deinem Google-Konto an.')),
      step(2, 'Tippe auf „Create API key“ (API-Schlüssel erstellen) und kopiere den Schlüssel.'),
      step(3, 'Komm zurück in die App und füge ihn hier ein.')),
    el('label', {}, 'Dein Gemini-Schlüssel'), key,
    el('div', { class: 'muted', style: 'margin:8px 4px 0' }, 'Der Schlüssel bleibt nur auf diesem Handy und geht nie in eine Sicherung. Gib ihn niemandem weiter.'),
    msg,
    el('div', { class: 'actions' }, el('button', { class: 'btn', onClick: closeSheet }, 'Später'), save));
}
