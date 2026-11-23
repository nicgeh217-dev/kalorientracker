# Health Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vitaldaten aus Health Connect (Fitbit/Google Health) in der Android-App zeigen und gegessene Kalorien/Protein abgeschlossener Tage zurückschreiben.

**Architecture:** Reine Logik in `src/vitals.js` (Tageszuordnung, Gewichtsübernahme, welcher Tag geschrieben wird, Fitbit-Trainings). Speicher `vitals` (IndexedDB v4) und Anzeige liegen auf `main` und bleiben in der PWA leer. Plugin-Adapter, Abgleich, Einstellungen und Android-Einrichtung liegen auf `native`.

**Tech Stack:** Vanilla-JS-ES-Module, IndexedDB, Node-Testrunner, Capacitor 8, `@capgo/capacitor-health` 8.x.

**Spec:** `docs/superpowers/specs/2026-11-23-health-connect-design.md`

## Global Constraints
- Ziel bleibt fest. Verbrannte Kalorien stehen nur daneben.
- Keine Bewertung: keine Ampelfarben, keine Ziele oder Pfeile bei Vitalwerten.
- Vitaldaten beeinflussen Fuchs, Serie, Stufe und Stimmung nicht.
- Fitbit-Training zählt als Trainingstag nur, wenn `workoutType !== 'walking'`. Zeitlich überlappend mit einer App-Einheit: ausgeblendet und nicht gezählt.
- In der App eingetragenes Gewicht gewinnt immer. Übernommene tragen `source: 'health'`. Mehrere am Tag: das früheste.
- Rückschreiben nur der direkte Vortag, einmal, nur Kalorien und Protein. Übersprungen: Tage ohne Mahlzeiten, Krankheitstage. Schalter, Standard an.
- Abgleich bei Start und Rückkehr, höchstens alle 5 Minuten. Erstabgleich 90 Tage, danach die letzten 3 Tage.
- Tageszuordnung nach Ortszeit des Handys (`localDateKey`). Schlaf zählt für den Tag, an dem er endet.
- `vitals` in Sicherungsdatei und Online-Sicherung, ohne `syncedAt`. Der Gerätezustand `settings.health` kommt nicht in die Sicherung.
- Jede neue Quelldatei steht in `ASSETS` in `sw.js`, und jede Veröffentlichung erhöht `CACHE`.
- Texte deutsch, ohne Ausrufezeichen. Commit-Fußzeile: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
- **Fitbit schreibt nur einen Teil der Werte:** Fehlt etwa der Ruhepuls oder Schlaf, entsteht trotzdem ein Tagesdatensatz mit den vorhandenen Feldern, und die Karte zeigt nur diese. Abgedeckt in Task 1 und 3.
- **Mehrere Schlafsitzungen oder ein Nickerchen:** Minuten werden zum End-Tag addiert, wach und „im Bett“ zählen nicht. Abgedeckt in Task 1.
- **Plugin wirft Fehler oder Health Connect fehlt:** Der Abgleich bricht still ab, die App läuft weiter, und `lastSyncAt` bleibt unverändert. Abgedeckt in Task 5.
- **Training ohne Dauer:** Nachgetragene App-Einheiten (`durationMin: null`) gelten nie als Überschneidung. Abgedeckt in Task 1.
- **Alte Sicherung ohne `vitals`:** Die Wiederherstellung funktioniert und der Speicher bleibt leer. Abgedeckt in Task 2.

---

### Task 1: Reine Logik `src/vitals.js` (main)

**Files:** Create `src/vitals.js`, `tests/vitals.test.js`.

**Interfaces – Produces:**
- `dayKeyOf(iso: string): string` gibt `localDateKey(new Date(iso))` zurück.
- `sumByDay(samples: {startDate, value}[]): Record<dateKey, number>` summiert die Werte je Tag des Startzeitpunkts.
- `valueByDay(samples): Record<dateKey, number>` nimmt den letzten Wert je Tag, z. B. für den Ruhepuls.
- `sleepByDay(samples): Record<dateKey, {sleepMin, sleepStart, sleepEnd}>`:
  - Je Probe zählen ihre `stages` mit einer Phase außer `awake` und `inBed` über `durationMinutes`. Ohne Phasen zählt `value`, außer bei `sleepState` `awake` oder `inBed`.
  - Zugeordnet wird `dayKeyOf(endDate)`. `sleepStart` ist das Minimum, `sleepEnd` das Maximum. Minuten werden gerundet.
