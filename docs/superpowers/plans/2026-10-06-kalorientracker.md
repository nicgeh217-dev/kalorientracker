# Kalorientracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine installierbare Handy-PWA, die Mahlzeiten per Foto der Nährwerttabelle (Gemini) erfasst, Kalorien und Makros pro Tag summiert und das Körpergewicht trackt.

**Architecture:** Statische PWA ohne Framework und ohne Build-Schritt. Reine Logik (`logic.js`, `backup.js`, `gemini-parse.js`) ist von UI und Browser-APIs getrennt und per Node getestet. Daten liegen in IndexedDB, Hosting auf GitHub Pages.

**Tech Stack:** HTML/CSS/JS (ES-Module), IndexedDB, Service Worker, Gemini REST API, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-06-kalorientracker-design.md`

## Global Constraints

- Nutzer: eine Person, Pixel 10 Pro XL, Chrome auf Android. UI-Sprache Deutsch.
- Kein Backend, kein Account. Alle Daten nur in IndexedDB auf dem Gerät.
- Gemini-Key wird nur in den Einstellungen eingegeben und nur in IndexedDB gespeichert. Nie im Code, nie im Repo.
- Getrackt werden genau: kcal, Protein, Kohlenhydrate, Fett.
- Nicht lesbare Werte sind `null`, nie geschätzt und nie stillschweigend 0.
- Das Kalorienziel trägt der Nutzer manuell ein, die App berechnet es nicht.
- Außer dem Foto-Scan muss alles offline funktionieren.
- Kein Barcode-Scan, keine Produktdatenbank, kein Cloud-Sync, kein Zucker/Natrium.
- Fotos werden vor dem Senden auf max. 1600 px Kantenlänge verkleinert.
- Plausibilität: mehr als 900 kcal pro 100 g ist verdächtig; Makros (4·P + 4·KH + 9·F) weichen mehr als 25 % von den angegebenen kcal ab ist verdächtig.

## Review Focus

- Etikett liefert kcal, aber Protein/KH/Fett sind `null`: Mahlzeit darf nur nach expliziter Bestätigung gespeichert werden, Tagessumme zählt `null` als 0 ohne Fehler.
- Etikett ist „pro Portion“ ohne Grammangabe, Nutzer gibt Menge in Gramm ein: App warnt, statt falsch umzurechnen.
- Gewicht mit Komma eingegeben („72,5“): wird als 72.5 gespeichert, Unsinn („abc“, 0, negativ) wird abgelehnt.
- Mahlzeit um 23:50 oder 00:10 Ortszeit: gehört zum richtigen lokalen Tag (nicht UTC).
- Import einer ungültigen oder fremden JSON-Datei: bestehende Daten bleiben unverändert.

---

### Task 1: Projektgerüst und PWA-Hülle

**Files:**
- Create: `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `src/app.js`, `icons/icon-192.png`, `icons/icon-512.png`, `package.json`, `.gitignore`

**Interfaces:**
- Produces: `src/app.js` exportiert `showView(name: 'today'|'scan'|'products'|'weight'|'settings'): void`; `index.html` hat je ein `<section id="view-<name>" hidden>` pro Ansicht und eine untere Navigationsleiste. Andere Tasks füllen die Sections.

- [ ] **Step 1:** `git init`; `package.json` mit `"type": "module"` und Script `"test": "node --test tests/"`; `.gitignore` mit `node_modules/`.
- [ ] **Step 2:** `manifest.webmanifest` (name „Kalorientracker“, `display: standalone`, `start_url: "./"`, beide Icons, Theme-Farbe). Icons einfach generieren (einfarbig mit Symbol).
- [ ] **Step 3:** `sw.js`: beim Install alle App-Dateien cachen, bei Fetch cache-first, Gemini-Requests (andere Origin) nie cachen. Cache-Name mit Versionsnummer, alte Caches beim Activate löschen.
- [ ] **Step 4:** `index.html` mit Viewport-Meta, fünf Sections, Bottom-Nav, Registrierung des Service Workers; `styles.css` mobil-first, Touch-Ziele mindestens 48 px.
- [ ] **Step 5:** Lokal prüfen: `npx serve .`, im Browser öffnen, Navigation wechselt die Ansichten, DevTools zeigt gültiges Manifest und aktiven Service Worker. Erwartet: keine Konsolenfehler.
- [ ] **Step 6:** Commit `chore: PWA-Gerüst`.

