# Redesign, Nährstoff-Übersicht, Verlauf, Training und Fuchs-Animationen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App bekommt Datensicherheits-Hilfen (Stufe 0), eine neue Essen-Übersicht mit Nährstoff-Ringen, Verlauf mit Tagesstatus und Jahres-Heatmap sowie Fuchs-Animationen (Stufe 1) und ein Trainings-Tracking (Stufe 2).

**Architecture:** Weiterhin eine statische PWA ohne Framework. Neue Logik liegt in kleinen reinen Modulen mit Node-Tests, die Oberfläche in `src/views/*`. Die IndexedDB wird auf Version 3 erweitert (neue Speicher `days`, `exercises`, `workouts`), die Sicherung auf Version 2. Animationen nutzen nur CSS und die Web Animations API mit `transform` und `opacity`.

**Tech Stack:** HTML/CSS/JS (ES-Module), IndexedDB, Service Worker, Gemini REST API, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-25-redesign-training-design.md`

## Global Constraints

- Fuchs-Orange `#f2711c` mit Verlauf `#ff8a3d` ersetzt `#fc4c02` überall (CSS, JS, `manifest.webmanifest` theme_color).
- Flächen: Kohle `#0e0e10`, Karte `#18181b`, Fläche `#26262b`. Nährstoff-Farben: Eiweiß `#ff6b57`, Kohlenhydrate `#ffb020`, Fett `#4da3ff`, Ballaststoffe `#3ccf7a`, Zucker `#ff7ac0`.
- Schrift: Barlow Condensed kursiv für Zahlen und Seitentitel (Seitentitel in Großbuchstaben, sonst keine Großbuchstaben-Beschriftungen), Figtree für Text. Hell- und Dunkelmodus folgen dem Handy.
- Nichts wird bewertet: Nährstoff-Ringe werden nie rot, es gibt keine Warnung für "zu viel". Mahlzeiten-Abschnitte zeigen nur kcal, keine Vorgabe. Wasser, Freunde, Bezahl-Hinweise, Push-Nachrichten und Cloud-Sync sind nicht im Umfang.
- Navigation Stufe 1: Heute, Verlauf, Kamera-Button, Gewicht, Mehr. Stufe 2: Heute, Training, Kamera-Button, Verlauf, Mehr (Gewicht wandert in den Verlauf und in "Mehr").
- Datenbank-Version 3, Sicherung Version 2. Version-1-Sicherungen bleiben importierbar, fehlende Teile gelten als leer. Der API-Key bleibt nie in der Sicherung.
- Animationen: nur `transform` und `opacity`, bei "Bewegung reduzieren" keine Animation und kein Splash. Splash höchstens 1,4 s, nur Kaltstart, einmal pro Sitzung, Tipp überspringt, nicht bei Start über Kurzbefehl oder "Teilen".
- Richtwerte: Eiweiß = `proteinGoal` oder 20 % der kcal / 4, Kohlenhydrate 50 % / 4, Fett 30 % / 9, Ballaststoffe 30 g, Zucker "höchstens" 10 % der kcal / 4. Geschätztes Maximum nach Epley: `kg × (1 + Wdh / 30)`.
- Mahlzeiten-Abschnitte per Uhrzeit: 5–11 Uhr Frühstück, 11–15 Mittag, 17–22 Abend, sonst Snack.
- Layout bei 390 px Breite ohne horizontalen Überlauf. Texte auf Deutsch, Schreibweise in Sätzen.
- Jede neue Datei unter `src/` oder `fonts/` kommt im selben Commit in `ASSETS` von `sw.js` (der Wächter-Test erzwingt das). Jede Veröffentlichung erhöht `CACHE` in `sw.js` (aktuell `kalorientracker-v15`): Stufe 0 → v16, Stufe 1 → v17, Stufe 2 → v18.

## Review Focus

- Alte Einträge ohne Ballaststoffe und Zucker (`null`/fehlend): Summen, Ringe und Listen zeigen "–" oder 0, nie `NaN` oder "null" (Task 3, Task 12).
- Datenbank-Upgrade von Version 2 auf 3 mit vorhandenen Daten und Warteschlange: nichts geht verloren (Task 7).
- Serie mit Krank-Tagen an den Rändern: Krank am Anfang, am Ende, mehrere Krank-Tage hintereinander, Krank-Tag mit Eintrag (Task 8).
- Splash: kommt nicht bei Kurzbefehl, "Teilen", Neuladen, zweitem Start in einer Sitzung und bei "Bewegung reduzieren" (Task 14).
- Trainingsdaten am Rand: keine Einheiten, Satz mit 0 kg (Körpergewicht), Satz mit 0 Wiederholungen, erster Satz einer Übung ist kein Rekord (Task 17).

## Arbeitshinweise

