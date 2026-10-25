import { registerRenderer, showView, refreshCurrent } from './nav.js';
import { renderToday } from './views/today.js';
import { startScan, startScanWithFiles } from './views/scan.js';
import { parseLaunchAction } from './launch.js';
import { takeSharedItems } from './share-inbox.js';
import { renderProducts } from './views/products.js';
import { renderHistory } from './views/history.js';
import { openAddMenu } from './views/add-menu.js';
import { renderWeight } from './views/weight.js';
import { renderSettings } from './views/settings.js';
import { renderMore } from './views/more.js';
import { listQueued } from './db.js';
import { toast, el } from './dom.js';
import { requestPersistence } from './storage-persist.js';
import { shouldShowSplash, splashAlreadyShown, runSplash } from './splash.js';

registerRenderer('today', renderToday);
registerRenderer('products', renderProducts);
registerRenderer('history', renderHistory);
registerRenderer('weight', renderWeight);
registerRenderer('more', renderMore);
registerRenderer('settings', renderSettings);

document.getElementById('fab').addEventListener('click', () => openAddMenu());

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

// Start über Kurzbefehl (langes Drücken aufs Icon) oder "Teilen in die App".
async function handleLaunch() {
  const action = parseLaunchAction(location.search);
  if (!action) return;
  history.replaceState(null, '', location.pathname); // Adresse aufräumen, damit ein Neuladen nichts doppelt auslöst
  if (action === 'scan') return startScan();
  if (action === 'weight') {
    await showView('weight');
    document.querySelector('#view-weight input[inputmode="decimal"]')?.focus();
    return undefined;
  }
  const { files, text } = await takeSharedItems();
  if (files.length || text) return startScanWithFiles(files, text);
  toast('Es sind keine Fotos angekommen.');
  return undefined;
}

const splash = document.getElementById('splash');
if (splash) {
  const show = shouldShowSplash({
    navigationType: performance.getEntriesByType('navigation')[0]?.type ?? 'navigate',
    launchAction: parseLaunchAction(location.search),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    shownThisSession: splashAlreadyShown(),
  });
  if (show) runSplash(splash); else splash.remove();
}

showView('today');
handleLaunch();
requestPersistence(); // Ergebnis steht in den Einstellungen, Chrome entscheidet selbst
