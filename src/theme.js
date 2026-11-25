// Design-Systeme der Android-App. Jedes ist ein Satz Farben, Radien und Schriftregeln in themes.css,
// eingeschaltet über <html data-theme="...">. "klar" ist der Standard und folgt hell/dunkel des Handys.
// Die Wahl liegt in den Einstellungen (kommt mit in die Sicherung) und zusätzlich in localStorage,
// damit index.html sie schon vor dem ersten Bild setzen kann (kein Aufblitzen im falschen Design).

export const THEMES = [
  { id: 'klar', label: 'Klar', note: 'Ruhig und hell, nachts dunkel wie dein Handy', swatch: ['#f3f4f8', '#ffffff', '#14151a', '#f2711c'], bar: '#f3f4f8' },
  { id: 'nacht', label: 'Nacht', note: 'Tiefschwarz, große Zahlen, schont den Akku', swatch: ['#000000', '#141416', '#ffffff', '#ff7a1a'], bar: '#000000' },
  { id: 'konbini', label: 'Konbini', note: 'Kräftige Farben, klare Kanten wie im Laden', swatch: ['#eaf1ff', '#ffffff', '#111111', '#ff6a00'], bar: '#eaf1ff' },
  { id: 'wald', label: 'Wald', note: 'Dunkles Grün, warmes Fuchs-Orange', swatch: ['#0d1711', '#16241b', '#eaf2e6', '#ff8a3d'], bar: '#0d1711' },
];

export const themeId = (value) => (THEMES.some((t) => t.id === value) ? value : 'klar');

export function applyTheme(value, { root = globalThis.document?.documentElement, storage = globalThis.localStorage, meta = globalThis.document?.querySelector?.('meta[name="theme-color"]') } = {}) {
  const id = themeId(value);
  if (root) {
    if (id === 'klar') delete root.dataset.theme;
    else root.dataset.theme = id;
  }
  try {
    storage?.setItem('theme', id);
  } catch {
    // Ohne Speicher gilt die Wahl bis zum Neustart, beim nächsten Start setzt app.js sie aus den Einstellungen.
  }
  meta?.setAttribute('content', THEMES.find((t) => t.id === id).bar);
  return id;
}
