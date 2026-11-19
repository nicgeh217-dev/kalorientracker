import { parseLabelResponse, parseLookupResponse } from './gemini-parse.js';
import { runWithFallback } from './gemini-retry.js';

// Auswählbare Modelle (Stand 2026-10 laut Gemini-Doku). Der Nutzer wählt in den Einstellungen.
export const MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Schnell – gemini-3.5-flash-lite' },
  { id: 'gemini-3.8-flash', label: 'Genau – gemini-3.8-flash' },
];
export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const MAX_PHOTOS = 4;
const endpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

export const PROMPT = `Du bekommst ein oder mehrere Fotos und/oder eine kurze Beschreibung von Essen. Alle Fotos gehören zum selben Produkt bzw. Gericht (z. B. Vorderseite und Nährwerttabelle). Gib ausschließlich JSON zurück.

Fall A – in mindestens einem Foto ist eine Nährwerttabelle lesbar. Oft koreanisch (영양정보, 열량=kcal, 탄수화물=Kohlenhydrate, 단백질=Protein, 지방=Fett, 식이섬유=Ballaststoffe, 당류=Zucker) oder japanisch (栄養成分表示, エネルギー=kcal, たんぱく質=Protein, 脂質=Fett, 炭水化物=Kohlenhydrate, 食物繊維=Ballaststoffe, 糖類=Zucker).
Japanische Etiketten:
- 糖質 ist nicht Zucker, sondern Kohlenhydrate ohne Ballaststoffe. Zucker ist nur 糖類; steht kein 糖類 da, ist sugar = null.
- Fehlt 炭水化物 und stehen nur 糖質 und 食物繊維 da, ist carbs = 糖質 + 食物繊維.
- 1個当たり, 1包装当たり, 1食当たり, 1本当たり und 1袋当たり bedeuten pro Portion bzw. Packung (basis = "perServing"); 100g当たり bzw. 100ml当たり bedeutet per100g. 内容量 ist der Packungsinhalt.
- 食塩相当量 (Salz) und ナトリウム (Natrium) werden nicht erfasst.
- source = "label". Lies die Werte exakt ab, schätze nichts und rechne nichts um.
- basis = "per100g", wenn die Werte für 100 g bzw. 100 ml gelten, "perServing", wenn sie für eine Portion/Packung gelten, sonst null.
- servingGrams = Gramm (oder ml) einer Portion bzw. Packung, falls angegeben. Steht keine Portion, aber der Gesamtinhalt der Packung auf dem Etikett (z. B. 총 내용량, Nettofüllmenge), nimm diesen. Sonst null.
- kcal, protein, carbs, fat, fiber, sugar = Zahlen für diese Bezugsgröße (fiber = Ballaststoffe, sugar = Zucker bzw. davon Zucker). Nicht lesbare oder nicht angegebene Werte = null.
- name = Produktname von der Verpackung, falls sichtbar, sonst null. Ist der Name nicht deutsch (z. B. Koreanisch/Hangul oder Japanisch), gib ihn als kurze deutsche Übersetzung mit dem Originalnamen in Klammern an, z. B. "Thunfisch-Kimbap (삼각김밥 참치마요)". Höchstens 60 Zeichen.
- uncertain = Liste der Felder, die du NICHT sicher lesen konntest (Feldnamen: basis, servingGrams, kcal, protein, carbs, fat, fiber, sugar), z. B. weil das Foto unscharf, verdeckt, spiegelnd, abgeschnitten oder widersprüchlich ist. Sicher gelesene Werte gehören nicht hinein. Leere Liste, wenn alles klar lesbar ist.
- labelPhotoIndex = Nummer des Fotos (das erste Foto ist 0), auf dem die Nährwerttabelle am besten lesbar ist.
- confidence, note, kcalMin, kcalMax = null.

Fall B – keine lesbare Nährwerttabelle (Restaurantgericht, Bäckerware, Obst, Verpackung ohne Tabelle) oder nur eine Textbeschreibung:
- source = "estimate". Schätze das GANZE gezeigte Gericht bzw. die beschriebene Portion.
- basis = "perServing". servingGrams = geschätztes Gesamtgewicht in Gramm.
- kcal, protein, carbs, fat, fiber, sugar = geschätzte Werte für die gesamte Portion. kcalMin und kcalMax = realistische Spanne der Kalorien.
- name = kurzer deutscher Name des Gerichts.
- confidence = "high" nur bei klar erkennbarem, standardisiertem Essen; "medium" bei üblichen Gerichten mit unklarer Portion; "low" bei unscharfem Foto, verdeckten Zutaten, viel Soße oder Öl.
- note = höchstens zwei kurze deutsche Sätze: was du siehst und welche Annahmen du getroffen hast (Menge, Zutaten, Öl/Soße).
- In Japan und Korea (Konbini, Imbiss, Restaurant) gelten dort übliche Portionsgrößen, z. B. ein Onigiri etwa 100 bis 120 g, eine Schale Reis etwa 150 g.
- Ein Hinweis des Nutzers hat Vorrang vor deiner eigenen Annahme.`;

