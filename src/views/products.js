import { el } from '../dom.js';
import { listProducts } from '../db.js';
import { openMealForm } from './meal-form.js';

let filter = '';

export async function renderProducts() {
  const root = document.getElementById('view-products');
  const all = await listProducts();
  const q = filter.trim().toLowerCase();
  const shown = all
    .filter((p) => p.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const search = el('input', { type: 'search', placeholder: 'Suchen …', value: filter });
  search.addEventListener('input', () => {
    filter = search.value;
    renderProducts().then(() => {
      const again = document.querySelector('#view-products input[type=search]');
      again.focus();
      again.setSelectionRange(filter.length, filter.length);
    });
  });

  root.replaceChildren(
    el('h1', {}, 'Produkte'),
    search,
    el('div', { class: 'muted', style: 'margin:8px 0' }, 'Antippen, um eine Mahlzeit mit diesem Produkt einzutragen. Änderungen am Produkt wirken sich nicht auf bereits gespeicherte Mahlzeiten aus.'),
    ...(shown.length
      ? shown.map(productCard)
      : [el('div', { class: 'muted' }, all.length ? 'Nichts gefunden.' : 'Noch keine Produkte. Sie erscheinen hier, sobald du eine Mahlzeit speicherst.')]));
}

function productCard(p) {
  const basis = p.basis === 'per100g' ? 'pro 100 g' : 'pro Portion';
  return el('button', {
    class: 'card row',
    style: 'width:100%;text-align:left;color:inherit;font-weight:400',
    onClick: () => openMealForm({ ...p, productId: p.id }),
  },
    el('div', {},
      el('strong', {}, p.name),
      el('div', { class: 'muted' }, `${p.kcal} kcal ${basis} · P ${p.protein ?? '–'} · KH ${p.carbs ?? '–'} · F ${p.fat ?? '–'}`)));
}
