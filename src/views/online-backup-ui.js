import { el, openSheet, closeSheet, toast } from '../dom.js';
import { exportAll, getSettings, saveSettings, replaceAll } from '../db.js';
import { setupOnlineBackup, runOnlineBackup, restoreOnline, MIN_PASSPHRASE } from '../online-backup.js';
import { refreshCurrent } from '../nav.js';

export const liveDeps = {
  exportAll, getSettings, saveSettings, now: () => Date.now(), fetchFn: (...args) => fetch(...args),
};

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Kalorientracker';
const when = (ms) => new Date(ms).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Karte "Online-Sicherung" für die Einstellungen. rerender zeichnet die Einstellungen neu.
export function onlineBackupCard(settings, rerender) {
  const cfg = settings.onlineBackup;
  const msg = el('div');
  const say = (text, kind = 'warn') => msg.replaceChildren(el('div', { class: `note ${kind}` }, text));
  const busy = async (btn, work) => {
    btn.disabled = true;
    try { await work(); } finally { btn.disabled = false; }
  };

  if (!cfg?.gistId) {
    const token = el('input', { type: 'password', autocomplete: 'off', placeholder: 'ghp_ …', 'aria-label': 'GitHub-Token' });
    const pass = el('input', { type: 'password', autocomplete: 'new-password', placeholder: `Mindestens ${MIN_PASSPHRASE} Zeichen`, 'aria-label': 'Passwort für die Verschlüsselung' });
    const start = el('button', { class: 'primary', style: 'width:100%;margin-top:10px' }, 'Einrichten und jetzt sichern');
    start.addEventListener('click', () => busy(start, async () => {
      say('Wird eingerichtet …');
      const r = await setupOnlineBackup(liveDeps, { token: token.value, passphrase: pass.value });
      if (!r.ok) return say(r.error, 'bad');
      toast('Online-Sicherung ist eingerichtet.');
      return rerender();
    }));
    return el('div', { class: 'card', id: 'online-backup-card' },
      el('h2', { style: 'margin:0 0 6px' }, 'Online-Sicherung'),
      el('div', { class: 'muted' }, 'Sichert deine Daten verschlüsselt in ein privates GitHub-Gist, automatisch beim Öffnen der App (höchstens einmal am Tag, nur bei Änderungen). So überstehst du auch gelöschte Browserdaten oder ein neues Handy.'),
      el('div', { class: 'muted', style: 'margin-top:8px' }, 'Schritt 1: ',
        el('a', { href: TOKEN_URL, target: '_blank', rel: 'noopener' }, 'Token bei GitHub erzeugen'),
        ' (nur der Haken „gist“, Laufzeit nach Wunsch) und unten einfügen. Schritt 2: ein eigenes Passwort wählen. Es verschlüsselt die Daten auf deinem Handy, GitHub sieht nur Zufallstext.'),
      el('label', {}, 'GitHub-Token'), token,
      el('label', {}, 'Passwort für die Verschlüsselung'), pass,
      el('div', { class: 'note warn', style: 'margin-top:10px' }, 'Wichtig: Ohne dieses Passwort ist die Sicherung nicht lesbar, es gibt keine Rettung. Notiere dir Token, Gist-Nummer und Passwort außerhalb des Handys, z. B. im Passwort-Manager.'),
      msg, start,
      el('button', { class: 'btn', style: 'width:100%;margin-top:8px', onClick: () => openOnlineRestore({ onDone: rerender, confirmReplace: true }) }, 'Aus Online-Sicherung wiederherstellen'));
  }

  const now = el('button', { class: 'btn' }, 'Jetzt sichern');
  now.addEventListener('click', () => busy(now, async () => {
    say('Wird gesichert …');
    const r = await runOnlineBackup(liveDeps);
    if (!r.ok) say(r.error, 'bad'); else { toast('Online-Sicherung aktualisiert.'); rerender(); }
  }));
  const reveal = el('button', { class: 'btn' }, 'Zugangsdaten anzeigen');
  reveal.addEventListener('click', () => {
    openSheet(
      el('h1', {}, 'Zugangsdaten'),
      el('div', { class: 'muted', style: 'margin:-8px 4px 12px' }, 'Bewahre sie außerhalb des Handys auf. Nur damit kannst du auf einem neuen Handy wiederherstellen.'),
      el('div', { class: 'card' },
        el('div', { class: 'muted' }, 'Gist-Nummer'), el('div', { style: 'user-select:all;word-break:break-all' }, cfg.gistId),
        el('div', { class: 'muted', style: 'margin-top:10px' }, 'Token'), el('div', { style: 'user-select:all;word-break:break-all' }, cfg.token),
        el('div', { class: 'muted', style: 'margin-top:10px' }, 'Passwort'), el('div', { style: 'user-select:all;word-break:break-all' }, cfg.passphrase)),
      el('div', { class: 'actions' }, el('button', { class: 'btn wide', onClick: closeSheet }, 'Schließen')));
  });
  const off = el('button', { class: 'btn danger' }, 'Ausschalten');
  off.addEventListener('click', async () => {
    const { onlineBackup, ...rest } = await getSettings();
    await saveSettings(rest);
    toast('Online-Sicherung ausgeschaltet. Das Gist bei GitHub bleibt bestehen.');
    rerender();
  });
  return el('div', { class: 'card', id: 'online-backup-card' },
    el('h2', { style: 'margin:0 0 6px' }, 'Online-Sicherung'),
    el('div', { class: 'muted' }, cfg.lastAt ? `Aktiv. Zuletzt gesichert: ${when(cfg.lastAt)}.` : 'Aktiv. Noch nicht gesichert.'),
    cfg.lastError ? el('div', { class: 'note bad', style: 'margin-top:8px' }, `Letzter Versuch fehlgeschlagen: ${cfg.lastError}`) : null,
    el('div', { class: 'muted', style: 'margin-top:8px' }, 'Gesichert wird beim Öffnen der App, höchstens einmal am Tag und nur bei Änderungen.'),
    msg,
    el('div', { class: 'actions' }, now, reveal, off));
}