const NUM = { type: 'NUMBER', nullable: true };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true },
    source: { type: 'STRING', enum: ['label', 'estimate'] },
    basis: { type: 'STRING', nullable: true, enum: ['per100g', 'perServing'] },
    servingGrams: NUM,
    kcal: NUM,
    protein: NUM,
    carbs: NUM,
    fat: NUM,
    fiber: NUM,
    sugar: NUM,
    confidence: { type: 'STRING', nullable: true, enum: ['low', 'medium', 'high'] },
    note: { type: 'STRING', nullable: true },
    kcalMin: NUM,
    kcalMax: NUM,
    uncertain: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    labelPhotoIndex: { type: 'INTEGER', nullable: true },
  },
  required: ['source'],
};

// Nachschlagen im Netz: Gemini sucht mit Google nach den veröffentlichten Nährwerten (Hersteller, Konbini, Restaurantkette).
// Ohne festes Antwortschema, weil sich das nicht mit der Google-Suche kombinieren lässt. Das JSON steht dann im Text.
const LOOKUP_PROMPT = `Suche im Internet die Nährwerte für dieses Lebensmittel und gib ausschließlich ein JSON-Objekt zurück, ohne weiteren Text.
Bevorzuge offizielle Angaben des Herstellers, der Konbini-Kette (z. B. 7-Eleven, Lawson, FamilyMart) oder der Restaurantkette. Erfinde nichts.
Format: {"found": true, "name": string, "basis": "per100g" oder "perServing", "servingGrams": Zahl oder null, "kcal": Zahl, "protein": Zahl oder null, "carbs": Zahl oder null, "fat": Zahl oder null, "fiber": Zahl oder null, "sugar": Zahl oder null}
Findest du das konkrete Produkt bzw. Gericht nicht sicher, antworte {"found": false}.
- Die Werte gelten für die Bezugsgröße in "basis". servingGrams = Gramm einer Portion bzw. Packung, falls bekannt.
- Japanisch: 糖質 ist nicht Zucker. Zucker ist nur 糖類. Fehlt 炭水化物, ist carbs = 糖質 + 食物繊維.
- name = kurzer deutscher Name, bei fremdsprachigen Produkten mit dem Originalnamen in Klammern, höchstens 60 Zeichen.`;

