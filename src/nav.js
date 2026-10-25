const VIEWS = ['today', 'training', 'history', 'products', 'weight', 'more', 'settings'];
// Unterseiten leuchten in der Leiste unter ihrem Eintrag.
const NAV_ENTRY = { products: 'more', settings: 'more', weight: 'more' };
const renderers = {};
let current = 'today'; // Die Produktseite hat keinen Eintrag in der Leiste, deshalb merken wir uns die Ansicht selbst.

export function registerRenderer(name, fn) {
  renderers[name] = fn;
}

export function showView(name) {
  current = name;
  for (const v of VIEWS) document.getElementById(`view-${v}`).hidden = v !== name;
  for (const b of document.querySelectorAll('#nav button')) {
    b.classList.toggle('active', b.dataset.view === (NAV_ENTRY[name] ?? name));
  }
  return renderers[name]?.();
}

export function refreshCurrent() {
  return renderers[current]?.();
}