### Task 2: Nährwert-Logik

**Files:**
- Create: `src/logic.js`
- Test: `tests/logic.test.js`

**Interfaces:**
- Produces:
  - `scaleNutrition(product: {basis: 'per100g'|'perServing', servingGrams: number|null, kcal, protein, carbs, fat: number|null}, amount: {unit: 'g'|'servings', value: number}): {kcal, protein, carbs, fat: number|null} | {error: 'NO_SERVING_GRAMS'}`
  - `dayTotals(meals: {kcal, protein, carbs, fat: number|null}[]): {kcal, protein, carbs, fat: number}` (`null` zählt als 0)
  - `checkPlausibility(n: {basis, kcal, protein, carbs, fat}): string[]` (leere Liste = plausibel; Strings sind deutsche Warntexte)
  - `localDateKey(d: Date): string` im Format `YYYY-MM-DD` in Ortszeit

- [ ] **Step 1:** Tests schreiben, jeweils mit Zahlen:
  - `per100g` 250 kcal, 150 g → 375 kcal; Makros proportional, auf eine Nachkommastelle gerundet.
  - `perServing` 300 kcal, 2 servings → 600; `perServing` mit Menge in `g` und `servingGrams: 50`, 100 g → 600.
  - `perServing` mit `g` und `servingGrams: null` → `{error: 'NO_SERVING_GRAMS'}`.
  - `null`-Makro bleibt `null`; `dayTotals` summiert `null` als 0.
  - `checkPlausibility`: 950 kcal pro 100 g → Warnung; kcal 200 aber 4·P+4·KH+9·F = 400 → Warnung; passende Werte → `[]`.
  - `localDateKey(new Date(2026, 9, 6, 23, 50))` → `'2026-10-06'` und `new Date(2026, 9, 7, 0, 10)` → `'2026-10-07'`.
- [ ] **Step 2:** `node --test tests/logic.test.js`, erwartet FAIL (Modul fehlt).
- [ ] **Step 3:** Funktionen implementieren. Rundung auf 0.1, kcal auf ganze Zahl.
- [ ] **Step 4:** Test erneut, erwartet PASS.
- [ ] **Step 5:** Commit `feat: Nährwert-Logik`.

### Task 3: Backup-Format

**Files:**
- Create: `src/backup.js`
- Test: `tests/backup.test.js`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `buildBackup(data: {products, meals, weights, settings}, now: Date): {version: 1, exportedAt: string, products, meals, weights, settings}` (Settings ohne `geminiKey`)
  - `parseBackup(text: string): {ok: true, data} | {ok: false, error: string}`

- [ ] **Step 1:** Tests: `buildBackup` entfernt `geminiKey`; Roundtrip `parseBackup(JSON.stringify(buildBackup(...)))` ist `ok`; kaputtes JSON, falsche `version`, fehlendes Array (`meals` kein Array), Eintrag ohne `timestamp` → jeweils `{ok: false}` mit Fehlertext, und das Eingabeobjekt wird nicht verändert.
- [ ] **Step 2:** Test ausführen, erwartet FAIL.
- [ ] **Step 3:** Implementieren; `parseBackup` validiert Struktur streng und gibt bei Fehlern nie Teildaten zurück.
- [ ] **Step 4:** Test ausführen, erwartet PASS.
- [ ] **Step 5:** Commit `feat: Backup-Format`.

### Task 4: Speicherschicht (IndexedDB)

**Files:**
- Create: `src/db.js`

