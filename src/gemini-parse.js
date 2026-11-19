import { cleanUncertain } from './uncertain.js';

const BASES = ['per100g', 'perServing'];
const CONFIDENCES = ['low', 'medium', 'high'];

function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string') return null;
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Mit Websuche antwortet Gemini oft mit Text um das JSON herum: das Objekt zwischen erster und letzter Klammer nehmen.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const responseText = (apiJson) => apiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

export function parseLabelResponse(apiJson) {
  const block = apiJson?.promptFeedback?.blockReason;
  if (block) return { ok: false, error: `Die Anfrage wurde von Gemini blockiert (${block}).` };
  const text = apiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) return { ok: false, error: 'Gemini hat keine Antwort geliefert.' };
  const obj = extractJson(text);
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'Die Antwort von Gemini konnte nicht gelesen werden.' };
  }
  const estimate = obj.source === 'estimate';
  const kcal = num(obj.kcal);
  if (estimate && kcal == null) return { ok: false, error: 'Die Schätzung enthielt keine Kalorien. Bitte erneut versuchen oder manuell eintragen.' };
  let kcalMin = num(obj.kcalMin);
  let kcalMax = num(obj.kcalMax);
  if (kcal == null || kcalMin == null || kcalMax == null || kcalMin > kcal || kcalMax < kcal) {
    kcalMin = null;
    kcalMax = null;
  }
  const note = typeof obj.note === 'string' && obj.note.trim() ? obj.note.trim() : null;
  return {
    ok: true,
    label: {
      name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 80) : null,
      source: estimate ? 'estimate' : 'label',
      basis: estimate ? 'perServing' : (BASES.includes(obj.basis) ? obj.basis : null),
      servingGrams: num(obj.servingGrams),
      kcal,
      protein: num(obj.protein),
      carbs: num(obj.carbs),
      fat: num(obj.fat),
      fiber: num(obj.fiber),
      sugar: num(obj.sugar),
      confidence: CONFIDENCES.includes(obj.confidence) ? obj.confidence : null,
      note,
      kcalMin,
      kcalMax,
      // Nur bei Etiketten: unsicher gelesene Felder und das Foto mit der Tabelle (für den Beleg am Produkt)
      uncertain: estimate ? [] : cleanUncertain(obj.uncertain),
      labelPhotoIndex: !estimate && Number.isInteger(obj.labelPhotoIndex) && obj.labelPhotoIndex >= 0 ? obj.labelPhotoIndex : null,
    },
  };
}

// Antwort auf "Im Netz nachschlagen" (Gemini mit Google-Suche). Die Werte gelten wie ein Etikett, bleiben aber als "aus dem Netz" markiert.
// sources: Webseiten, auf die sich die Antwort stützt (Titel, meist die Domain), höchstens drei.
export function parseLookupResponse(apiJson) {
  const obj = extractJson(responseText(apiJson));
  if (obj && typeof obj === 'object' && obj.found === false) {
    return { ok: false, notFound: true, error: 'Im Netz habe ich dazu keine sicheren Nährwerte gefunden.' };
  }
  const parsed = parseLabelResponse(apiJson);
  if (!parsed.ok) return parsed;
  if (parsed.label.kcal == null) return { ok: false, notFound: true, error: 'Im Netz habe ich keine Kalorienangabe dazu gefunden.' };
  const titles = (apiJson.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c?.web?.title)
    .filter((t) => typeof t === 'string' && t.trim());
  return { ok: true, label: { ...parsed.label, source: 'web', uncertain: [], labelPhotoIndex: null }, sources: [...new Set(titles)].slice(0, 3) };
}
