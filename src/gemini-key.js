// Bereinigt einen eingefügten Gemini-Schlüssel (Leerzeichen, Zeilenumbruch, Anführungszeichen vom Kopieren).
export function cleanGeminiKey(text) {
  const key = String(text ?? '').trim().replace(/^["'„“]+|["'“”]+$/g, '').trim();
  if (key.length < 30 || /\s/.test(key)) {
    return { ok: false, error: 'Das sieht nicht nach einem vollständigen Schlüssel aus. Kopiere ihn komplett aus Google AI Studio (er beginnt meist mit „AIza“).' };
  }
  return { ok: true, key };
}
