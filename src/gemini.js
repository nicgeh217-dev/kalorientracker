import { parseLabelResponse } from './gemini-parse.js';
import { runWithFallback } from './gemini-retry.js';

// Auswählbare Modelle (Stand 2026-10 laut Gemini-Doku). Der Nutzer wählt in den Einstellungen.
export const MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Schnell – gemini-3.5-flash-lite' },
  { id: 'gemini-3.8-flash', label: 'Genau – gemini-3.8-flash' },
];
export const DEFAULT_MODEL = 'gemini-3.8-flash';
const endpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

const PROMPT = `Du liest das Foto einer Nährwerttabelle (oft koreanisch: 영양정보, 열량=kcal, 탄수화물=Kohlenhydrate, 단백질=Protein, 지방=Fett).
Gib ausschließlich JSON zurück mit den Feldern:
- name: Produktname, falls auf dem Foto sichtbar, sonst null
- basis: "per100g", wenn die Werte für 100 g bzw. 100 ml gelten, "perServing", wenn sie für eine Portion/Packung gelten, sonst null
- servingGrams: Gramm (oder ml) einer Portion, falls angegeben, sonst null
- kcal, protein, carbs, fat: Zahlen für die oben genannte Bezugsgröße (Gramm, nur Zahl)
Wenn ein Wert nicht lesbar oder nicht vorhanden ist, setze ihn auf null. Schätze nichts und rechne nichts um.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true },
    basis: { type: 'STRING', nullable: true, enum: ['per100g', 'perServing'] },
    servingGrams: { type: 'NUMBER', nullable: true },
    kcal: { type: 'NUMBER', nullable: true },
    protein: { type: 'NUMBER', nullable: true },
    carbs: { type: 'NUMBER', nullable: true },
    fat: { type: 'NUMBER', nullable: true },
  },
};

export async function resizeImage(file, maxEdge = 1600) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verkleinert werden.'))), 'image/jpeg', 0.85);
  });
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function httpError(status, model) {
  if (status === 400 || status === 403) return 'Der Gemini-Key ist ungültig oder nicht freigeschaltet. Bitte in den Einstellungen prüfen.';
  if (status === 404) return `Das Modell "${model}" gibt es nicht (mehr). Bitte in den Einstellungen ein anderes Modell wählen.`;
  if (status === 429) return 'Das Gemini-Limit ist erreicht. Bitte später erneut versuchen oder manuell eintragen.';
  if (status >= 500) return 'Gemini ist gerade überlastet (HTTP ' + status + '). Ich habe es mehrfach und mit einem zweiten Modell versucht. Bitte in ein paar Minuten nochmal scannen oder manuell eintragen.';
  return `Gemini-Fehler (HTTP ${status}).`;
}

// Zweites Modell als Ausweichlösung, falls das gewählte überlastet oder abgeschaltet ist.
function fallbackFor(model) {
  return MODELS.find((m) => m.id !== model)?.id;
}

// Wirft nie: liefert immer {ok, label, model, seconds} oder {ok:false, error}.
export async function scanLabel(file, apiKey, model = DEFAULT_MODEL) {
  if (!apiKey) return { ok: false, error: 'Kein Gemini-Key hinterlegt.' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'Du bist offline. Der Foto-Scan braucht Internet.' };
  }
  const started = performance.now();
  const primary = model || DEFAULT_MODEL;
  try {
    const blob = await resizeImage(file);
    const body = JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: await toBase64(blob) } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    });
    const call = async (m) => {
      const res = await fetch(endpoint(m), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
      });
      return { status: res.status, json: res.ok ? await res.json() : undefined };
    };
    const r = await runWithFallback([primary, fallbackFor(primary)], call);
    if (!r.ok) return { ok: false, error: httpError(r.status, r.model) };
    const parsed = parseLabelResponse(r.json);
    return parsed.ok ? { ...parsed, model: r.model, seconds: (performance.now() - started) / 1000 } : parsed;
  } catch (e) {
    return { ok: false, error: 'Der Scan ist fehlgeschlagen (Netzwerk oder Bild). Bitte erneut versuchen.' };
  }
}