- Tests: `npm test` (führt `node --test "tests/*.test.js"` aus). Einzelne Datei: `node --test tests/<datei>.test.js`.
- Mehrzeilige Shell-Skripte mit Anführungszeichen scheitern in dieser Umgebung. Dateien mit dem Write-Werkzeug schreiben und Node-Hilfsskripte (`.cjs`) im Scratchpad ausführen.
- Browser-Prüfung: Vorschau `app` starten (`preview_start`), Service Worker und Caches im Browser löschen, alle `ASSETS` mit `fetch(url, {cache:'reload'})` neu laden, dann `location.reload()`. Emulation 390×844.
- Jeder Commit endet mit der Zeile `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (zweites `-m`). Arbeit auf `main`, Veröffentlichung (`git push`) erst nach Freigabe des Nutzers.
- UI-Aufgaben ohne reine Logik haben statt eines Node-Tests einen Prüfschritt im Browser mit messbaren Kriterien.

---

## Stufe 0: Datensicherheit

### Task 1: Persistenter Speicher und Statusanzeige

**Files:**
- Create: `src/storage-persist.js`, `tests/storage-persist.test.js`
- Modify: `src/app.js`, `src/views/settings.js`, `sw.js`

**Interfaces:**
- Produces: `requestPersistence(storage?: StorageManager): Promise<'granted'|'denied'|'unsupported'>`, `persistenceStatus(storage?: StorageManager): Promise<'granted'|'not-granted'|'unsupported'>` (Standard `globalThis.navigator?.storage`).

- [ ] **Step 1: Failing tests** in `tests/storage-persist.test.js` mit gefälschten `storage`-Objekten: `persist()` → `true` ergibt `'granted'`, `false` ergibt `'denied'`, `persist` wirft ergibt `'denied'`, `storage` fehlt oder ohne `persist` ergibt `'unsupported'`; `persisted()` → `true` ergibt `'granted'`, `false` ergibt `'not-granted'`, fehlende Funktion ergibt `'unsupported'`.
- [ ] **Step 2:** `node --test tests/storage-persist.test.js` → FAIL (Modul fehlt).
- [ ] **Step 3: Implement** beide Funktionen, `persist`/`persisted` immer in try/catch.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Verdrahten.** `app.js` ruft `requestPersistence()` nach dem ersten Rendern auf (Ergebnis ignorieren). Die Einstellungen zeigen im Sicherungs-Abschnitt "Speicher geschützt: ja / nein / unbekannt" aus `persistenceStatus()` und den Satz: "Lösche in Chrome nicht „Cookies und Websitedaten“ für diese Seite, sonst gehen die Daten verloren. Mach regelmäßig eine Sicherung."
- [ ] **Step 6: Prüfen im Browser:** Einstellungen zeigen die Zeile mit einem der drei Werte, `npm test` grün.
- [ ] **Step 7: Commit** `feat: persistenten Speicher anfordern und Status anzeigen`.

### Task 2: "Willkommen"-Karte mit Wiederherstellen

**Files:**
- Create: `src/welcome.js`, `src/backup-import.js`, `tests/welcome.test.js`, `tests/backup-import.test.js`
- Modify: `src/views/today.js`, `src/views/settings.js`, `sw.js`

**Interfaces:**
- Produces: `shouldShowWelcome(data: {products, meals, weights, settings}): boolean` (wahr, wenn `products`, `meals` und `weights` leer sind, `settings.calorieGoal` und `settings.pet` und `settings.calcProfile` fehlen/`null` sind und `settings.welcomeDismissed` nicht gesetzt ist); `restoreFromText(text: string, replace: (data) => Promise<void>): Promise<{ok:true, counts:{meals:number, products:number, weights:number}} | {ok:false, error:string}>` (nutzt `parseBackup`, ruft `replace` nur bei gültiger Datei).
- Consumes: `parseBackup` aus `src/backup.js`, `replaceAll`, `exportAll`, `getSettings`, `saveSettings` aus `src/db.js`.

- [ ] **Step 1: Failing tests.** `welcome.test.js`: leere Daten ergibt `true`; eine Mahlzeit ergibt `false`; `calorieGoal: 2000` ergibt `false`; `welcomeDismissed: true` ergibt `false`; nur `geminiKey` gesetzt ergibt `true`. `backup-import.test.js`: gültige Datei ruft `replace` einmal mit den Daten und liefert `counts`; kaputtes JSON liefert `ok:false` und `replace` wird nicht aufgerufen; Version 3 liefert `ok:false`.
- [ ] **Step 2:** beide Tests → FAIL.
- [ ] **Step 3: Implement** beide Module. `settings.js` benutzt `restoreFromText` statt der eigenen Import-Logik (Rückfrage per `confirm` bleibt dort).
- [ ] **Step 4:** Tests → PASS, `npm test` grün.
- [ ] **Step 5: UI.** Auf "Heute" erscheint bei `shouldShowWelcome(await exportAll())` oben eine Karte "Neu hier oder zurück?" mit drei Buttons: "Sicherung wiederherstellen" (Dateiauswahl, dann `restoreFromText`, Erfolgsmeldung mit Anzahl), "Gemini-Key eintragen" (öffnet Einstellungen), "Neu starten" (setzt `welcomeDismissed: true`). Sie zählt nicht als Hinweis aus `pickNotice` und verschwindet mit dem ersten Eintrag.
- [ ] **Step 6: Prüfen im Browser:** leere Datenbank zeigt die Karte, eine erzeugte Sicherungsdatei lässt sich einspielen (Mahlzeiten erscheinen), "Neu starten" blendet sie dauerhaft aus, mit Daten erscheint sie nicht.
- [ ] **Step 7: Veröffentlichungspunkt Stufe 0:** `CACHE` auf `kalorientracker-v16`, README-Abschnitt "Sicherung" um persistenten Speicher und die Willkommen-Karte ergänzen, `npm test` grün, Nutzer um Freigabe zum Pushen bitten.
- [ ] **Step 8: Commit** `feat: Willkommen-Karte mit Wiederherstellen` (und README/Version in einem weiteren Commit).

---

## Stufe 1: Essen, Verlauf, Animationen

### Task 3: Ballaststoffe und Zucker in der Rechenlogik

**Files:**
- Modify: `src/logic.js`, `tests/logic.test.js`

**Interfaces:**
- Produces: `scaleNutrition(...)` und `dayTotals(...)` liefern zusätzlich `fiber` und `sugar` (Gramm, eine Nachkommastelle, `null` bleibt bei `scaleNutrition` `null`, bei `dayTotals` zählt `null` als 0).

- [ ] **Step 1: Tests anpassen und ergänzen** in `tests/logic.test.js`: bestehende `deepEqual`-Erwartungen um `fiber: null, sugar: null` (bzw. `fiber: 0, sugar: 0` bei `dayTotals`) erweitern. Neu: Produkt pro 100 g mit `fiber: 3, sugar: 10`, 150 g ergibt `fiber: 4.5, sugar: 15`; Produkt ohne `fiber`/`sugar` ergibt `null` (nie `NaN`); `dayTotals` summiert `fiber` 1.5 und 2 zu 3.5, `null` zählt als 0, leere Liste ergibt `fiber: 0, sugar: 0`.
- [ ] **Step 2:** `node --test tests/logic.test.js` → FAIL.
- [ ] **Step 3: Implement** in `scaleNutrition` und `dayTotals`.
- [ ] **Step 4:** Test → PASS, `npm test` grün.
- [ ] **Step 5: Commit** `feat: Ballaststoffe und Zucker in Umrechnung und Tagessummen`.

### Task 4: Ballaststoffe und Zucker aus Etiketten, Formular und Produkten

**Files:**
- Modify: `src/gemini-parse.js`, `src/gemini.js`, `src/views/meal-form.js`, `src/views/product-form.js`, `tests/gemini-parse.test.js`

**Interfaces:**
- Produces: `parseLabelResponse(...).label` enthält `fiber` und `sugar` (`number|null`, Komma-Strings werden akzeptiert wie bei den anderen Zahlen).
- Consumes: `scaleNutrition` aus Task 3. Meal- und Produkt-Objekte tragen `fiber`, `sugar`.

- [ ] **Step 1: Tests anpassen** in `tests/gemini-parse.test.js`: `good` und `est` bekommen `fiber: 3.2, sugar: 12`; Erwartungen der `deepEqual`-Tests entsprechend; neue Tests: `sugar: '12,5'` ergibt 12.5, fehlende Felder ergeben `null`, `fiber: -1` ergibt `null`.
- [ ] **Step 2:** `node --test tests/gemini-parse.test.js` → FAIL.
- [ ] **Step 3: Implement** im Parser. In `gemini.js` Prompt (koreanisch 식이섬유 = Ballaststoffe, 당류 = Zucker) und `SCHEMA` um `fiber`, `sugar` (nullable NUMBER) erweitern, bei Schätzungen dürfen beide geschätzt werden.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Formulare.** In `meal-form.js` und `product-form.js` zwei zusätzliche Felder "Ballaststoffe (g)" und "Zucker (g)" im aufklappbaren Bereich ("Werte bearbeiten"). Sie gehören **nicht** zu den Pflicht-/Warnfeldern (`FIELDS.slice(1)`-Warnung "fehlt und zählt als 0" bleibt auf Protein, Kohlenhydrate, Fett beschränkt, eigene Liste `EXTRA_FIELDS`). Gespeichert werden sie in Produkt und Mahlzeit (über `scaleNutrition`). Die Zusammenfassung zeigt sie nur, wenn vorhanden.
- [ ] **Step 6: Prüfen im Browser:** simulierte Gemini-Antwort mit `fiber: 3, sugar: 8` füllt die Felder, eine Antwort ohne beide lässt sie leer ohne Warnung, Speichern funktioniert in beiden Fällen, ein altes Produkt ohne die Felder öffnet sich fehlerfrei.
- [ ] **Step 7: Commit** `feat: Ballaststoffe und Zucker aus Etikett, Formular und Produkt`.

### Task 5: Nährstoff-Richtwerte

**Files:**
- Create: `src/nutrients.js`, `tests/nutrients.test.js`
- Modify: `src/views/settings.js`, `sw.js`

**Interfaces:**
- Produces: `NUTRIENTS: {id:'protein'|'carbs'|'fat'|'fiber'|'sugar', label:string, color:string}[]` (Labels Eiweiß, Kohlenhydrate, Fett, Ballaststoffe, Zucker mit den Farben aus den Global Constraints); `nutrientTargets({kcal: number|null, proteinGoal?: number|null, overrides?: Partial<Record<string, number>>}): {protein, carbs, fat, fiber, sugar} | null` (`null` ohne `kcal`); `ringProgress(value: number|null, target: number): number` (0 bis 1).
- Einstellung: `settings.targets` (optional, Zahlen in Gramm).

- [ ] **Step 1: Failing tests** in `tests/nutrients.test.js`: `nutrientTargets({kcal: 2150})` ergibt `{protein: 108, carbs: 269, fat: 72, fiber: 30, sugar: 54}`; mit `proteinGoal: 120` ist `protein` 120; `overrides: {fiber: 25}` ergibt `fiber: 25`; `kcal: null` ergibt `null`; `ringProgress(50, 100)` ist 0.5, `(150, 100)` ist 1, `(null, 100)` ist 0, `(10, 0)` ist 0.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement** beide Funktionen und `NUTRIENTS`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Einstellungen:** Abschnitt "Nährstoff-Richtwerte (optional)" mit fünf Feldern (Gramm), leer lassen heißt Standardwert, Eingaben als ganze Zahlen 1–999 geprüft (`parseIntGoal`), gespeichert in `settings.targets`. Ein Satz weist darauf hin, dass es Orientierungswerte sind.
- [ ] **Step 6: Prüfen im Browser:** Werte setzen, speichern, neu laden, Felder sind gefüllt; leeres Feld löscht den Override.
- [ ] **Step 7: Commit** `feat: Nährstoff-Richtwerte mit Überschreiben`.

### Task 6: Mahlzeiten-Abschnitte

**Files:**
- Create: `src/slots.js`, `tests/slots.test.js`
- Modify: `src/views/meal-form.js`, `sw.js`

**Interfaces:**
- Produces: `SLOTS: {id:'breakfast'|'lunch'|'dinner'|'snack', label:'Frühstück'|'Mittagessen'|'Abendessen'|'Snacks'}[]` (in dieser Reihenfolge); `slotForTime(isoTimestamp: string): SlotId` (Ortszeit; 5–10 Uhr Frühstück, 11–14 Mittag, 17–21 Abend, sonst Snack); `groupBySlot(meals): {slot: SlotId, label: string, meals: Meal[], kcal: number}[]` (immer vier Gruppen, Zuordnung über `meal.slot ?? slotForTime(meal.timestamp)`, `kcal` ist die gerundete Summe).

- [ ] **Step 1: Failing tests** in `tests/slots.test.js` (Zeiten mit `new Date(2026, 9, 25, h).toISOString()`): Stunden 4→snack, 5→breakfast, 10→breakfast, 11→lunch, 14→lunch, 15→snack, 16→snack, 17→dinner, 21→dinner, 22→snack; `groupBySlot` liefert vier Gruppen in Reihenfolge, auch ohne Mahlzeiten; `meal.slot: 'dinner'` überstimmt die Uhrzeit; kcal-Summen stimmen.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Formular:** Segment-Schalter "Frühstück / Mittag / Abend / Snack" in `meal-form.js`, Vorgabe `slotForTime(neuer Zeitstempel)` bzw. vorhandenes `meal.slot`, gespeichert als `slot` in der Mahlzeit. Ein optionaler Parameter `opts.slot` setzt die Vorgabe (für das "+" eines Abschnitts).
- [ ] **Step 6: Prüfen im Browser:** neue Mahlzeit zu bestimmter Uhrzeit bekommt die erwartete Vorauswahl, Umschalten wird gespeichert, alte Mahlzeiten ohne `slot` bleiben bearbeitbar.
- [ ] **Step 7: Commit** `feat: Mahlzeiten-Abschnitte mit Uhrzeit-Vorgabe`.

### Task 7: Datenbank Version 3 und Sicherung Version 2

**Files:**
- Modify: `src/db.js`, `src/backup.js`, `tests/backup.test.js`

**Interfaces:**
- Produces: neue Speicher `days` (keyPath `dateKey`), `exercises` (autoIncrement), `workouts` (autoIncrement, Index `dateKey`); `setDayStatus(dateKey: string, status: 'rest'|'sick'|null): Promise<void>` (`null` löscht); `listDayStatuses(): Promise<{dateKey, status}[]>`; `exportAll()` liefert zusätzlich `days`, `exercises`, `workouts`; `replaceAll(data)` ersetzt auch diese (fehlende Teile gelten als leer, `queue` bleibt unangetastet); `buildBackup(data, now)` schreibt `version: 2` mit `days`, `exercises`, `workouts` (Standard `[]`) und entfernt zusätzlich `trainingDraft` aus den Einstellungen; `parseBackup(text)` akzeptiert Version 1 und 2 und liefert immer `days`, `exercises`, `workouts` als Arrays.

- [ ] **Step 1: Tests anpassen und ergänzen** in `tests/backup.test.js`: Test "falsche Version" auf `version: 3` ändern; `buildBackup` liefert `version: 2` und `days: []`; entfernt `trainingDraft`; `parseBackup` einer Version-1-Datei liefert `days: []`, `exercises: []`, `workouts: []`; Version-2-Roundtrip mit je einem Eintrag bleibt gleich; Tag mit `status: 'x'` ergibt `ok:false`; Trainingseinheit ohne `sets`-Array ergibt `ok:false`; Übung ohne `name` ergibt `ok:false`.
- [ ] **Step 2:** `node --test tests/backup.test.js` → FAIL.
- [ ] **Step 3: Implement** in `backup.js`. In `db.js`: `indexedDB.open(DB_NAME, 3)`, `onupgradeneeded` mit `oldVersion < 3` legt die drei Speicher an; `STORES` und `replaceAll`/`exportAll` erweitern.
- [ ] **Step 4:** Tests → PASS, `npm test` grün.
- [ ] **Step 5: Upgrade im Browser prüfen (Review Focus):** Die lokale Datenbank ist noch Version 2 mit Daten und einem Warteschlangen-Eintrag. Nach dem Laden des neuen Codes: `objectStoreNames` enthält `days`, `exercises`, `workouts` und `queue`, alle Mahlzeiten, Produkte, Gewichte, Einstellungen und der Warteschlangen-Eintrag sind unverändert (Anzahlen vor und nach dem Upgrade vergleichen). `setDayStatus` und `listDayStatuses` mit `'sick'` und `null` per Skript prüfen.
- [ ] **Step 6: Commit** `feat: Datenbank Version 3 und Sicherung Version 2`.

### Task 8: Serie mit Krank-Tagen

**Files:**
- Modify: `src/pet.js`, `tests/pet.test.js`

**Interfaces:**
- Produces: `streak(days: string[], todayKey: string, sickDays?: string[]): {current: number, best: number}`. Ein Krank-Tag ohne Eintrag überbrückt eine Lücke (reißt die Serie nicht, zählt aber nicht mit). Ein Tag mit Eintrag zählt einmal, auch wenn er krank markiert ist.

- [ ] **Step 1: Failing tests** in `tests/pet.test.js` (Tage `d1..d5` aufeinanderfolgend): Einträge d1, d2, d4 mit Krank d3 ergibt `current` 3 und `best` 3; zwei Krank-Tage hintereinander (d3, d4) zwischen d2 und d5 überbrücken; Lücke aus einem Krank-Tag plus einem normalen Fehltag bricht; heute krank ohne Eintrag, gestern Eintrag: Serie lebt, `current` zählt die Einträge bis gestern; Krank-Tage vor dem ersten Eintrag erzeugen keine Serie (`current` 0 bei leerer Liste); Krank-Tag mit Eintrag zählt nur einmal; bestehende Tests ohne dritten Parameter bleiben grün.
- [ ] **Step 2:** `node --test tests/pet.test.js` → FAIL.
- [ ] **Step 3: Implement** (Rückwärtslauf wie bisher, ein Krank-Tag ohne Eintrag wird übersprungen, `best` über die Historie mit derselben Regel).
- [ ] **Step 4:** Test → PASS, `npm test` grün.
- [ ] **Step 5: Commit** `feat: Krank-Tage überbrücken die Fuchs-Serie`.

### Task 9: Wochenleiste

**Files:**
- Create: `src/week.js`, `tests/week.test.js`, `src/views/week-strip.js`
- Modify: `sw.js`

**Interfaces:**
- Produces: `weekOf(dateKey: string): string[]` (sieben Tage, Montag bis Sonntag, die den Tag enthalten); `shiftWeek(dateKey: string, n: number): string` (gleicher Wochentag `n` Wochen später); `weekStrip({selected, todayKey, counts, statuses, onSelect, onShift}): HTMLElement` (zeigt Mo–So mit Datum, Tage in der Zukunft gesperrt, ‹ › zum Wochenwechsel, kleiner Punkt bei Tagen mit Einträgen, Markierung für `sick`/`rest`).
- Consumes: `addDays` aus `src/overview.js`.

- [ ] **Step 1: Failing tests** in `tests/week.test.js`: `weekOf('2026-10-25')` (Sonntag) ergibt `2026-10-19` bis `2026-10-25`; `weekOf('2026-10-19')` (Montag) ergibt dieselbe Woche; Jahreswechsel: `weekOf('2027-01-01')` ergibt `2026-12-28` bis `2027-01-03`; Schaltjahr: `weekOf('2028-02-29')` enthält `2028-02-28` bis `2028-03-05`; `shiftWeek('2026-10-25', -1)` ist `2026-10-18`; `shiftWeek('2026-12-28', 1)` ist `2027-01-04`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement** beide Funktionen; `week-strip.js` baut die Leiste mit `el()` aus `dom.js`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat: Wochenleiste (Logik und Komponente)`.