**Interfaces:**
- Consumes: `localDateKey` aus Task 2.
- Produces (alle `async`):
  - `addProduct(p): Promise<number>`, `listProducts(): Promise<Product[]>`, `updateProduct(p): Promise<void>`
  - `addMeal(m: {timestamp: string, dateKey: string, productId: number|null, name: string, amount, kcal, protein, carbs, fat}): Promise<number>`, `mealsForDate(dateKey: string): Promise<Meal[]>`, `deleteMeal(id): Promise<void>`
  - `setWeight(dateKey: string, kg: number): Promise<void>`, `listWeights(): Promise<{date, kg}[]>` (nach Datum sortiert)
  - `getSettings(): Promise<{calorieGoal: number|null, geminiKey: string|null}>`, `saveSettings(s): Promise<void>`
  - `exportAll(): Promise<{products, meals, weights, settings}>`, `replaceAll(data): Promise<void>` (eine Transaktion; bei Fehler bleibt alles unverändert)

- [ ] **Step 1:** Stores anlegen: `products` (autoIncrement), `meals` (autoIncrement, Index `dateKey`), `weights` (keyPath `date`), `settings` (ein Eintrag, Schlüssel `main`). DB-Name `kalorientracker`, Version 1.
- [ ] **Step 2:** Funktionen wie oben implementieren; `dateKey` wird beim Anlegen einer Mahlzeit aus der Ortszeit gesetzt, nicht aus dem ISO-String.
- [ ] **Step 3:** Prüfung im Browser über die DevTools-Konsole: Produkt und Mahlzeit anlegen, `mealsForDate` liefert sie, `setWeight` zweimal am selben Tag ergibt einen Eintrag. `replaceAll` mit einem absichtlich ungültigen Datensatz lässt die alten Daten unberührt.
- [ ] **Step 4:** Commit `feat: IndexedDB-Schicht`.

### Task 5: Gemini-Anbindung

**Files:**
- Create: `src/gemini-parse.js`, `src/gemini.js`
- Test: `tests/gemini-parse.test.js`

**Interfaces:**
- Produces:
  - `gemini-parse.js`: `parseLabelResponse(apiJson: object): {ok: true, label: {name: string|null, basis: 'per100g'|'perServing'|null, servingGrams: number|null, kcal, protein, carbs, fat: number|null}} | {ok: false, error: string}`
  - `gemini.js`: `resizeImage(file: File, maxEdge = 1600): Promise<Blob>`, `scanLabel(file: File, apiKey: string): Promise<ReturnType<typeof parseLabelResponse>>`

- [ ] **Step 1:** Tests für `parseLabelResponse` mit fest eingebauten Beispielantworten (`candidates[0].content.parts[0].text`):
  - gültiges JSON → `ok`, Werte übernommen;
  - JSON in ```json-Zaun → trotzdem `ok`;
  - Text kein JSON → `{ok:false}`;
  - Wert als String „250“ → 250; Wert „-“ oder leer → `null`;
  - `basis` unbekannt → `null`;
  - leere `candidates` / `promptFeedback.blockReason` → `{ok:false}` mit Text.
- [ ] **Step 2:** Test ausführen, erwartet FAIL.
- [ ] **Step 3:** `parseLabelResponse` implementieren.
- [ ] **Step 4:** Test ausführen, erwartet PASS.
- [ ] **Step 5:** `scanLabel` implementieren: POST an `https://generativelanguage.googleapis.com/v1beta/models/<MODEL>:generateContent` mit Header `x-goog-api-key`, Bild als `inlineData` (Base64), `generationConfig.responseMimeType = 'application/json'` und Antwortschema für die Felder von `label`. Prompt auf Deutsch/Englisch: koreanisches Etikett (열량, 탄수화물, 단백질, 지방), Bezugsgröße angeben, nicht Lesbares = `null`, nichts schätzen. Modellname und Request-Format vor dem Einbau in der aktuellen Gemini-Doku prüfen (Modellname als Konstante `MODEL` oben in der Datei). Netzwerkfehler, HTTP 400/403 (Key ungültig), 429 (Limit) werden zu `{ok:false, error}` mit deutschem Text; `scanLabel` wirft nie.
- [ ] **Step 6:** `resizeImage` per Canvas, Ausgabe JPEG Qualität 0.85, Kantenlänge höchstens 1600 px, Seitenverhältnis bleibt, kleinere Bilder werden nicht vergrößert.
- [ ] **Step 7:** Commit `feat: Gemini-Anbindung`.

