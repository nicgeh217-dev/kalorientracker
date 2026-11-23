import { el, openSheet, closeSheet } from '../dom.js';
import { getSettings, saveSettings } from '../db.js';
import { askInsights } from '../gemini.js';
import { computeFindings, allowedNumbers, checkHint, fallbackSentences } from '../insights.js';
import { enabledMetrics } from '../health-metrics.js';

// Karte "Zusammenhänge" im Verlauf. Nur auf Knopfdruck. Die App rechnet, Gemini formuliert freundlich (siehe insights.js).
// Ergebnis bleibt im Gerätezustand settings.insights, nicht in der Sicherung.

const when = (ms) => new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const EMPTY_TEXT = 'Noch keine klaren Zusammenhänge. Mit mehr eingetragenen Tagen und Werten wird das besser.';

async function saveInsights(patch) {
  const s = await getSettings();
  await saveSettings({ ...s, insights: { ...(s.insights ?? {}), ...patch } });
}

// Was an Gemini geht, in Worten. Beim ersten Mal zur Bestätigung.
function confirmSend(findings) {
  return new Promise((resolve) => {
    openSheet(
      el('h1', {}, 'Was an Gemini geht'),
      el('div', {}, 'Die App hat diese Vergleiche aus deinen letzten 8 Wochen berechnet. Gemini bekommt nur diese Zahlen, keine einzelnen Tage, keine Mahlzeiten und kein Gewicht.'),
      el('ul', { class: 'muted' }, ...findings.map((f) => el('li', {}, `${f.text}: ${f.a.label} und ${f.b.label}`))),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onClick: () => { closeSheet(); resolve(false); } }, 'Abbrechen'),
        el('button', { class: 'primary', onClick: () => { closeSheet(); resolve(true); } }, 'Verstanden, finden')));
  });
}

async function find(data, button, rerender) {
  button.disabled = true;
  button.textContent = 'Wird gesucht …';
  try {
    const settings = await getSettings();
    const findings = computeFindings({ ...data, enabled: enabledMetrics(settings) });
    if (!findings.length) {
      await saveInsights({ at: Date.now(), observations: [], suggestions: [], fallback: [], note: EMPTY_TEXT });
      return;
    }
    if (!settings.insights?.consented) {
      if (!(await confirmSend(findings))) return;
      await saveInsights({ consented: true });
    }
    const fallback = fallbackSentences(findings);
    const r = await askInsights(findings, settings.geminiKey, settings.geminiModel || undefined);
    if (!r.ok) {
      await saveInsights({ at: Date.now(), observations: [], suggestions: [], fallback, note: `${r.error} Hier sind die Zahlen der App ohne Gemini.` });
      return;
    }
    // Hinweise mit fremden Zahlen oder Druck-Wörtern fallen weg.
    const allowed = allowedNumbers(findings);
    const observations = r.observations.filter((o) => checkHint(`${o.title} ${o.text}`, allowed));
    const suggestions = r.suggestions.filter((s) => checkHint(s.text, allowed));
    await saveInsights({ at: Date.now(), observations, suggestions, fallback, note: null });
  } finally {
    rerender();
  }
}

export function insightsCard(settings, data, rerender) {
  const state = settings.insights ?? {};
  const button = el('button', { class: state.at ? 'btn' : 'primary', style: 'width:100%;margin-top:12px' }, state.at ? 'Neu finden' : 'Zusammenhänge finden');
  button.addEventListener('click', () => find(data, button, rerender));

  const hasHints = state.observations?.length || state.suggestions?.length;
  const body = !state.at ? [el('div', { class: 'muted', style: 'margin-top:4px' }, 'Die App vergleicht deine letzten 8 Wochen: Essen, Training, Schlaf und Puls. Gemini formuliert daraus Beobachtungen und Vorschläge.')]
    : [
        ...(state.note ? [el('div', { class: 'muted', style: 'margin-top:8px' }, state.note)] : []),
        ...(hasHints
          ? [
              ...(state.observations ?? []).map((o) => el('div', { class: 'insight' }, el('b', {}, o.title), el('div', {}, o.text))),
              ...(state.suggestions?.length ? [el('div', { class: 'insight-head' }, 'Vorschläge'), ...state.suggestions.map((s) => el('div', { class: 'insight' }, s.text))] : []),
              el('div', { class: 'muted', style: 'margin-top:8px' }, 'Ein Zusammenhang ist keine Ursache. Nimm mit, was für dich passt.'),
            ]
          : (state.fallback ?? []).map((t) => el('div', { class: 'insight' }, t))),
        el('div', { class: 'muted', style: 'margin-top:8px' }, `Stand vom ${when(state.at)}`),
      ];
  return el('div', { class: 'card' }, el('b', {}, 'Zusammenhänge'), ...body, button);
}
