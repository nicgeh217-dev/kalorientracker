import { registerRenderer, showView } from './nav.js';
import { renderToday, setScanHandler } from './views/today.js';
import { startScan } from './views/scan.js';

registerRenderer('today', renderToday);
setScanHandler(startScan);

document.getElementById('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) showView(b.dataset.view);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

showView('today');
