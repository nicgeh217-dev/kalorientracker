// Verschlüsselt die Sicherung auf dem Handy mit einem Passwort (PBKDF2 + AES-256-GCM, beides im Browser eingebaut).
// Ohne das Passwort ist die Datei nicht lesbar, es gibt keine Rettung.

const ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(text, passphrase) {
  if (!passphrase) throw new Error('Bitte ein Passwort eingeben.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS, salt: toB64(salt), iv: toB64(iv), data: toB64(data) });
}

export async function decryptText(envelopeText, passphrase) {
  let env;
  try {
    env = JSON.parse(envelopeText);
  } catch {
    return { ok: false, error: 'Die Sicherung ist keine gültige verschlüsselte Datei.' };
  }
  if (env?.v !== 1 || typeof env.salt !== 'string' || typeof env.iv !== 'string' || typeof env.data !== 'string') {
    return { ok: false, error: 'Die Sicherung ist keine gültige verschlüsselte Datei.' };
  }
  try {
    const key = await deriveKey(passphrase, fromB64(env.salt), Number.isInteger(env.iter) && env.iter > 0 ? env.iter : ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) }, key, fromB64(env.data));
    return { ok: true, text: dec.decode(plain) };
  } catch {
    return { ok: false, error: 'Das Passwort ist falsch oder die Sicherung ist beschädigt.' };
  }
}
