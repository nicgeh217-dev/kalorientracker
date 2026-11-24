import { el } from '../dom.js';
import { getSettings, saveSettings } from '../db.js';
import { BUILD } from '../build-info.js';
import { checkForUpdate, shouldCheck, shouldShow } from '../update-check.js';

// Update-Hinweis der Android-App (siehe update-check.js). Prüft beim Start und bei der Rückkehr, höchstens alle 12 Stunden.
// "Später" merkt sich die Version: Sie kommt nicht wieder, erst eine neuere.

async function saveUpdate(patch) {
  const s = await getSettings();
  await saveSettings({ ...s, update: { ...(s.update ?? {}), ...patch } });
}

// Download im Browser öffnen: Ein Link mit Ziel _blank übergibt ihn in der Android-App an den Systembrowser.
function openLink(url) {
  const a = el('a', { href: url, target: '_blank', rel: 'noopener', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
}

function showBanner(update) {
  document.getElementById('app-update-banner')?.remove();
  const banner = el('div', { id: 'app-update-banner', class: 'toast', role: 'status', style: 'bottom:calc(env(safe-area-inset-bottom) + 96px)' },
    el('span', {}, `${update.name} ist da`),
    el('button', { onClick: () => { openLink(update.apkUrl); banner.remove(); } }, 'Laden'),
    el('button', { onClick: async () => { await saveUpdate({ dismissedBuild: update.build }); banner.remove(); } }, 'Später'));
  document.body.append(banner);
}

// still: nur anzeigen, wenn es etwas Neues gibt. Sonst (Knopf in den Einstellungen) kommt immer eine Rückmeldung.
export async function runUpdateCheck({ force = false, now = Date.now(), current = BUILD } = {}) {
  const s = await getSettings();
  if (!force && !shouldCheck(s.update?.lastCheckAt ?? null, now)) return { ok: true, skipped: true };
  const r = await checkForUpdate({ current });
  if (r.ok) await saveUpdate({ lastCheckAt: now });
  if (r.ok && r.update && (force || shouldShow(r.update, s.update?.dismissedBuild ?? null))) showBanner(r.update);
  return r;
}

// Abschnitt in den Einstellungen: Nummer und Knopf zum Nachsehen.
export function updateCard() {
  const msg = el('div', { class: 'muted', style: 'margin-top:8px' });
  const button = el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Nach Update suchen');
  button.addEventListener('click', async () => {
    button.disabled = true;
    msg.textContent = '';
    const r = await runUpdateCheck({ force: true });
    msg.textContent = !r.ok ? `Das hat nicht geklappt: ${r.error}` : r.update ? `${r.update.name} gefunden.` : BUILD > 0 ? 'Du hast die neueste Version.' : 'Entwicklungsstand: Die Suche ist hier nicht aktiv.';
    button.disabled = false;
  });
  return el('div', { class: 'card' },
    el('h2', { style: 'margin:0 0 6px' }, 'App-Version'),
    el('div', {}, BUILD > 0 ? `Version ${BUILD}` : 'Entwicklungsstand'),
    button, msg);
}
