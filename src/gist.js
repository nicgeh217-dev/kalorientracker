// Dünner Zugriff auf die GitHub-Gist-API für die verschlüsselte Online-Sicherung. `fetchFn` ist austauschbar (Tests).
export const FILE_NAME = 'kalorientracker-backup.json';
const API = 'https://api.github.com/gists';

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
});

function failure(status) {
  if (status === 401 || status === 403) return 'GitHub lehnt das Token ab. Prüfe, ob es abgelaufen ist und die Berechtigung „gist“ hat.';
  if (status === 404) return 'Das Gist wurde nicht gefunden. Prüfe die Gist-Nummer und ob das Token zu deinem GitHub-Konto gehört.';
  if (status === 429) return 'GitHub bremst gerade. Versuche es später noch einmal.';
  return `GitHub hat mit Fehler ${status} geantwortet.`;
}

async function call(fetchFn, url, init) {
  try {
    const res = await fetchFn(url, init);
    return res.ok ? { ok: true, res } : { ok: false, error: failure(res.status) };
  } catch {
    return { ok: false, error: 'Keine Verbindung zum Internet oder zu GitHub.' };
  }
}

export async function createGist(token, content, fetchFn = fetch) {
  if (!token) return { ok: false, error: 'Bitte ein GitHub-Token eingeben.' };
  const r = await call(fetchFn, API, {
    method: 'POST', headers: headers(token),
    body: JSON.stringify({ description: 'Kalorientracker Sicherung (verschlüsselt)', public: false, files: { [FILE_NAME]: { content } } }),
  });
  if (!r.ok) return r;
  const body = await r.res.json();
  return body?.id ? { ok: true, id: body.id } : { ok: false, error: 'GitHub hat keine Gist-Nummer geliefert.' };
}

export async function updateGist(token, id, content, fetchFn = fetch) {
  if (!token || !id) return { ok: false, error: 'Token oder Gist-Nummer fehlt.' };
  const r = await call(fetchFn, `${API}/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: headers(token), body: JSON.stringify({ files: { [FILE_NAME]: { content } } }),
  });
  return r.ok ? { ok: true } : r;
}

export async function readGist(token, id, fetchFn = fetch) {
  if (!token || !id) return { ok: false, error: 'Token oder Gist-Nummer fehlt.' };
  const r = await call(fetchFn, `${API}/${encodeURIComponent(id)}`, { method: 'GET', headers: headers(token) });
  if (!r.ok) return r;
  const file = (await r.res.json())?.files?.[FILE_NAME];
  if (!file) return { ok: false, error: 'In diesem Gist liegt keine Kalorientracker-Sicherung.' };
  if (!file.truncated) return { ok: true, text: file.content ?? '' };
  const raw = await call(fetchFn, file.raw_url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  return raw.ok ? { ok: true, text: await raw.res.text() } : raw;
}
