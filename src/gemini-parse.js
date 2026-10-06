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
    return null;
  }
}

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
      name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : null,
      source: estimate ? 'estimate' : 'label',
      basis: estimate ? 'perServing' : (BASES.includes(obj.basis) ? obj.basis : null),
      servingGrams: num(obj.servingGrams),
      kcal,
      protein: num(obj.protein),
      carbs: num(obj.carbs),
      fat: num(obj.fat),
      confidence: CONFIDENCES.includes(obj.confidence) ? obj.confidence : null,
      note,
      kcalMin,
      kcalMax,
    },
  };
}