export function lookupRequestBody({ barcode = null, query = '' }) {
  const what = [barcode ? `Strichcode (JAN/EAN): ${barcode}` : null, query.trim() ? `Beschreibung: ${query.trim()}` : null].filter(Boolean).join('\n');
  return {
    contents: [{ parts: [{ text: LOOKUP_PROMPT }, { text: what }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0 },
  };
}

function lookupError(status) {
  if (status === 400) return 'Nachschlagen im Netz ist mit diesem Gemini-Key oder Modell nicht möglich. Fotografiere stattdessen die Nährwerttabelle.';
  if (status === 429) return 'Das Gemini-Limit für die Suche ist erreicht. Fotografiere stattdessen die Nährwerttabelle oder versuche es später.';
  return httpError(status);
}

// Wirft nie: liefert {ok, label, sources, model, seconds} oder {ok:false, error, notFound?}.
export async function lookupOnline({ barcode = null, query = '' }, apiKey, model = DEFAULT_MODEL) {
  if (!apiKey) return { ok: false, error: 'Kein Gemini-Key hinterlegt.' };
  if (!barcode && query.trim().length < 3) return { ok: false, error: 'Schreib dazu, was du suchst, z. B. „Lawson Lachs-Onigiri“.' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'Du bist offline. Nachschlagen braucht Internet.' };
  const started = performance.now();
  const primary = model || DEFAULT_MODEL;
  const body = JSON.stringify(lookupRequestBody({ barcode, query }));
  try {
    const call = async (m) => {
      const res = await fetch(endpoint(m), { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body });
      return { status: res.status, json: res.ok ? await res.json() : undefined };
    };
    const r = await runWithFallback([primary, fallbackFor(primary)], call);
    if (!r.ok) return { ok: false, error: lookupError(r.status) };
    const parsed = parseLookupResponse(r.json);
    return parsed.ok ? { ...parsed, model: r.model, seconds: (performance.now() - started) / 1000 } : parsed;
  } catch {
    return { ok: false, error: 'Das Nachschlagen ist fehlgeschlagen (Netzwerk). Bitte erneut versuchen.' };
  }
}

export async function resizeImage(file, maxEdge = 1600, quality = 0.85) {
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
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verkleinert werden.'))), 'image/jpeg', quality);
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
  if (status === 403) return 'Der Gemini-Key ist ungültig oder nicht freigeschaltet. Bitte in den Einstellungen prüfen.';
  if (status === 400) return 'Gemini hat die Anfrage abgelehnt: Der Key ist ungültig, oder die Fotos sind zu groß. Bitte Key prüfen oder weniger Fotos verwenden.';
  if (status === 404) return `Das Modell "${model}" gibt es nicht (mehr). Bitte in den Einstellungen ein anderes Modell wählen.`;
  if (status === 429) return 'Das Gemini-Limit ist erreicht. Bitte später erneut versuchen oder manuell eintragen.';
  if (status >= 500) return 'Gemini ist gerade überlastet (HTTP ' + status + '). Ich habe es mehrfach und mit einem zweiten Modell versucht. Bitte in ein paar Minuten nochmal scannen oder manuell eintragen.';
  return `Gemini-Fehler (HTTP ${status}).`;
}

// Zweites Modell als Ausweichlösung, falls das gewählte überlastet oder abgeschaltet ist.
function fallbackFor(model) {
  return MODELS.find((m) => m.id !== model)?.id;
}

// input: { files: File[] (0..MAX_PHOTOS), hint: string }
// Wirft nie: liefert immer {ok, label, model, seconds} oder {ok:false, error, reason?}.
// reason: 'offline' | 'network' | 'overloaded' | 'other' – die ersten drei lassen sich später wiederholen.
export async function analyzeFood({ files = [], hint = '' }, apiKey, model = DEFAULT_MODEL) {
  if (!apiKey) return { ok: false, error: 'Kein Gemini-Key hinterlegt.' };
  const text = hint.trim();
  if (!files.length && text.length < 3) return { ok: false, error: 'Bitte ein Foto hinzufügen oder das Essen beschreiben.' };
  if (files.length > MAX_PHOTOS) return { ok: false, error: `Maximal ${MAX_PHOTOS} Fotos pro Eintrag.` };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, reason: 'offline', error: 'Du bist offline. Die Auswertung braucht Internet.' };
  }
  const started = performance.now();
  const primary = model || DEFAULT_MODEL;
  try {
    const parts = [{ text: PROMPT }];
    for (const file of files) {
      const blob = await resizeImage(file);
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: await toBase64(blob) } });
    }
    if (text) parts.push({ text: `Hinweis des Nutzers: ${text}` });
    const body = JSON.stringify({
      contents: [{ parts }],
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
    if (!r.ok) return { ok: false, reason: r.status >= 500 ? 'overloaded' : 'other', error: httpError(r.status, r.model) };
    const parsed = parseLabelResponse(r.json);
    return parsed.ok ? { ...parsed, model: r.model, seconds: (performance.now() - started) / 1000 } : parsed;
  } catch (e) {
    return { ok: false, reason: 'network', error: 'Die Auswertung ist fehlgeschlagen (Netzwerk oder Bild). Bitte erneut versuchen.' };
  }
}
