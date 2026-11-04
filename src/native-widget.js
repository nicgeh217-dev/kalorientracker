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