### Task 10: Essens-Symbole

**Files:**
- Create: `src/food-icons.js`, `tests/food-icons.test.js`, `src/views/food-icons.js`
- Modify: `sw.js`

**Interfaces:**
- Produces: `ICON_IDS` in dieser Reihenfolge und Priorität: `onigiri, ramyun, milk, drumstick, rice, bread, egg, broccoli, apple, candy, avocado, plate`; `foodIconFor(name: string): IconId` (Wörter des kleingeschriebenen Namens, Trennung an Nicht-Buchstaben/Ziffern; Schlüsselwörter mit mindestens 4 Zeichen passen per `startsWith`, kürzere nur bei exakter Gleichheit; Standard `plate`); `foodIconSvg(id: IconId, size?: number): SVGElement` (eigene flache Symbole in der App-Palette).
- Schlüsselwörter: onigiri: kimbap, gimbap, 삼각김밥, 김밥, onigiri, sushi; ramyun: ramyun, ramen, 라면, nudel, noodle, instant; milk: milk, milch, 우유, joghurt, yogurt, latte; drumstick: hähnchen, chicken, huhn, 치킨, fleisch, rind, schwein, bulgogi, döner; rice: reis, rice, bibimbap, 밥, curry; bread: brot, bread, toast, sandwich, wrap, burger, brötchen, croissant, 빵; egg: ei, egg, eier, 계란; broccoli: salat, salad, gemüse, brokkoli, broccoli; apple: apfel, apple, banane, banana, obst, frucht, orange, 사과; candy: schoko, chocolate, bonbon, keks, cookie, kuchen, cake, eis, riegel; avocado: avocado, nuss, nut, mandel.