### Task 6: Ansicht „Heute“ und manuelle Eingabe

**Files:**
- Create: `src/views/today.js`, `src/views/meal-form.js`
- Modify: `index.html`, `styles.css`, `src/app.js`

**Interfaces:**
- Consumes: `dayTotals`, `scaleNutrition`, `checkPlausibility`, `localDateKey` (Task 2); `mealsForDate`, `addMeal`, `deleteMeal`, `addProduct`, `getSettings` (Task 4).
- Produces: `meal-form.js` exportiert `openMealForm(prefill: Partial<Label> | null): void`; speichert Produkt plus Mahlzeit und ruft danach `renderToday()` auf. `today.js` exportiert `renderToday(): Promise<void>`.

- [ ] **Step 1:** `renderToday`: Fortschrittsbalken kcal verbraucht / Ziel (ohne Ziel: Hinweis „Ziel in Einstellungen eintragen“), Summen P/KH/F, Mahlzeitenliste mit Löschen (Rückfrage), Buttons „Foto scannen“ und „Manuell“.
- [ ] **Step 2:** `openMealForm`: Felder Name, Bezugsgröße (pro 100 g / pro Portion), Portionsgröße in g, kcal, P, KH, F, Menge mit Einheit. Fehlende Werte rot markiert. Bei `NO_SERVING_GRAMS` Hinweis und Speichern gesperrt. `checkPlausibility`-Warnungen gelb, Speichern erst nach Bestätigung. Sind P/KH/F leer, ebenfalls erst nach Bestätigung.
- [ ] **Step 3:** Prüfung im Browser: Produkt „Test“ (250 kcal / 100 g) mit 150 g eintragen → Heute zeigt 375 kcal; Seite neu laden, Eintrag bleibt; Eintrag löschen funktioniert; 950 kcal pro 100 g zeigt Warnung.
- [ ] **Step 4:** Commit `feat: Heute-Ansicht und manuelle Eingabe`.

### Task 7: Foto-Scan

**Files:**
- Create: `src/views/scan.js`
- Modify: `index.html`, `src/app.js`

**Interfaces:**
- Consumes: `scanLabel` (Task 5), `getSettings` (Task 4), `openMealForm` (Task 6).
- Produces: `scan.js` exportiert `startScan(): void` (öffnet `<input type="file" accept="image/*" capture="environment">`).

- [ ] **Step 1:** `startScan`: ohne Key Hinweis mit Sprung zu den Einstellungen; sonst Foto wählen, Ladeanzeige „Lese Etikett…“, `scanLabel` aufrufen.
- [ ] **Step 2:** Bei `ok` → `openMealForm(label)` mit den Werten, `null`-Felder bleiben leer und markiert. Bei Fehler Meldung mit Button „Manuell eintragen“ (`openMealForm(null)`) und „Nochmal“.
- [ ] **Step 3:** Offline: ohne Verbindung sofort Meldung, ohne langen Timeout.
- [ ] **Step 4:** Prüfung im Browser mit Testfoto und einem gültigen Key: Werte erscheinen im Formular. Mit falschem Key kommt die Fehlermeldung samt Fallback.
- [ ] **Step 5:** Commit `feat: Foto-Scan`.

### Task 8: Ansicht „Produkte“

**Files:**
- Create: `src/views/products.js`
- Modify: `index.html`, `src/app.js`

**Interfaces:**
- Consumes: `listProducts`, `updateProduct` (Task 4), `openMealForm` (Task 6).
- Produces: `renderProducts(): Promise<void>`. `openMealForm` akzeptiert zusätzlich ein Prefill mit `productId`, damit keine Duplikate entstehen.

- [ ] **Step 1:** Liste mit Suchfeld; Antippen öffnet `openMealForm` mit den Produktwerten, es muss nur die Menge eingegeben werden; Mahlzeit nutzt das bestehende Produkt statt ein neues anzulegen.
- [ ] **Step 2:** Produkt bearbeiten ändert keine bereits gespeicherten Mahlzeiten (Werte sind eingefroren).
- [ ] **Step 3:** Prüfung im Browser: Produkt aus Task 6 erscheint, zweite Mahlzeit damit ergibt kein zweites Produkt.
- [ ] **Step 4:** Commit `feat: Produktliste`.