- `WORKOUT_LABELS` übersetzt z. B. `running` → Laufen, `walking` → Gehen, `cycling` → Radfahren, `strengthTraining` und `functionalStrengthTraining` → Krafttraining, `swimming` und `swimmingPool` → Schwimmen, `hiking` → Wandern, `yoga` → Yoga, `elliptical` → Crosstrainer, `rowing` → Rudern, `stairClimbing` → Treppensteigen. Alles andere wird zu „Training“.
- `toFitbitWorkout(w): {type, title, start, end, durationMin, kcal}`, mit `durationMin = Math.round(duration/60)` und `kcal = Math.round(totalEnergyBurned)` bzw. `null`.
- `buildVitalsDays({steps, activeKcal, totalKcal, restingHr, sleep, workouts}, now): VitalsDay[]` ergibt einen Datensatz je Tag, an dem irgendein Feld existiert: `{dateKey, steps?, activeKcal?, totalKcal?, restingHr?, sleepMin?, sleepStart?, sleepEnd?, workouts?: FitbitWorkout[], syncedAt: now}`. Fehlende Felder bleiben weg.
- `visibleFitbitWorkouts(fitbit: FitbitWorkout[], appWorkouts): FitbitWorkout[]` entfernt Überschneidungen mit App-Einheiten. Deren Zeitraum ist `[startedAt, startedAt + durationMin·60000]`, nur wenn `durationMin != null`.
- `fitbitTrainingDays(vitalsDays, appWorkouts): string[]` liefert die Tage mit mindestens einem sichtbaren Fitbit-Training, dessen `type !== 'walking'`.
- `weightsToImport(samples: {startDate, value}[], appWeights: {date, kg, source?}[]): {date, kg, source:'health'}[]` nimmt das früheste je Tag. Übersprungen wird, wenn die App für das Datum ein Gewicht ohne `source: 'health'` hat oder dasselbe `kg` mit `source: 'health'`. `kg` wird auf eine Nachkommastelle gerundet.
- `dayToWrite({todayKey, meals, status, written: string[]}): {dateKey, kcal, protein} | null` nimmt nur den Vortag. Ergebnis ist `null`, wenn der Tag schon geschrieben ist, keine Mahlzeiten hat oder `status === 'sick'`. `kcal` und `protein` sind die gerundeten Summen.
- `syncWindow({lastSyncAt, now}): {start, end}` reicht 90 Tage zurück, wenn `lastSyncAt == null`, sonst 3 Tage vor Tagesbeginn heute. `end = now`, als ISO-Zeiten.
- `shouldSync(lastAttemptAt, now): boolean` wird wahr, wenn `lastAttemptAt` null ist oder mindestens 5 Minuten zurückliegt.
- `formatSleep(min): string` gibt z. B. `"7 h 12 min"` oder `"45 min"` zurück.
- `avgSteps(vitalsDays, dateKeys: string[]): number | null` mittelt nur über Tage mit Schritten und rundet.

- [ ] **Step 1: Tests schreiben**, je Funktion mindestens:
  - Schlaf: zwei Sitzungen enden am selben Tag und werden addiert. Phasen `awake` zählen nicht. Eine Nacht über Mitternacht zählt zum End-Tag.
  - `weightsToImport`: App-Gewicht gewinnt, Korrektur eines `health`-Werts wird übernommen, es gilt das früheste.
  - `dayToWrite`: Vortag mit Mahlzeiten ergibt die Summen. Leer, krank oder schon geschrieben ergeben `null`. Heute wird nie geschrieben.
  - Überschneidung: Ein überlappendes Fitbit-Training verschwindet. Eine App-Einheit ohne Dauer überlappt nie.
  - `fitbitTrainingDays` ignoriert `walking`.
  - `buildVitalsDays` mit nur Schritten ergibt einen Datensatz ohne die anderen Felder.
