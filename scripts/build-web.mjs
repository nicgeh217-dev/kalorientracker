// Kopiert die Web-App unverändert in den Ordner `www`, den Capacitor in die Android-App packt.
// Die Quelle bleibt der Repo-Wurzel-Ordner: Die PWA und die App teilen sich denselben Code.
// Nicht kopiert: sw.js (die App braucht keinen Service Worker, sie liefert die Dateien selbst), Tests, Doku.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const OUT = 'www';
const ITEMS = ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'fonts', 'icons'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const item of ITEMS) cpSync(item, `${OUT}/${item}`, { recursive: true });
console.log(`Web-App nach ${OUT}/ kopiert (${ITEMS.join(', ')}).`);
