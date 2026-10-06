import { parseLabelResponse } from './gemini-parse.js';

// Modell bei Bedarf hier ändern (Stand 2026-10: gemini-3.8-flash laut Gemini-Doku).
export const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

function httpError(status) {
  if (status === 400 || status === 403) return 'Der Gemini-Key ist ungültig oder nicht freigeschaltet. Bitte in den Einstellungen prüfen.';
  if (status === 404) return `Das Modell "${MODEL}" gibt es nicht mehr. Bitte MODEL in src/gemini.js anpassen.`;
  if (status === 429) return 'Das Gemini-Limit ist erreicht. Bitte später erneut versuchen oder manuell eintragen.';
  return `Gemini-Fehler (HTTP ${status}).`;
}

// Wirft nie: liefert immer {ok, label} oder {ok:false, error}.
export async function scanLabel(file, apiKey) {
  if (!apiKey) return { ok: false, error: 'Kein Gemini-Key hinterlegt.' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'Du bist offline. Der Foto-Scan braucht Internet.' };
  }
  try {
    const blob = await resizeImage(file);
    const body = {
      contents: [{
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: await toBase64(blob) } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    };
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: httpError(res.status) };
    return parseLabelResponse(await res.json());
  } catch (e) {
    return { ok: false, error: 'Der Scan ist fehlgeschlagen (Netzwerk oder Bild). Bitte erneut versuchen.' };
  }
}
