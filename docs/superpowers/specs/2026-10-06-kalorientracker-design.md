# Kalorientracker (PWA) – Design

Datum: 2026-10-06

## Ziel
Persönliche Handy-App für das Auslandssemester in Südkorea. Mahlzeiten werden getrackt, indem die Nährwerttabelle eines Produkts fotografiert wird; die Werte werden automatisch ausgelesen. Zusätzlich wird das Körpergewicht getrackt. Das Kalorienziel berechnet der Nutzer selbst und trägt es ein.

## Rahmenbedingungen
- Nutzer: eine Person, Pixel 10 Pro XL (Android, Chrome).
- Etiketten überwiegend koreanisch (Hangul).
- Kein Account, kein Backend. Alle Daten lokal auf dem Gerät.
- Hosting: GitHub Pages (HTTPS, nötig für Kamera und PWA-Installation). Repo ist öffentlich, Daten und API-Key nie im Repo.
- Fotoerkennung: Gemini-API mit dem eigenen Key des Nutzers, in den Einstellungen eingegeben und nur lokal gespeichert.
- Getrackt werden: kcal, Protein, Kohlenhydrate, Fett.

## Technik
- Reine PWA: HTML, CSS, JavaScript (ES-Module), kein Framework, kein Build-Schritt.
- Speicherung: IndexedDB.
- Service Worker + Manifest für Installation und Offline-Betrieb (außer Foto-Scan).
- Tests der reinen Logik mit Node (`node --test`).

## Bildschirme
1. **Heute:** Fortschritt kcal (verbraucht / Ziel), Summen Protein / KH / Fett, Liste der heutigen Mahlzeiten, Button „Foto scannen“, Button „Manuell“.
2. **Scan/Eintrag:** Kamera oder Foto wählen → Erkennung → bearbeitbares Formular (Name, Bezugsgröße, kcal, P, KH, F, Menge) → Speichern. Fehlende Werte sind markiert.
3. **Produkte:** Liste gescannter Produkte; Auswahl legt direkt eine Mahlzeit an, ohne neuen Scan.
4. **Gewicht:** Eintrag pro Tag (kg), Liniendiagramm über die Zeit.
5. **Einstellungen:** Kalorienziel, Gemini-Key, JSON-Export/-Import.

## Daten (IndexedDB)
- `products`: id, name, basis (`per100g` | `perServing`), servingGrams, kcal, protein, carbs, fat.
- `meals`: id, timestamp, productId, Menge, umgerechnete Werte (beim Speichern eingefroren).
- `weights`: date (Schlüssel, ein Eintrag pro Tag), kg.
- `settings`: calorieGoal, geminiKey.

## Fotoerkennung
- Foto wird vor dem Senden auf ca. 1600 px Kantenlänge verkleinert.
- Fester Prompt, Antwort als JSON mit festem Schema: Produktname, Bezugsgröße, servingGrams, kcal, protein, carbs, fat. Nicht lesbare Werte = `null`, keine Schätzung.
- Umrechnung auf die gegessene Menge macht die App, nicht die KI.

## Fehlerbehandlung
- Offline / Key fehlt / Key ungültig / API-Fehler: klare Meldung, Fallback auf manuelle Eingabe. Rest der App bleibt nutzbar.
- `null`-Werte: Felder leer und markiert, kein stilles Speichern von 0.
- Unplausible Werte (z. B. > 900 kcal pro 100 g, Makros ergeben deutlich mehr kcal als angegeben): gelb markiert, Bestätigung nötig.

## Tests
- Node-Tests: Umrechnung (pro 100 g / pro Portion → Menge), Tagessummen, Plausibilitätsprüfung, Export/Import-Format.
- Manuelle Prüfung des Scans mit echten Fotos koreanischer Etiketten (Testbilder liefert der Nutzer).

## Nicht im Umfang (YAGNI)
Automatische Kalorienberechnung, Barcode-Scan, Produktdatenbank-Anbindung, Mehrbenutzer, Cloud-Sync, Zucker/Natrium, Benachrichtigungen.
