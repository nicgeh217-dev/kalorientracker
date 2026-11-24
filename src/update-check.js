// Update-Hinweis der Android-App: fragt bei GitHub nach der neuesten veröffentlichten Version (Release "app-<Nummer>")
// und meldet, wenn sie neuer ist als die installierte. Die App lädt nichts selbst: Der Link öffnet den Download im Browser.

export const RELEASES_URL = 'https://api.github.com/repos/nicgeh217-dev/kalorientracker/releases/latest';
const CHECK_EVERY_MS = 12 * 3600 * 1000;
const isGithub = (url) => typeof url === 'string' && /^https:\/\/github\.com\//.test(url);

export function parseRelease(json) {
  const build = Number(String(json?.tag_name ?? '').match(/^app-(\d+)$/)?.[1]);
  const apk = (json?.assets ?? []).find((a) => /\.apk$/i.test(a?.name ?? '') && isGithub(a?.browser_download_url));
  if (!Number.isFinite(build) || !apk) return null;
  return { build, name: json.name ?? `Version ${build}`, apkUrl: apk.browser_download_url, pageUrl: isGithub(json.html_url) ? json.html_url : null, notes: json.body ?? '' };
}

// current 0 = Entwicklungsstand ohne Nummer (lokal gebaut): meldet nie.
export const isNewer = (latestBuild, current) => current > 0 && latestBuild > current;

// Nach einem Fehler (z. B. Limit bei GitHub) eine Stunde Pause, sonst würde jede Rückkehr in die App erneut fragen.
const RETRY_AFTER_FAIL_MS = 3600 * 1000;
export const shouldCheck = (lastCheckAt, now, lastFailAt = null) => {
  if (lastFailAt != null && now - lastFailAt < RETRY_AFTER_FAIL_MS) return false;
  return lastCheckAt == null || now - lastCheckAt >= CHECK_EVERY_MS;
};

// Eine Version, die weggeklickt wurde, kommt nicht wieder. Eine noch neuere schon.
export const shouldShow = (update, dismissedBuild) => Boolean(update) && update.build !== dismissedBuild;

// Wirft nie: {ok, update} (update null, wenn nichts Neues da ist) oder {ok:false, error}.
export async function checkForUpdate({ current, fetchFn = (...a) => fetch(...a) }) {
  try {
    const res = await fetchFn(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return { ok: false, error: `GitHub antwortet mit ${res.status}.` };
    const latest = parseRelease(await res.json());
    return { ok: true, update: latest && isNewer(latest.build, current) ? latest : null };
  } catch {
    return { ok: false, error: 'Keine Verbindung zu GitHub.' };
  }
}