### Task 9: Ansicht „Gewicht“

**Files:**
- Create: `src/weight-input.js`, `src/views/weight.js`
- Test: `tests/weight-input.test.js`
- Modify: `index.html`, `src/app.js`

**Interfaces:**
- Produces: `parseWeight(text: string): number | null` (Komma oder Punkt, gültig 20–400 kg, sonst `null`); `renderWeight(): Promise<void>`.

- [ ] **Step 1:** Tests: `'72,5'` → 72.5; `'72.5'` → 72.5; `' 80 '` → 80; `'abc'`, `''`, `'0'`, `'-5'`, `'1000'` → `null`.
- [ ] **Step 2:** Test ausführen, erwartet FAIL; `parseWeight` implementieren; erneut ausführen, erwartet PASS.
- [ ] **Step 3:** `renderWeight`: Eingabefeld mit Datum (Standard heute), Speichern per `setWeight` (überschreibt den Tag), SVG-Liniendiagramm über alle Einträge ohne Bibliothek, letzte Werte als Liste. Bei weniger als zwei Einträgen zeigt das Diagramm einen Hinweis statt einer Linie.
- [ ] **Step 4:** Prüfung im Browser: zwei Tage eintragen, Linie erscheint; „72,5“ wird als 72.5 gespeichert; „abc“ wird abgelehnt.
- [ ] **Step 5:** Commit `feat: Gewichtsverlauf`.

### Task 10: Einstellungen, Export und Import

**Files:**
- Create: `src/views/settings.js`
- Modify: `index.html`, `src/app.js`

**Interfaces:**
- Consumes: `getSettings`, `saveSettings`, `exportAll`, `replaceAll` (Task 4); `buildBackup`, `parseBackup` (Task 3).
- Produces: `renderSettings(): Promise<void>`.

- [ ] **Step 1:** Felder Kalorienziel (ganze Zahl > 0) und Gemini-Key (Passwortfeld, Anzeige umschaltbar) mit Speichern.
- [ ] **Step 2:** Export lädt `kalorientracker-YYYY-MM-DD.json` herunter (ohne Key). Import liest Datei, `parseBackup`, Rückfrage „Alle aktuellen Daten ersetzen?“, dann `replaceAll`. Bei `{ok:false}` Fehlermeldung und keine Änderung; der Key bleibt beim Import erhalten.
- [ ] **Step 3:** Prüfung im Browser: Export, Daten löschen, Import stellt alles wieder her; eine beliebige andere JSON-Datei wird abgelehnt und die Daten bleiben.
- [ ] **Step 4:** Commit `feat: Einstellungen und Backup`.

### Task 11: Veröffentlichung und Abnahme

**Files:**
- Create: `README.md`
- Modify: `sw.js` (Cache-Version)

- [ ] **Step 1:** `npm test`, erwartet: alle Tests PASS.
- [ ] **Step 2:** Mit dem Nutzer GitHub-Repo anlegen (ggf. Account), Code pushen, GitHub Pages aus dem Hauptzweig aktivieren. Sicherstellen, dass kein Key im Repo steht (`git grep -i "AIza"` liefert nichts).
- [ ] **Step 3:** Auf dem Pixel in Chrome öffnen, „Zum Startbildschirm hinzufügen“, App im Flugmodus starten, Mahlzeit manuell eintragen: funktioniert offline.
- [ ] **Step 4:** Mit dem Nutzer mindestens fünf echte Fotos koreanischer Etiketten scannen (Convenience-Store-Produkte, verschiedene Layouts, auch schräg oder spiegelnd). Pro Foto notieren, ob kcal, P, KH, F und Bezugsgröße richtig erkannt wurden; bei Systemfehlern den Prompt in `gemini.js` nachschärfen.
- [ ] **Step 5:** `README.md` mit Installation, Key-Einrichtung und Backup-Hinweis; Commit `docs: README` und Push.
