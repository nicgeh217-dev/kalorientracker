const TRANSIENT = new Set([500, 502, 503, 504]);
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// Probiert die Modelle der Reihe nach.
// - 500/502/503/504 (Gemini überlastet): bis zu `retries` Wiederholungen beim selben Modell, danach nächstes Modell.
// - 404 (Modell gibt es nicht mehr): sofort nächstes Modell.
// - alles andere (Key falsch, Limit, ...): sofort Abbruch, ein anderes Modell hilft nicht.
// call(model) -> Promise<{status, json?}>; wirft nie für HTTP-Fehler.
export async function runWithFallback(models, call, { retries = 1, delayMs = 1200, sleep = sleepMs } = {}) {
  const list = [...new Set(models.filter(Boolean))];
  let last = { status: 0, model: list[0] };
  for (const model of list) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await call(model);
      last = { status: res.status, model };
      if (res.status >= 200 && res.status < 300) return { ok: true, model, json: res.json };
      if (res.status === 404) break;
      if (!TRANSIENT.has(res.status)) return { ok: false, status: res.status, model };
      if (attempt < retries) await sleep(delayMs);
    }
  }
  return { ok: false, status: last.status, model: last.model };
}
