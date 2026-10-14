import { registerRenderer, showView, refreshCurrent } from './nav.js';
import { renderToday } from './views/today.js';
import { startScan } from './views/scan.js';
import { renderProducts } from './views/products.js';
import { renderWeight } from './views/weight.js';
import { renderSettings } from './views/settings.js';
import { listQueued } from './db.js';
import { toast, el } from './dom.js';

registerRenderer('today', renderToday);
registerRenderer('products', renderProducts);
registerRenderer('weight', renderWeight);
registerRenderer('settings', renderSettings);

document.getElementById('fab').addEventListener('click', () => startScan());

document.getElementById('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) showView(b.dataset.view);
});

// Wieder online: auf wartende Fotos hinweisen.
window.addEventListener('online', async () => {
  const n = (await listQueued()).length;
  if (n) toast(`Du bist wieder online. ${n} Eintrag${n > 1 ? 'e warten' : ' wartet'} auf Auswertung.`, 'Ansehen', () => showView('today'));
  refreshCurrent();
});
window.addEventListener('offline', () => refreshCurrent());

// Nach der Rückkehr aus dem Hintergrund (z. B. am nächsten Morgen) neu zeichnen,
// damit "Heute" nicht den Stand von gestern zeigt.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !document.querySelector('.sheet')) refreshCurrent();
});

// Neue App-Version: Sobald ein neuer Service Worker übernimmt, bieten wir "Neu laden" an.
function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  document.body.append(el('div', { id: 'update-banner', role: 'status' },
    el('span', {}, 'Neue Version verfügbar. Lade neu, wenn du gerade nichts bearbeitest.'),
    el('button', { onClick: () => location.reload() }, 'Neu laden')));
}

if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller); // Erstinstallation löst keinen Hinweis aus
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBanner(); });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
}

showView('today');
