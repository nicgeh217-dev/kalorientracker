const VIEWS = ['today', 'products', 'weight', 'settings'];
const renderers = {};

export function registerRenderer(name, fn) {
  renderers[name] = fn;
}

export function showView(name) {
  for (const v of VIEWS) document.getElementById(`view-${v}`).hidden = v !== name;
  for (const b of document.querySelectorAll('#nav button')) {
    b.classList.toggle('active', b.dataset.view === name);
  }
  return renderers[name]?.();
}

export function refreshCurrent() {
  const active = document.querySelector('#nav button.active')?.dataset.view;
  return active ? renderers[active]?.() : undefined;
}
