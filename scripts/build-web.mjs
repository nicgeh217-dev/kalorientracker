// Kopiert die Web-App unverändert in den Ordner `www`, den Capacitor in die Android-App packt.
// Die Quelle bleibt der Repo-Wurzel-Ordner: Die PWA und die App teilen sich denselben Code.
// Nicht kopiert: sw.js (die App braucht keinen Service Worker, sie liefert die Dateien selbst), Tests, Doku.
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'www';
// privacypolicy.html: Datenschutzseite, die Health Connect im Erlaubnis-Dialog anzeigt.
const ITEMS = ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'fonts', 'icons', 'privacypolicy.html'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const item of ITEMS) cpSync(item, `${OUT}/${item}`, { recursive: true });
// Auf GitHub gesetzt (Nummer des Laufs): Die Kopie der App kennt ihre Versionsnummer für den Update-Hinweis.
const build = Number(process.env.BUILD_NUMBER);
if (Number.isInteger(build) && build > 0) {
  writeFileSync(`${OUT}/src/build-info.js`, `// Von scripts/build-web.mjs geschrieben.\nexport const BUILD = ${build};\n`);
}
console.log(`Web-App nach ${OUT}/ kopiert (${ITEMS.join(', ')}).`);
