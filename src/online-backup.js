import { buildBackup } from './backup.js';
import { restoreFromText } from './backup-import.js';
import { encryptText, decryptText } from './crypto-backup.js';
import { createGist, updateGist, readGist } from './gist.js';

const DAY_MS = 24 * 3600 * 1000;
export const MIN_PASSPHRASE = 8;

// Kurzer Fingerabdruck der sicherungsrelevanten Daten (FNV-1a), damit nur bei Änderungen hochgeladen wird.
export function dataFingerprint(data) {
  const text = JSON.stringify(buildBackup(data, new Date(0)));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${text.length}-${h.toString(16)}`;
}

const hasAnyData = (d) => Boolean(d.meals.length || d.products.length || d.weights.length || d.workouts?.length || d.days?.length);

// Fällig: eingerichtet, Daten vorhanden, seit der letzten Sicherung etwas geändert und mindestens 24 Stunden her.
export function isBackupDue({ config, fingerprint, hasData, now }) {
  if (!config?.token || !config?.gistId || !config?.passphrase || !hasData) return false;
  if (config.lastFingerprint === fingerprint) return false;
  return config.lastAt == null || now - config.lastAt >= DAY_MS;
}

async function encryptedBackup(deps, passphrase) {
  const data = await deps.exportAll();
  const text = JSON.stringify(buildBackup(data, new Date(deps.now())));
  return { data, content: await encryptText(text, passphrase) };
}

const saveConfig = async (deps, patch) => {
  const s = await deps.getSettings();
  await deps.saveSettings({ ...s, onlineBackup: { ...(s.onlineBackup ?? {}), ...patch } });
};

export async function runOnlineBackup(deps) {
  const config = (await deps.getSettings()).onlineBackup;
  if (!config?.token || !config?.gistId || !config?.passphrase) return { ok: false, error: 'Die Online-Sicherung ist nicht eingerichtet.' };
  try {
    const { data, content } = await encryptedBackup(deps, config.passphrase);
    const r = await updateGist(config.token, config.gistId, content, deps.fetchFn);
    if (!r.ok) {
      await saveConfig(deps, { lastError: r.error });
      return r;
    }
    await saveConfig(deps, { lastAt: deps.now(), lastFingerprint: dataFingerprint(data), lastError: null });
    return { ok: true };
  } catch {
    await saveConfig(deps, { lastError: 'Die Sicherung konnte nicht erstellt werden.' });
    return { ok: false, error: 'Die Sicherung konnte nicht erstellt werden.' };
  }
}

// Beim Öffnen der App: sichert nur, wenn fällig. Gibt nie einen Fehler nach oben, ein Problem steht in den Einstellungen.
export async function maybeAutoBackup(deps) {
  try {
    const config = (await deps.getSettings()).onlineBackup;
    if (!config) return { ok: false, skipped: true };
    const data = await deps.exportAll();
    if (!isBackupDue({ config, fingerprint: dataFingerprint(data), hasData: hasAnyData(data), now: deps.now() })) return { ok: false, skipped: true };
    return await runOnlineBackup(deps);
  } catch {
    return { ok: false, skipped: true };
  }
}

export async function setupOnlineBackup(deps, { token, passphrase }) {
  if (!token?.trim()) return { ok: false, error: 'Bitte ein GitHub-Token eingeben.' };
  if ((passphrase ?? '').length < MIN_PASSPHRASE) return { ok: false, error: `Das Passwort braucht mindestens ${MIN_PASSPHRASE} Zeichen.` };
  const { data, content } = await encryptedBackup(deps, passphrase);
  const r = await createGist(token.trim(), content, deps.fetchFn);
  if (!r.ok) return r;
  await saveConfig(deps, { token: token.trim(), gistId: r.id, passphrase, lastAt: deps.now(), lastFingerprint: dataFingerprint(data), lastError: null });
  return { ok: true, gistId: r.id };
}

// Holt die Sicherung, entschlüsselt sie, ersetzt die Daten und schaltet die Online-Sicherung wieder ein.
export async function restoreOnline(deps, { token, gistId, passphrase }, replace, fetchFn = deps.fetchFn) {
  const read = await readGist(token?.trim(), gistId?.trim(), fetchFn);
  if (!read.ok) return read;
  const plain = await decryptText(read.text, passphrase);
  if (!plain.ok) return plain;
  const r = await restoreFromText(plain.text, replace);
  if (!r.ok) return r;
  await saveConfig(deps, { token: token.trim(), gistId: gistId.trim(), passphrase, lastAt: deps.now(), lastFingerprint: dataFingerprint(await deps.exportAll()), lastError: null });
  return r;
}
