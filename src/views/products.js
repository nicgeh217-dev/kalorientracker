import { el, mount } from '../dom.js';
import { listProducts } from '../db.js';
import { openMealForm } from './meal-form.js';
import { openProductForm } from './product-form.js';

let filter = '';

// Das Suchfeld wird nur einmal angelegt; beim Tippen wird nur die Liste neu gezeichnet.
// Sonst bricht die Tastatur-Komposition (Hangul/Gboard) ab.
export async function renderProducts() {
  const root = document.getElementById('view-products');
  const list = el('div');
  const search = el('input', { type: 'search', placeholder: 'Suchen …', value: filter });
  search.addEventListener('input', () => {
    filter = search.value;
    if (!search.composing) drawList();
  });
  search.addEventListener('compositionstart', () => { search.composing = true; });
  search.addEventListener('compositionend', () => { search.composing = false; filter = search.value; drawList(); });

  async function drawList() {
    const all = await listProducts();
    const q = filter.trim().toLowerCase();
    const shown = all
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    list.replaceChildren(shown.length
      ? el('div', { class: 'group' }, ...shown.map(productCard))
      : el('div', { class: 'card muted' }, all.length ? 'Nichts gefunden.' : 'Noch keine Produkte. Sie erscheinen hier, sobald du eine Mahlzeit speicherst.'));
  }

  mount(root,
    el('h1', {}, 'Produkte'),
    el('div', { class: 'search' }, search),
    el('div', { class: 'muted', style: 'margin:0 4px 12px' }, 'Antippen trägt eine Mahlzeit mit diesem Produkt ein. Mit ✎ benennst du ein Produkt um, korrigierst Werte oder löschst es. Bereits gespeicherte Mahlzeiten ändern sich dadurch nicht.'),
    list);
  await drawList();
}

function productCard(p) {
  const basis = p.basis === 'per100g' ? 'pro 100 g' : 'pro Portion';
  return el('div', { class: 'prow' },
    el('button', { class: 'main', onClick: () => openMealForm({ ...p, productId: p.id }) },
      el('div', {},
        el('strong', {}, p.name),
        el('div', { class: 'muted' }, `${p.estimated ? '~ geschätzt · ' : ''}${basis} · P ${p.protein ?? '–'} · KH ${p.carbs ?? '–'} · F ${p.fat ?? '–'}`)),
      el('div', { class: 'num kc' }, String(p.kcal))),
    el('button', { class: 'edit', 'aria-label': `${p.name} bearbeiten`, onClick: () => openProductForm(p) }, '✎'));
}