- [ ] **Step 1: Failing tests** in `tests/food-icons.test.js`: `'Triangle Kimbap Thunfisch'` ergibt `onigiri`; `'삼각김밥 참치마요'` ergibt `onigiri`; `'Shin Ramyun'` ergibt `ramyun`; `'Banana Milk'` ergibt `milk` (Priorität vor `apple`); `'Reis'` ergibt `rice` (nicht `egg`); `'Eier mit Speck'` ergibt `egg`; `'Chicken Salad Wrap'` ergibt `drumstick`; `'Unbekanntes Zeug'` ergibt `plate`; leerer Name ergibt `plate`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement** `foodIconFor`. In `views/food-icons.js` zwölf SVG-Symbole (viewBox 0 0 48 48) zeichnen.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Optik im Browser prüfen:** temporäres Testfeld mit allen zwölf Symbolen (Größe 64) in Dunkel- und Hellmodus, Screenshot ansehen, jedes Symbol ist als das Gemeinte erkennbar. Testfeld wieder entfernen.
- [ ] **Step 6: Commit** `feat: Essens-Symbole und Zuordnung nach Namen`.

### Task 11: Design-Tokens und "Mehr"-Tab

**Files:**
- Create: `src/views/more.js`
- Modify: `styles.css`, `index.html`, `src/nav.js`, `src/app.js`, `src/views/today.js`, `manifest.webmanifest`, `sw.js`

