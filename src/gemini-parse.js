const BASES = ['per100g', 'perServing'];

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
  return {
    ok: true,
    label: {
      name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : null,
      basis: BASES.includes(obj.basis) ? obj.basis : null,
      servingGrams: num(obj.servingGrams),
      kcal: num(obj.kcal),
      protein: num(obj.protein),
      carbs: num(obj.carbs),
      fat: num(obj.fat),
    },
  };
}
