import { el } from '../dom.js';
import { dayTotals, localDateKey } from '../logic.js';
import { mealsForDate, deleteMeal, getSettings } from '../db.js';
import { showView } from '../nav.js';
import { openMealForm } from './meal-form.js';

let startScanHandler = () => {};
export function setScanHandler(fn) {
  startScanHandler = fn;
}

export async function renderToday() {
  const root = document.getElementById('view-today');
  const [meals, settings] = await Promise.all([mealsForDate(localDateKey(new Date())), getSettings()]);
  const t = dayTotals(meals);
  const goal = settings.calorieGoal;
  const pct = goal ? Math.min(100, Math.round((t.kcal / goal) * 100)) : 0;

  root.replaceChildren(
    el('h1', {}, 'Heute'),
    el('div', { class: 'card' },
      el('div', { class: 'big' }, `${t.kcal}`, el('span', { class: 'muted' }, goal ? ` / ${goal} kcal` : ' kcal')),
      goal
        ? el('div', { class: `bar${t.kcal > goal ? ' over' : ''}` }, el('div', { style: `width:${pct}%` }))
        : el('div', { class: 'note warn' }, 'Kein Kalorienziel gesetzt. ',
            el('a', { href: '#', onClick: (e) => { e.preventDefault(); showView('settings'); } }, 'Jetzt in den Einstellungen eintragen')),
      goal ? el('div', { class: 'muted' }, t.kcal <= goal ? `Noch ${goal - t.kcal} kcal übrig` : `${t.kcal - goal} kcal drüber`) : null,
      el('div', { class: 'muted' }, `Protein ${t.protein} g · Kohlenhydrate ${t.carbs} g · Fett ${t.fat} g`)),
    el('div', { class: 'actions' },
      el('button', { class: 'primary wide', onClick: () => startScanHandler() }, 'Foto scannen'),
      el('button', { onClick: () => openMealForm(null) }, 'Manuell'),
      el('button', { onClick: () => showView('products') }, 'Aus Produkten')),
    el('h2', {}, 'Mahlzeiten'),
    ...(meals.length ? meals.map(mealCard) : [el('div', { class: 'muted' }, 'Noch nichts eingetragen.')]));
}

function mealCard(m) {
  const time = new Date(m.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const amt = m.amount ? `${m.amount.value} ${m.amount.unit === 'g' ? 'g' : '×'}` : '';
  return el('div', { class: 'card row' },
    el('div', {},
      el('strong', {}, m.name),
      el('div', { class: 'muted' }, `${time} · ${amt} · ${m.kcal} kcal · P ${m.protein ?? '–'} · KH ${m.carbs ?? '–'} · F ${m.fat ?? '–'}`)),
    el('button', {
      class: 'small danger',
      'aria-label': `${m.name} löschen`,
      onClick: async () => {
        if (confirm(`"${m.name}" löschen?`)) {
          await deleteMeal(m.id);
          renderToday();
        }
      },
    }, 'Löschen'));
}