**Interfaces:**
- Produces: `renderMore(): Promise<void>` (rendert in `#view-more`); Navigation Stufe 1: Heute, Verlauf, Kamera-Button, Gewicht, Mehr (Data-Attribut `data-view="more"`). Zeilen in "Mehr": "Gespeicherte Produkte" (öffnet die Produktansicht), "Einstellungen" (öffnet die Einstellungen), "Sicherung" (öffnet die Einstellungen und scrollt zum Sicherungs-Abschnitt, dieser bekommt `id="backup-card"`).
- Consumes: `showView` aus `src/nav.js`.

- [ ] **Step 1: Tokens umstellen.** In `styles.css` die Variablen auf die Palette der Global Constraints setzen (Orange, Flächen, Nährstoff-Farben als `--n-protein` usw.), Hellmodus mit entsprechenden Gegenstücken, alle harten `#fc4c02`- und `rgba(252,76,2,…)`-Stellen in CSS und JS (`today.js` Ring-Verlauf) auf das neue Orange ändern, `manifest.webmanifest` `theme_color` auf `#f2711c`. Seitentitel `h1` erhalten Barlow Condensed kursiv in Großbuchstaben (per CSS), kleine Beschriftungen (`h2`, `.eyebrow`) normale Schreibweise.
- [ ] **Step 2: Navigation.** `index.html`: Tab "Einstellungen" wird zu "Mehr" (Icon: drei Punkte), neuer Abschnitt `#view-more`; `nav.js` kennt `more`; `app.js` registriert `renderMore`. Die Einstellungen sind weiter als Ansicht erreichbar, nur nicht mehr in der Leiste.
- [ ] **Step 3: Prüfen im Browser (390 px):** fünf Einträge in der Leiste, "Mehr" öffnet die Liste, jede Zeile führt zur richtigen Ansicht, "Sicherung" scrollt zum Abschnitt, kein horizontaler Überlauf, Dunkel- und Hellmodus, kein altes `#fc4c02` mehr (`git grep -i fc4c02` leer).
- [ ] **Step 4:** `npm test` grün (Wächter für `sw.js`).
- [ ] **Step 5: Commit** `feat: neue Design-Tokens und Mehr-Tab`.

### Task 12: Heute neu aufbauen

**Files:**
- Create: `src/views/nutrient-rings.js`
- Modify: `src/views/today.js`, `src/views/meal-form.js`, `styles.css`, `sw.js`

**Interfaces:**
- Produces: `nutrientTile({nutrient, value, target}): HTMLElement` (Ring mit Nährstoff-Farbe und Essens-Symbol, darunter Name und "von X g", bei Zucker "höchstens X g", ohne Richtwert nur der Wert; Zahlen in Barlow; nie rote Warnfarbe; `null` zeigt "–"). Heute zeigt: Wochenleiste (`weekStrip`), Hinweis (höchstens einer, wie bisher), Kalorien-Karte mit Fuchs (oben rechts, Stimmung wie bisher, Sprechblase als Zeile) und Ring, fünf Nährstoff-Kacheln (3 + 2), Chips "Zuletzt gegessen", Warteschlange, vier Mahlzeiten-Abschnitte aus `groupBySlot` mit kcal und "+" je Abschnitt (öffnet das Formular mit `opts.slot`).
- Symbole der Kacheln: Eiweiß `drumstick`, Kohlenhydrate `rice`, Fett `avocado`, Ballaststoffe `broccoli`, Zucker `candy`.
- Consumes: `nutrientTargets`, `ringProgress`, `NUTRIENTS` (Task 5), `groupBySlot` (Task 6), `weekStrip`, `weekOf` (Task 9), `foodIconSvg` (Task 10), `dayTotals` (Task 3).

- [ ] **Step 1: Implement** `nutrient-rings.js` und den neuen Aufbau von `today.js`. Mahlzeiten erscheinen als kompakte Zeilen im Abschnitt (Name, Uhrzeit und Menge, kcal, Schätzungs-Zeichen); Tippen öffnet das Bearbeiten-Formular, das jetzt einen Button "Löschen" mit Rückgängig-Hinweis enthält (die Knöpfe ✎ und × an den Zeilen entfallen). Der Fuchs-Streifen und die Karten-Einblendung (`rise`) entfallen. Fuchs antippen öffnet weiter den Fuchs-Dialog.
- [ ] **Step 2: Messbar im Browser prüfen (390×844, Beispieldaten mit 3 Mahlzeiten):** Wochenleiste und Kalorien-Karte stehen oben, mindestens der Abschnitt "Frühstück" ist ohne Scrollen sichtbar; fünf Kacheln mit Symbolen; Ringfüllung entspricht `value/target`; bei Überschreitung bleibt der Ring voll und die Farbe unverändert; Wochentag antippen wechselt den Tag; Abschnitts-"+" öffnet das Formular mit dem richtigen Abschnitt; eine alte Mahlzeit ohne `fiber`/`sugar` und ohne `slot` erscheint ohne "null" oder "NaN" (Text-Scan der Ansicht); `scrollWidth` gleich Breite; Hell- und Dunkelmodus.
- [ ] **Step 3:** `npm test` grün.
- [ ] **Step 4: Commit** `feat: Heute mit Wochenleiste, Nährstoff-Ringen und Mahlzeiten-Abschnitten`.

### Task 13: Verlauf mit Tagesstatus und Jahres-Heatmap

**Files:**
- Modify: `src/calendar.js`, `tests/calendar.test.js`, `src/views/history.js`, `src/views/today.js`, `styles.css`

**Interfaces:**
- Produces: `yearGrid({counts, statuses, todayKey}): {weeks: Cell[][], tracked: number}` mit `Cell = {dateKey, level, status: 'rest'|'sick'|null, isFuture, isToday}`; 53 Wochen (Spalten) zu je 7 Tagen (Montag bis Sonntag), die letzte Woche enthält `todayKey`, `level` kommt aus `intensity`, `tracked` zählt vergangene Tage mit Einträgen. `monthGrid` und `shiftMonth` entfallen (die Monatsansicht wird durch Wochenleiste und Jahres-Heatmap ersetzt).
- Consumes: `weekOf`, `shiftWeek` (Task 9), `setDayStatus`, `listDayStatuses` (Task 7), `streak` mit `sickDays` (Task 8).

