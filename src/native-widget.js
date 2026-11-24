// Brücke zum Startbildschirm-Widget der Android-App. Android kann die App-Datenbank nicht selbst lesen,
// darum bekommt das Widget die Tageszahl von hier. Im Browser (PWA) passiert nichts.
const PLUGIN = 'KalorienWidget';
const isNative = (cap) => Boolean(cap?.isNativePlatform?.());

export const widgetKcal = (meals) => Math.round(meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0));

export async function pushToWidget({ kcal, dateKey }, { cap = globalThis.Capacitor } = {}) {
  if (!isNative(cap)) return;
  try {
    await cap.nativePromise(PLUGIN, 'update', { kcal, dateKey });
  } catch {
    // Das Widget zeigt dann den letzten Stand. Die App selbst läuft weiter.
  }
}

// true genau einmal, nachdem das Widget angetippt wurde.
export async function takeWidgetCamera({ cap = globalThis.Capacitor } = {}) {
  if (!isNative(cap)) return false;
  try {
    return Boolean((await cap.nativePromise(PLUGIN, 'takeCameraRequest'))?.camera);
  } catch {
    return false;
  }
}

// Alles, was die Widgets zeigen, in einem Paket (ganze Zahlen, 0 statt fehlender Werte).
import { nutrientTargets } from './nutrients.js';
const whole = (n) => (Number.isFinite(n) ? Math.round(n) : 0);
function goals(settings) {
  const t = nutrientTargets({ kcal: settings?.calorieGoal, proteinGoal: settings?.proteinGoal, overrides: settings?.targets }) ?? {};
  return { proteinGoal: whole(t.protein), carbsGoal: whole(t.carbs), fatGoal: whole(t.fat) };
}
export function widgetPayload({ dateKey, meals, settings, vitals }) {
  const sum = (k) => meals.reduce((s, m) => s + (m[k] ?? 0), 0);
  const day = vitals.find((v) => v.dateKey === dateKey) ?? {};
  return {
    dateKey,
    kcal: whole(sum('kcal')), goal: whole(settings?.calorieGoal),
    protein: whole(sum('protein')), carbs: whole(sum('carbs')), fat: whole(sum('fat')),
    ...goals(settings),
    steps: whole(day.steps), sleepMin: whole(day.sleepMin), restingHr: whole(day.restingHr),
  };
}

// Aktion, die ein Schnell-Widget angefordert hat (genau einmal), sonst null.
const ACTIONS = ['camera', 'barcode', 'workout', 'weight'];
export async function takeWidgetAction({ cap = globalThis.Capacitor } = {}) {
  if (!isNative(cap)) return null;
  try {
    const a = (await cap.nativePromise(PLUGIN, 'takeAction'))?.action;
    return ACTIONS.includes(a) ? a : null;
  } catch {
    return null;
  }
}
