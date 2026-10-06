const VIEWS = ['today', 'scan', 'products', 'weight', 'settings'];
const renderers = {};

export function registerRenderer(name, fn) {
  renderers[name] = fn;
}

export function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
  for (const b of document.querySelectorAll('#nav button')) {
    b.classList.toggle('active', b.dataset.view === name);
  }
  if (renderers[name]) renderers[name]();
}

document.getElementById('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) showView(b.dataset.view);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

showView('today');
