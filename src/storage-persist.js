// Persistenter Speicher: Chrome schützt die Daten der App dann vor automatischem Entfernen bei Platzmangel.
// Chrome entscheidet selbst (installierte App, Lesezeichen, Nutzung). Ein bewusstes "Cookies und Websitedaten löschen" schützt das nicht sicher.

const defaultStorage = () => globalThis.navigator?.storage;

export async function requestPersistence(storage = defaultStorage()) {
  if (typeof storage?.persist !== 'function') return 'unsupported';
  try {
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function persistenceStatus(storage = defaultStorage()) {
  if (typeof storage?.persisted !== 'function') return 'unsupported';
  try {
    return (await storage.persisted()) ? 'granted' : 'not-granted';
  } catch {
    return 'unsupported';
  }
}