- [ ] **Step 2:** Run `node --test tests/vitals.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3:** `src/vitals.js` umsetzen.
- [ ] **Step 4:** Run `npm test`. Expected: alle grün.
- [ ] **Step 5:** Commit `feat: Logik für Vitaldaten aus Health Connect`.

### Task 2: Speicher und Sicherung (main)

**Files:** Modify `src/db.js`, `src/backup.js`, `sw.js`. Tests: `tests/backup.test.js`.

**Interfaces – Produces:**
- `putVitalsDays(days: VitalsDay[])` ersetzt je Tag den ganzen Datensatz.
- `listVitals(): VitalsDay[]` gibt die Tage nach `dateKey` sortiert zurück.
- `vitalsForDate(dateKey): VitalsDay | undefined`.
- `putWeights(list: {date, kg, source?}[])`.
- DB-Version 4 mit Store `vitals` (keyPath `dateKey`). `vitals` steht in `STORES`, `exportAll` und `replaceAll`.
- `buildBackup` nimmt `vitals` ohne `syncedAt` auf und entfernt `settings.health`.
- `parseBackup` akzeptiert ein fehlendes `vitals` als `[]` und prüft jedes Element auf `isObj` und `typeof dateKey === 'string'`.

- [ ] **Step 1: Tests schreiben**:
  - `buildBackup` enthält `vitals` ohne `syncedAt` und kein `settings.health`.
  - `parseBackup` einer v2-Sicherung ohne `vitals` liefert `data.vitals` als `[]`.
  - Ein ungültiger `vitals`-Eintrag ergibt einen Fehler.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Umsetzen. Die Sicherungsversion bleibt 2, das Feld ist optional.
- [ ] **Step 4:** Run `npm test`, alle grün. Danach im Browser: Bestehende Daten bleiben nach dem Upgrade erhalten (eine Mahlzeit vorher anlegen, nach dem Neuladen prüfen).
- [ ] **Step 5:** Commit `feat: Speicher für Vitaldaten, Teil der Sicherung`.

### Task 3: Anzeige (main)

**Files:** Create `src/views/body-card.js`. Modify `src/views/today.js`, `src/views/history.js`, `src/views/training.js`, `src/training.js`, `src/week.js`, `styles.css`, `sw.js`. Tests: `tests/training.test.js`, `tests/week-review.test.js`.

**Interfaces – Consumes:** Task 1 und 2. **Produces:**
- `bodyCard(day: VitalsDay | undefined): Element | null` gibt `null` zurück, wenn kein Wert da ist.
- `trainingDaysThisWeek(workouts, todayKey, extraDays: string[] = [])`.
- `weekReview({…, extraTrainingDays = []})`. `trainingDays` zählt die Vereinigung, `sets` bleibt nur aus App-Einheiten.

- [ ] **Step 1: Tests schreiben**:
  - `trainingDaysThisWeek` zählt einen Extra-Tag einmal, auch wenn am selben Tag eine App-Einheit liegt.
  - `weekReview` zählt Extra-Tage mit, `sets` bleibt unverändert.
  - Bestehende Tests bleiben unverändert grün.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Umsetzen:
  - **Heute:** `bodyCard(vitalsForDate(dateKey))` unter der Nährstoff-Reihe. Bis zu vier Zahlen wie in der Nährstoff-Reihe: Schritte, verbrannte kcal (`totalKcal ?? activeKcal`), Ruhepuls, Schlaf.
  - **Verlauf, Tageskarte:** eine Zeile mit denselben Werten.
  - **Verlauf, Wochenrückblick:** Zeile „Ø 8.412 Schritte am Tag“, wenn `avgSteps` nicht null ist.
  - **Verlauf, Fortschritt:** Karte „Körper“ mit Chips Schritte, Kalorien, Ruhepuls und Schlaf und `curveChart` der letzten 56 Tage. Die Karte entfällt, wenn es keine Werte gibt.
  - **Training:** In „Letzte Einheiten“ werden sichtbare Fitbit-Trainings eingemischt, nach Datum sortiert, mit dem Titel und „Fitbit · 32 min · 280 kcal“. Sie sind nicht anklickbar. Wochenziel mit `fitbitTrainingDays`.
- [ ] **Step 4:** Run `npm test`. Im Browser mit eingespielten `vitals` prüfen: Heute, Verlauf, Training. Ohne `vitals` darf keine leere Karte erscheinen.
- [ ] **Step 5:** Commit `feat: Vitaldaten auf Heute, im Verlauf und im Training anzeigen`, mit erhöhtem `CACHE`.

### Task 4: Plugin-Adapter und Android-Einrichtung (native)

**Files:** Create `src/native-health.js`, `tests/native-health.test.js`, `privacypolicy.html`. Modify `package.json`, `scripts/build-web.mjs` (Datenschutzseite mitkopieren), `android/app/src/main/AndroidManifest.xml`, `sw.js`.

**Interfaces – Produces:** `healthClient({cap = globalThis.Capacitor})` liefert:
- `available(): Promise<boolean>`
- `connect(): Promise<{granted: string[]}>` ruft `requestAuthorization` mit `read: ['steps','calories','totalCalories','restingHeartRate','sleep','weight','workouts']`, `write: ['dietaryEnergyConsumed','dietaryProtein']` und `requestHistoryAccess: true`.
- `readAll({start, end}): Promise<{steps, activeKcal, totalKcal, restingHr, sleep, workouts, weights}>`:
  - Aggregiert je Tag: `queryAggregated` für steps, calories und totalCalories (sum) sowie restingHeartRate (average).
  - Samples: `readSamples` für sleep und weight mit `limit 1000`.
  - Trainings: `queryWorkouts` mit Seiten über `anchor`, höchstens 10 Seiten.
  - Fehler eines einzelnen Typs ergeben eine leere Liste für diesen Typ.
- `writeDay({dateKey, kcal, protein}): Promise<void>` schreibt zwei `saveSample` über den ganzen Tag, von 00:00 bis 23:59:59 Ortszeit.
- `openSettings()` und `showPrivacy()`.
- Im Browser ist alles ein No-op, `available` ist dann `false`.

- [ ] **Step 1: Tests schreiben** mit gefälschtem `cap.nativePromise('Health', …)` wie in `tests/native-camera.test.js`:
  - `connect` ruft mit den genannten Listen auf.
  - `readAll` geht Seiten durch, bis `anchor` fehlt.
  - Ein Typ, der fehlschlägt, ergibt eine leere Liste, die anderen kommen trotzdem.
  - `writeDay` erzeugt zwei Proben mit lokalen Tagesgrenzen.
  - Im Browser passiert nichts.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Umsetzen:
  - `npm install @capgo/capacitor-health@^8`.
  - Im Manifest fehlende Health-Rechte ergänzen, nach Abgleich mit dem Manifest des Plugins im Paket: `READ_ACTIVE_CALORIES_BURNED`, `READ_TOTAL_CALORIES_BURNED`, `READ_RESTING_HEART_RATE`, `READ_SLEEP`, `READ_WEIGHT`, `READ_EXERCISE`, `WRITE_NUTRITION`, `READ_HEALTH_DATA_HISTORY`.
  - Die Datenschutz-Einbindung nach der README des Plugins einrichten.
  - `privacypolicy.html`, kurz und deutsch: Daten bleiben auf dem Handy, außer verschlüsselt in der eigenen Sicherung, nichts geht an Dritte.
- [ ] **Step 4:** Run `npm test`, alle grün. Den Build über GitHub Actions anstoßen. Erwartet: Er ist erfolgreich.
- [ ] **Step 5:** Commit `feat(native): Health-Connect-Adapter und Android-Einrichtung`.

### Task 5: Abgleich (native)

**Files:** Create `src/health-sync.js`, `tests/health-sync.test.js`. Modify `src/app.js`.

**Interfaces – Consumes:** Task 1, 2 und 4. **Produces:**
- `syncHealth({client, store, now}): Promise<'skipped' | 'done' | 'failed'>`. `store` kapselt die DB-Funktionen und `getSettings`/`saveSettings`, damit es in Tests gefälscht werden kann.
- Gerätezustand `settings.health = {connected, lastSyncAt, lastAttemptAt, written: string[], sendNutrition: true}`.

- [ ] **Step 1: Tests schreiben**:
  - Nicht verbunden ergibt `'skipped'`.
  - Liegt der letzte Versuch weniger als 5 Minuten zurück, ergibt das `'skipped'`.
  - Der Erstabgleich nutzt das 90-Tage-Fenster.
  - Der Abgleich speichert Tage und übernimmt Gewichte.
  - Der Vortag wird geschrieben und vermerkt, bei `sendNutrition: false` nicht.
  - Bei einem Plugin-Fehler bleiben `lastSyncAt` unverändert und `written` leer, das Ergebnis ist `'failed'`, ohne Ausnahme.
  - `written` behält nur die letzten 14 Einträge.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Umsetzen. In `app.js`: nur bei nativer App `syncHealth` beim Start und bei `visibilitychange` sichtbar aufrufen. Bei `'done'` folgt `refreshCurrent()`.
- [ ] **Step 4:** Run `npm test`, alle grün.
- [ ] **Step 5:** Commit `feat(native): Abgleich mit Health Connect`.

### Task 6: Einstellungen (native)

**Files:** Modify `src/views/settings.js`.

- [ ] **Step 1:** Ein Abschnitt „Health Connect“ erscheint nur, wenn `healthClient().available()` wahr ist:
  - Nicht verbunden: „Verbinden“ ruft `connect()` auf. Danach werden `connected: true` gesetzt und `syncHealth` sofort ausgeführt, ohne die 5-Minuten-Sperre.
  - Verbunden: erlaubte Werte als Text, „Letzter Abgleich“, Schalter „Gegessene Kalorien an Health Connect senden“, „Health Connect öffnen“, „Datenschutz“ und „Trennen“ (setzt `connected: false`).
  - Hinweis: In der Fitbit- bzw. Google-Health-App muss die Synchronisierung mit Health Connect eingeschaltet sein.
- [ ] **Step 2:** Prüfung im Browser mit gefälschtem Capacitor: Verbinden, Trennen und Schalter ändern `settings.health`.
- [ ] **Step 3:** Run `npm test`. Commit `feat(native): Health Connect in den Einstellungen`.

### Task 7: Abschluss
- [ ] `main` in `native` zusammenführen, `CACHE` prüfen, den APK bauen lassen und prüfen: Er ist vollständig, mit festem Zertifikat (Vergleich mit dem vorigen APK) und enthält das Plugin in `capacitor.plugins.json`.
- [ ] Ein frischer Prüfer liest den ganzen Zweig gegen, die Befunde werden behoben.
