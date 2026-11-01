# Android-App (Capacitor) im Vergleich zur PWA

Zweig `native`. Die PWA auf `main` bleibt unverändert live. Die App verpackt denselben Web-Code (Ordner `src`, `index.html`, `styles.css`) per Capacitor in eine Android-App. `scripts/build-web.mjs` kopiert ihn nach `www/`, `npx cap sync android` übernimmt ihn in das Android-Projekt.

## APK bekommen
1. GitHub → Repo → **Actions** → „Android-APK bauen“ → neuester Lauf → unten **Artifacts** → `kalorientracker-debug-apk` herunterladen (ZIP, darin `app-debug.apk`).
2. Auf dem Pixel öffnen, „Installation aus unbekannten Quellen“ für den Browser/Dateimanager erlauben, installieren.
3. Die Debug-APK ist mit einem Debug-Schlüssel signiert. Play Protect kann warnen, das ist normal.

## Daten umziehen
Die App hat einen eigenen Speicher, getrennt von der PWA in Chrome. Weg: Online-Sicherung der PWA (Einstellungen → Online-Sicherung → Jetzt sichern), in der App auf „Heute“ → „Aus Online-Sicherung“ (Token, Gist-Nummer, Passwort). Den Gemini-Schlüssel in der App neu eintragen.

## Vergleich (Stand Phase 1)
| | PWA (`main`) | Android-App (`native`) |
|---|---|---|
| Installation | Zum Startbildschirm hinzufügen | APK installieren |
| Updates | automatisch (Neu laden) | neue APK nötig |
| Offline | Service Worker | Dateien liegen in der App |
| Kamera/Galerie | Datei-Dialog des Browsers | Datei-Dialog der WebView (CAMERA-Berechtigung deklariert) |
| Kurzbefehle auf dem Icon | ja | **nicht übernommen** |
| „Teilen in die App“ | ja | **nicht übernommen** |
| Backup als Datei | Download / Teilen-Menü | **ungeprüft**, in der WebView können Datei-Downloads fehlen (Online-Sicherung geht) |
| Strichcode scannen | nein | ja (Eintragen-Menü und Produkt bearbeiten) |
| Feste Erinnerungen | nein | Phase 2 |
| Koreanische Datenbank ohne CORS | nein | Phase 3 (nur nach positivem Test) |
| iPhone | PWA | nicht gebaut (kein Mac, kein Apple-Konto) |

## Prüfliste auf dem Pixel
- Start, Splash-Animation, Heute, Training, Verlauf: sieht alles wie in der PWA aus?
- Foto aufnehmen und Aus Galerie: öffnet die Kamera, kommt das Foto an, Auswertung klappt?
- Eintragen-Menü und Formulare: scrollt der Hintergrund?
- Drag and Drop der Mahlzeiten, Pausen-Timer mit Vibration.
- Online-Sicherung: einrichten, „Jetzt sichern“, Wiederherstellen.
- Sicherung als Datei: funktioniert „Als Datei speichern“ und „Sicherung teilen“?
- Zurück-Taste, App im Hintergrund und wieder öffnen.

## Strichcode (nur Android-App)
- **Eintragen-Menü → Strichcode scannen:** 1. eigene Produkte (sofort, offline), 2. Open Food Facts (Werte pro 100 g, Name deutsch wenn vorhanden), 3. unbekannt: Nährwerttabelle fotografieren, Beschreiben oder Manuell, der Code wird mit dem Produkt gespeichert.
- **Mehr → Gespeicherte Produkte → ✎ → Strichcode:** scannen oder per Hand eintippen. Ungültige Codes (Prüfziffer) und doppelte Zuordnung werden abgelehnt.
- Beim ersten Scan lädt Android ein kleines Google-Modul nach (einmalig, braucht Internet).
- Prüfliste: Eigenes Produkt zuordnen und erneut scannen. Ein Markenprodukt aus Deutschland scannen (Open Food Facts). Ein koreanisches Produkt scannen (vermutlich unbekannt, dann Foto).
