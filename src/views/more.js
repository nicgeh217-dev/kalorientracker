import { el, mount } from '../dom.js';
import { showView } from '../nav.js';

export async function renderMore() {
  const root = document.getElementById('view-more');
  const row = (title, sub, onClick) => el('button', { class: 'morerow', onClick },
    el('span', {}, title, el('small', {}, sub)), el('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
  mount(root,
    el('h1', {}, 'Mehr'),
    el('div', { class: 'card morelist' },
      row('Gespeicherte Produkte', 'Werte ansehen, ändern oder löschen', () => showView('products')),
      row('Einstellungen', 'Ziele, Gemini-Key, Fuchs', () => showView('settings')),
      row('Sicherung', 'Daten sichern oder wiederherstellen', async () => {
        await showView('settings');
        document.getElementById('backup-card')?.scrollIntoView({ block: 'start' });
      })));
}