- [ ] **Step 1: Tests anpassen und ergänzen** in `tests/calendar.test.js`: Tests zu `monthGrid`/`shiftMonth` entfernen, `intensity`-Tests bleiben; neu: `yearGrid` liefert 53 Wochen zu je 7 Zellen, die letzte Woche enthält `todayKey` und genau eine Zelle mit `isToday`, Zellen nach heute haben `isFuture`, `status` wird aus `statuses` übernommen, `level` 0–3 nach Anzahl, `tracked` zählt keine Zukunft.
- [ ] **Step 2:** `node --test tests/calendar.test.js` → FAIL.
- [ ] **Step 3: Implement** `yearGrid` in `calendar.js`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Oberfläche.** `history.js` zeigt: Titel "VERLAUF", Wochenleiste, Tageskarte des gewählten Tags (Datum, Anzahl Einträge und kcal-Summe, Schalter "Ruhetag" und "Krank" setzen oder löschen den Status über `setDayStatus`), Karte "Dein Jahr" (Heatmap, daneben Serie, Rekord, Tage insgesamt aus `streak`), Karte "Letzte 7 Tage" (bisherige Balken). Die Serie des Fuchses nutzt überall `streak(days, todayKey, sickDays)`. Auf "Heute" erscheint bei gesetztem Status ein kleines Etikett "Krank" oder "Ruhetag" unter dem Titel. In der Heatmap bekommen kranke Tage einen kleinen blauen Punkt und Ruhetage einen kleinen Haken. Heatmap-Zellen sind nicht antippbar.
- [ ] **Step 6: Prüfen im Browser (390 px):** Status umschalten wirkt sofort in Verlauf und Heute; mit einem Krank-Tag zwischen zwei Eintragstagen bleibt die Serie erhalten; Heatmap zeigt Farben nach Einträgen, kranke Tage markiert; kein Überlauf; Text-Scan ohne "null/NaN".
- [ ] **Step 7: Commit** `feat: Verlauf mit Tagesstatus und Jahres-Heatmap`.

### Task 14: App-Start-Animation

**Files:**
- Create: `src/splash.js`, `tests/splash.test.js`
- Modify: `index.html`, `src/app.js`, `styles.css`, `sw.js`

**Interfaces:**
- Produces: `shouldShowSplash({navigationType: string, launchAction: string|null, reducedMotion: boolean, shownThisSession: boolean}): boolean` (falsch bei `reducedMotion`, `launchAction` ungleich `null`, `shownThisSession` oder `navigationType === 'reload'`, sonst wahr); `runSplash(root: HTMLElement): Promise<void>` (spielt die Sequenz, setzt `sessionStorage`-Flag `splashShown`, entfernt `#splash`, überspringbar per Tipp).

- [ ] **Step 1: Failing tests** in `tests/splash.test.js`: Kaltstart ohne Aktion wahr; `launchAction: 'scan'` falsch; `launchAction: 'shared'` falsch; `reducedMotion: true` falsch; `shownThisSession: true` falsch; `navigationType: 'reload'` falsch; `navigationType: 'back_forward'` wahr.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement** `shouldShowSplash`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Sequenz** (insgesamt höchstens 1,4 s): statisches `#splash` in `index.html` mit Hintergrund `#0e0e10` und Inline-Stil (kein Aufblitzen), Ring zeichnet sich (`stroke-dashoffset`), Fuchs (aus `foxSvg`) hüpft hinein, Onigiri, Milchkarton und Ramyun-Schale (aus `foodIconSvg`) fliegen in die Ringmitte, danach verkleinert sich der Ring Richtung Kalorien-Karte und blendet aus (Annäherung, kein echter gemeinsamer Elementübergang). `app.js` entscheidet mit `shouldShowSplash` (Navigationstyp aus `performance.getEntriesByType('navigation')[0]?.type`, Aktion aus `parseLaunchAction`, `matchMedia('(prefers-reduced-motion: reduce)')`).
- [ ] **Step 6: Prüfen im Browser:** Kaltstart zeigt den Splash und er verschwindet nach höchstens 1,4 s, Tipp bricht ab, zweiter Start in derselben Sitzung und Neuladen zeigen ihn nicht, `/?action=scan` und `/?action=shared` zeigen ihn nicht, mit emuliertem "Bewegung reduzieren" erscheint er nicht, es werden nur `transform`/`opacity` animiert (Prüfung der `getAnimations()`-Eigenschaften).
- [ ] **Step 7: Commit** `feat: App-Start-Animation mit Fuchs und Essen`.

### Task 15: Animation beim Eintragen

**Files:**
- Create: `src/views/motion.js`, `tests/motion.test.js`
- Modify: `src/state.js`, `src/views/meal-form.js`, `src/views/today.js`, `src/views/nutrient-rings.js`, `sw.js`

**Interfaces:**
- Produces: `easeOutCubic(t: number): number`; `prefersReducedMotion(): boolean`; `countUp(el: HTMLElement, to: number, opts?: {from?: number, ms?: number, decimals?: number}): void` (setzt bei reduzierter Bewegung sofort den Endwert); `flyIcon(icon: SVGElement, fromRect: DOMRect, toRect: DOMRect, opts?: {ms?: number}): Promise<void>` (Web Animations API, nur `transform` und `opacity`, entfernt das Element danach); in `state.js`: `setJustLogged(name: string): void`, `takeJustLogged(): string | null` (liefert einmal und löscht).

- [ ] **Step 1: Failing tests** in `tests/motion.test.js`: `easeOutCubic(0)` 0, `(1)` 1, `(0.5)` größer als 0.5, monoton steigend über 11 Stützstellen, Werte außerhalb 0..1 werden begrenzt.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement** die vier Funktionen; `state.js` bekommt `setJustLogged`/`takeJustLogged`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Verdrahten.** Nach erfolgreichem Speichern ruft `meal-form.js` `setJustLogged(name)`. `today.js` ruft nach dem Rendern `takeJustLogged()`: bei Treffer fliegt `foodIconSvg(foodIconFor(name))` von der Kamera-Taste zum Fuchs, der Fuchs bekommt `munch`, Kalorien-Zahl und Nährstoff-Zahlen zählen vom vorherigen zum neuen Wert, die Ringe füllen sich über die vorhandene Übergangszeit. Ohne Treffer (normales Neuzeichnen) keine Bewegung.
- [ ] **Step 6: Prüfen im Browser:** Mahlzeit speichern löst Flug, Kauen und Zählen aus (`document.getAnimations().length` größer als 0 direkt danach), normales Neuladen der Ansicht nicht; mit "Bewegung reduzieren" springen Zahlen sofort, kein Flug; Symbol passt zum Namen (Kimbap-Beispiel).
- [ ] **Step 7: Commit** `feat: Eintragen-Animation mit fliegendem Essens-Symbol`.

### Task 16: Stufe 1 abschließen und veröffentlichen

**Files:**
- Modify: `README.md`, `sw.js`

- [ ] **Step 1:** README aktualisieren: neue Navigation, Heute-Aufbau, Nährstoff-Ringe und Richtwerte, Mahlzeiten-Abschnitte, Tagesstatus Ruhetag/Krank, Jahres-Heatmap, Animationen (mit "Bewegung reduzieren"), Hinweis auf Ballaststoffe/Zucker aus Etiketten.
- [ ] **Step 2:** `CACHE` auf `kalorientracker-v17`, `npm test` grün, `git grep -nE "confirm\(" src` zeigt nur den Import.
- [ ] **Step 3: Gesamtprüfung im Browser (390 px, Dunkel und Hell, "Bewegung reduzieren"):** Datenbank-Upgrade mit den vorhandenen Beispieldaten, Mahlzeit per Foto-Simulation mit Ballaststoffen/Zucker anlegen, Tagesstatus setzen, Splash, Eintragen-Animation, Text-Scan aller Ansichten auf "null/undefined/NaN", `scrollWidth` aller Ansichten.
- [ ] **Step 4: Commit** `docs: README und Version für Stufe 1`. Nutzer um Freigabe zum Pushen bitten.

