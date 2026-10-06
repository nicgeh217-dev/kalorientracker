import { el } from '../dom.js';
import { listProducts } from '../db.js';
import { openMealForm } from './meal-form.js';

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

  root.replaceChildren(
    el('h1', {}, 'Produkte'),
    el('div', { class: 'search' }, search),
    el('div', { class: 'muted', style: 'margin:0 4px 12px' }, 'Antippen, um eine Mahlzeit mit diesem Produkt einzutragen. Änderungen am Produkt wirken sich nicht auf bereits gespeicherte Mahlzeiten aus.'),
    list);
  await drawList();
}

function productCard(p) {
  const basis = p.basis === 'per100g' ? 'pro 100 g' : 'pro Portion';
  return el('button', { onClick: () => openMealForm({ ...p, productId: p.id }) },
    el('div', {},
      el('strong', {}, p.name),
      el('div', { class: 'muted' }, `${basis} · P ${p.protein ?? '–'} · KH ${p.carbs ?? '–'} · F ${p.fat ?? '–'}`)),
    el('div', { class: 'num kc' }, String(p.kcal)));
}
