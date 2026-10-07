import { registerRenderer, showView, refreshCurrent } from './nav.js';
import { renderToday } from './views/today.js';
import { startScan } from './views/scan.js';
import { renderProducts } from './views/products.js';
import { renderWeight } from './views/weight.js';
import { renderSettings } from './views/settings.js';
import { listQueued } from './db.js';
import { toast } from './dom.js';

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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

showView('today');