---

## Stufe 2: Training

### Task 17: Trainings-Logik

**Files:**
- Create: `src/training.js`, `tests/training.test.js`
- Modify: `sw.js`

**Interfaces:**
- Produces: `MUSCLES` (`'Brust'|'Rücken'|'Beine'|'Schultern'|'Arme'|'Core'|'Ganzkörper'`); `DEFAULT_EXERCISES: {name, muscle}[]` (Kniebeugen Beine, Bankdrücken Brust, Kreuzheben Rücken, Schulterdrücken Schultern, Klimmzüge Rücken, Rudern Rücken, Bizeps-Curls Arme, Plank Core); `epley1RM(kg: number, reps: number): number | null` (eine Nachkommastelle, `null` bei Wiederholungen unter 1); `personalRecords(workouts, exercises): {exerciseId, name, best1RM, bestKg, bestReps}[]` (nach `best1RM` absteigend); `weeklySets(workouts, exercises, todayKey): {total: number, byMuscle: Record<string, number>}` (letzte 7 Tage); `weeklySetSeries(workouts, todayKey, weeks?: number): {weekStart: string, sets: number}[]` (Standard 8 Wochen, Montag-basiert); `muscleDistribution(workouts, exercises, todayKey, days?: number): {muscle, sets, percent}[]` (Standard 30 Tage, absteigend, Prozente ganzzahlig, Summe 100 oder leer); `strengthCurve(workouts, exerciseId): {dateKey, best1RM}[]` (aufsteigend); `lastSetsFor(workouts, exerciseId): {kg, reps}[]` (Sätze der jüngsten Einheit mit dieser Übung, sonst `[]`); `daysSinceMuscle(workouts, exercises, muscle, todayKey): number | null`; `isNewRecord(workouts, exerciseId, set: {kg, reps}): boolean` (nur wahr, wenn schon früher ein Satz existiert und `epley1RM` größer ist); `workoutTitle(entries, exercises): string` (die zwei am häufigsten trainierten Muskelgruppen, mit " + " verbunden; leer ergibt "Training"); `restRemaining(startedAtMs: number, nowMs: number, totalSec: number): number` (nie negativ); `draftToWorkout(draft, finishedAtMs, exercises): Workout` (verwirft nicht abgehakte und leere Sätze, `durationMin` = gerundete Minuten, mindestens 1).
- Datenformen: `exercise = {id, name, muscle}`, `workout = {id?, dateKey, startedAt, durationMin, title, sets: [{exerciseId, kg, reps}]}`, `draft = {dateKey, startedAt, entries: [{exerciseId, sets: [{kg, reps, done}]}]}`.

- [ ] **Step 1: Failing tests** in `tests/training.test.js`: `epley1RM(100, 5)` ist 116.7, `(60, 1)` ist 62, `(0, 10)` ist 0 (Körpergewicht), `(80, 0)` ist `null`; `personalRecords` bei leeren Einheiten ist `[]`; zwei Einheiten mit derselben Übung liefern den besten Satz; `weeklySets` zählt nur die letzten 7 Tage (Einheit vor 8 Tagen zählt nicht) und gruppiert nach Muskel; `muscleDistribution` bei keinen Einheiten ist `[]`, sonst Summe der Prozente 100; `strengthCurve` ist nach Datum sortiert und nimmt je Einheit den besten Satz; `lastSetsFor` ohne Treffer ist `[]`; `isNewRecord` für den allerersten Satz ist `false`, für einen schwereren Folgesatz `true`, für einen leichteren `false`; `daysSinceMuscle` ohne Einheit ist `null`; `workoutTitle` mit zwei Brust- und einer Schulter-Übung ist "Brust + Schultern"; `restRemaining(0, 90000, 90)` ist 0 und `(0, 120000, 90)` ist 0 (nie negativ), `(0, 30000, 90)` ist 60; `draftToWorkout` entfernt nicht abgehakte Sätze und liefert mindestens 1 Minute.
- [ ] **Step 2:** `node --test tests/training.test.js` → FAIL.
- [ ] **Step 3: Implement** alle Funktionen (reine Logik, Wochenbeginn Montag über `weekOf`).
- [ ] **Step 4:** Test → PASS, `npm test` grün.
- [ ] **Step 5: Commit** `feat: reine Logik für Training (Maxima, Rekorde, Verteilung)`.

### Task 18: Datenbank-Funktionen für Übungen und Einheiten

**Files:**
- Modify: `src/db.js`, `tests/backup.test.js`

**Interfaces:**
- Produces: `addExercise(e): Promise<number>`, `listExercises(): Promise<Exercise[]>`, `updateExercise(e): Promise<void>`, `deleteExercise(id): Promise<void>`; `addWorkout(w): Promise<number>`, `updateWorkout(w): Promise<void>`, `deleteWorkout(id): Promise<void>`, `restoreWorkout(w): Promise<void>` (gleiche ID), `listWorkouts(): Promise<Workout[]>`, `workoutsForDate(dateKey): Promise<Workout[]>`; `getTrainingDraft(): Promise<Draft | null>`, `saveTrainingDraft(d): Promise<void>`, `clearTrainingDraft(): Promise<void>` (liegt in `settings.trainingDraft`, wird nicht gesichert).
- Consumes: Speicher aus Task 7.

- [ ] **Step 1: Test** in `tests/backup.test.js`: `buildBackup` entfernt `trainingDraft` (falls Task 7 das noch nicht abdeckt).
- [ ] **Step 2: Implement** die Funktionen in `db.js`.
- [ ] **Step 3: Prüfen im Browser per Skript:** Übung anlegen, Einheit anlegen, `workoutsForDate` liefert sie, löschen und mit `restoreWorkout` wiederherstellen (gleiche ID), Entwurf speichern, lesen, löschen; Export und `replaceAll` enthalten Übungen und Einheiten.
- [ ] **Step 4: Commit** `feat: Datenbank-Funktionen für Übungen, Einheiten und Entwurf`.

### Task 19: Training-Tab und Übungsbibliothek

**Files:**
- Create: `src/views/training.js`
- Modify: `index.html`, `src/nav.js`, `src/app.js`, `src/views/add-menu.js`, `styles.css`, `sw.js`

**Interfaces:**
- Produces: `renderTraining(): Promise<void>` in `#view-training`; Navigation Stufe 2: Heute, Training, Kamera-Button, Verlauf, Mehr. "Mehr" bekommt die Zeile "Gewicht". Der Gewicht-Tab entfällt. Das Kamera-Menü bekommt die Zeile "Training starten".
- Consumes: Funktionen aus Task 17 und 18, `openWorkout` aus Task 20 (bis dahin ein Platzhalter-Aufruf, der in Task 20 ersetzt wird).

