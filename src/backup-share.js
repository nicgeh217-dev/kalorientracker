import { exportAll, getSettings, saveSettings } from './db.js';
import { buildBackup } from './backup.js';
import { localDateKey } from './logic.js';

async function makeBackupFile(type) {
  const backup = buildBackup(await exportAll(), new Date());
  return new File([JSON.stringify(backup, null, 2)], `kalorientracker-${localDateKey(new Date())}.json`, { type });
}

async function markBackedUp() {
  await saveSettings({ ...(await getSettings()), lastBackupAt: new Date().toISOString(), backupSnoozedUntil: null });
}

export async function downloadBackup() {
  const file = await makeBackupFile('application/json');
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  await markBackedUp();
}

// Öffnet das Teilen-Menü des Handys (z. B. Google Drive, E-Mail, Messenger). Ohne Teilen-Funktion wird heruntergeladen.
// Ergebnis: 'shared' | 'downloaded' | 'cancelled'
export async function shareBackup() {
  if (navigator.share && navigator.canShare) {
    // Manche Browser erlauben application/json nicht als Teilen-Datei, text/plain dagegen schon.
    for (const type of ['application/json', 'text/plain']) {
      const file = await makeBackupFile(type);
      if (!navigator.canShare({ files: [file] })) continue;
      try {
        await navigator.share({ files: [file], title: 'Kalorientracker-Sicherung' });
        await markBackedUp();
        return 'shared';
      } catch (e) {
        if (e?.name === 'AbortError') return 'cancelled';
        break;
      }
    }
  }
  await downloadBackup();
  return 'downloaded';
}