// Wiederherstellen aus dem Gist (z. B. auf einem neuen Handy). Auf einem leeren Handy ohne Rückfrage.
export function openOnlineRestore({ onDone = null, confirmReplace = false } = {}) {
  const token = el('input', { type: 'password', autocomplete: 'off', placeholder: 'ghp_ …', 'aria-label': 'GitHub-Token' });
  const gist = el('input', { placeholder: 'Gist-Nummer', autocomplete: 'off', 'aria-label': 'Gist-Nummer' });
  const pass = el('input', { type: 'password', autocomplete: 'off', placeholder: 'Passwort', 'aria-label': 'Passwort' });
  const msg = el('div');
  const go = el('button', { class: 'primary' }, 'Wiederherstellen');
  go.addEventListener('click', async () => {
    if (confirmReplace && !confirm('Alle aktuellen Daten durch die Online-Sicherung ersetzen?')) return;
    go.disabled = true;
    msg.replaceChildren(el('div', { class: 'note warn' }, 'Wird geholt …'));
    const r = await restoreOnline(liveDeps, { token: token.value, gistId: gist.value, passphrase: pass.value }, replaceAll);
    go.disabled = false;
    if (!r.ok) return msg.replaceChildren(el('div', { class: 'note bad' }, r.error));
    closeSheet();
    toast(`Wiederhergestellt: ${r.counts.meals} Mahlzeiten, ${r.counts.weights} Gewichtseinträge.`);
    await refreshCurrent();
    return onDone?.();
  });
  openSheet(
    el('h1', {}, 'Online-Sicherung einspielen'),
    el('label', {}, 'GitHub-Token'), token,
    el('label', {}, 'Gist-Nummer'), gist,
    el('label', {}, 'Passwort'), pass,
    msg,
    el('div', { class: 'actions' }, el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'), go));
}