- [ ] **Step 1: Implement** `renderTraining`: Titel "TRAINING", Button "Einheit starten" (setzt eine offene Entwurfs-Einheit fort, wenn vorhanden: Hinweis "Offene Einheit fortsetzen"), Karte mit dem heutigen Training oder Tagesstatus, "Letzte Einheiten" (Titel, Datum, Minuten, Anzahl Sätze; Tippen öffnet Details mit "Löschen" und Rückgängig), "Übungen" (Liste nach Muskelgruppe, Anlegen, Umbenennen, Muskelgruppe ändern, Löschen mit Rückgängig; ist die Bibliothek leer, werden `DEFAULT_EXERCISES` zum Hinzufügen angeboten). Leere Zustände sind Einladungen ("Noch keine Einheit. Starte deine erste.").
- [ ] **Step 2: Navigation umbauen** wie in der Schnittstelle beschrieben, `app.js` registriert `renderTraining`.
- [ ] **Step 3: Prüfen im Browser (390 px):** Leere Bibliothek zeigt die Vorschläge, Übung anlegen/ändern/löschen mit Rückgängig, leere Einheitenliste zeigt die Einladung ohne Fehler, die Leiste hat fünf Einträge, "Mehr" enthält "Gewicht", `scrollWidth` gleich Breite.
- [ ] **Step 4:** `npm test` grün.
- [ ] **Step 5: Commit** `feat: Training-Tab und Übungsbibliothek`.

### Task 20: Einheit protokollieren

**Files:**
- Create: `src/views/workout.js`
- Modify: `src/views/training.js`, `src/views/fox.js` (falls für die Rekord-Feier nötig), `styles.css`, `sw.js`

**Interfaces:**
- Produces: `openWorkout({dateKey?: string, resume?: boolean}): void` (Vollbild-Dialog). Ablauf: Übungen hinzufügen (Auswahl mit Suche oder neu anlegen), pro Übung Sätze mit kg und Wiederholungen (Vorbelegung aus `lastSetsFor`, sonst vom vorigen Satz), Abhaken setzt den Satz (kurze Vibration `navigator.vibrate?.(30)`, startet den Pausen-Timer 90 s, einstellbar 30–300 s, am Ende Vibration), "Satz hinzufügen", "Fertig" speichert über `draftToWorkout` und löscht den Entwurf. Jede Änderung speichert den Entwurf (entprellt, höchstens alle 500 ms), das Schließen mit "Abbrechen" fragt nach, ob der Entwurf verworfen werden soll. Bei neuem Rekord (`isNewRecord`) erscheint der Fuchs mit Krone und Funken für 1,6 s und eine Meldung.
- Consumes: `lastSetsFor`, `isNewRecord`, `workoutTitle`, `restRemaining`, `draftToWorkout` (Task 17), Datenbank-Funktionen (Task 18), `prefersReducedMotion` (Task 15).

- [ ] **Step 1: Implement** `workout.js`; `training.js` und das Kamera-Menü rufen `openWorkout` auf; "Training nachtragen" ruft `openWorkout({dateKey})`.
- [ ] **Step 2: Prüfen im Browser (390 px):** Einheit mit zwei Übungen und drei Sätzen anlegen, Vorbelegung vom letzten Mal, Haken startet den Timer (Anzeige zählt herunter), Zeitumbruch bei 0 stoppt bei 0, Einheit speichern erscheint in der Liste mit Titel und Minuten; App neu laden während einer offenen Einheit und mit "Fortsetzen" sind alle Sätze wieder da; Satz mit 0 kg und Satz mit 0 Wiederholungen speichern ohne Fehler (0-Wiederholungen-Sätze fließen nicht in Maxima ein); erster Satz einer neuen Übung löst keinen Rekord aus, ein schwererer Folgesatz schon; mit "Bewegung reduzieren" keine Fuchs-Animation.
- [ ] **Step 3:** `npm test` grün.
- [ ] **Step 4: Commit** `feat: Einheit protokollieren mit Timer, Entwurf und Rekord-Feier`.

### Task 21: Verlauf mit Training und Fortschritt

**Files:**
- Modify: `src/views/history.js`, `src/views/more.js`, `styles.css`

**Interfaces:**
- Produces: Tageskarte im Verlauf zeigt die Einheiten des gewählten Tags (Titel, Minuten, Sätze) und den Button "Training nachtragen" (`openWorkout({dateKey})`). Abschnitt "Fortschritt": Karte "Gewicht" (letzter Wert, Link zur Gewichtsansicht zum Eintragen), "Rekorde" (die drei besten Übungen mit geschätztem Maximum), "Muskelverteilung" (Balken je Muskelgruppe, dazu neutral "Schultern zuletzt vor 9 Tagen" aus `daysSinceMuscle`), "Sätze pro Woche" (Balken der letzten 8 Wochen aus `weeklySetSeries`), "Kraft pro Übung" (Liniendiagramm aus `strengthCurve` mit Auswahl der Übung per Chips). Leere Zustände sind Einladungen.
- Consumes: Funktionen aus Task 17 und 18.

- [ ] **Step 1: Implement** die Karten, Diagramme als eigenes SVG ohne Bibliothek (Stil wie das vorhandene Gewichtsdiagramm).
- [ ] **Step 2: Prüfen im Browser (390 px, mit Beispieltraining über 4 Wochen):** Rekorde, Verteilung (Summe 100 %), Wochenbalken und Kurve stimmen mit den eingegebenen Daten überein (von Hand nachgerechnet, z. B. 100 kg × 5 ergibt 116,7 kg), ohne Training erscheinen nur Einladungen und keine Fehler, "Training nachtragen" für einen früheren Tag speichert am richtigen Datum, kein Überlauf, Text-Scan ohne "null/NaN".
- [ ] **Step 3: Commit** `feat: Verlauf mit Training und Fortschritts-Karten`.

### Task 22: Stufe 2 abschließen und veröffentlichen

**Files:**
- Modify: `README.md`, `sw.js`

- [ ] **Step 1:** README: Training (Ablauf, Timer, Rekorde, Muskelverteilung), neue Navigation, Sicherung enthält Übungen und Einheiten.
- [ ] **Step 2:** `CACHE` auf `kalorientracker-v18`, `npm test` grün.
- [ ] **Step 3: Gesamtprüfung im Browser:** Datenbank-Upgrade-Pfad Version 2 über 3 mit Training-Daten, Sicherung exportieren und per Datei-Import wiederherstellen (Einheiten, Übungen und Tagesstatus kommen zurück), Text-Scan aller Ansichten, `scrollWidth` aller Ansichten, Dunkel und Hell.
- [ ] **Step 4: Commit** `docs: README und Version für Stufe 2`. Nutzer um Freigabe zum Pushen bitten.
