# Mehr Werte und Zusammenhänge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zusätzliche, auswählbare Werte aus Health Connect und eine Karte „Zusammenhänge“, die die App rechnet und Gemini freundlich formuliert.

**Architecture:** Ein Katalog `src/health-metrics.js` beschreibt jeden Wert: Health-Connect-Typ, Tagesfelder und Anzeige. Rechnen, Prüfen und Formulieren der Zusammenhänge liegen in `src/insights.js`, der Gemini-Aufruf in `src/gemini.js`. Lesen und Auswahl in der App liegen auf `native`.

**Tech Stack:** Vanilla-JS-ES-Module, IndexedDB, Node-Testrunner, Capacitor 8, `@capgo/capacitor-health` 8.13, Gemini REST.

**Spec:** `docs/superpowers/specs/2026-11-24-mehr-daten-und-zusammenhaenge-design.md`

## Global Constraints
- Keine Bewertung in der Anzeige, kein Einfluss auf Ziel, Fuchs oder Serie.
- Zusammenhänge nur auf Knopfdruck. Es werden nur die Ergebnisse an Gemini geschickt, keine Tageswerte, Mahlzeiten oder Daten. Gewicht gehört nicht dazu.
- Ein Zusammenhang gilt nur mit mindestens 5 Tagen je Gruppe und mindestens 10 % Unterschied, bezogen auf den kleineren Mittelwert. Grundlage sind 56 Tage.
- „Kalorien“ und „Protein“ heißt gegessen. Krankheitstage zählen nicht. `late_sleep` nutzt nur Mahlzeiten mit Tag des Zeitstempels gleich `dateKey`.
- Zulässig sind nur die gelieferten Zahlen: Mittelwerte, Tage, Unterschied absolut und in Prozent, Schwellen. Jeweils sind auch gerundete Formen erlaubt, auf ganze Zahlen, Zehner und Hunderter.
- Verbotene Wörter: `solltest`, `musst`, `müssen`, `zu viel`, `zu wenig`, `schlecht`, `Diät`, `abnehmen`, `zunehmen`, `Gewicht`, `Fehler`, `verboten`.
- Fehlt `settings.health.metrics`, gelten alle Werte als eingeschaltet. Die App fragt nie ohne Tippen nach Rechten.
- `settings.insights` ist Gerätezustand und kommt nicht in die Sicherung.
- Gebaut wird nur `arm64-v8a` und `armeabi-v7a`.
- Neue Dateien kommen in `ASSETS` in `sw.js`, `CACHE` wird erhöht. Commit-Fußzeile: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
- **Gemini schreibt eine Zahl, die die App nicht geliefert hat:** Der Hinweis wird verworfen. Abgedeckt in Task 3.
- **Kein Zusammenhang erfüllt die Schwellen:** Freundlicher Text ohne Gemini-Aufruf. Abgedeckt in Task 3 und 4.
- **Ein Wert ist abgeschaltet:** Er wird nicht gelesen und nirgends gezeigt, gespeicherte Werte bleiben. Abgedeckt in Task 2 und 5.
- **Puls nur stundenweise:** Min und Max je Tag stimmen exakt, Ø ist das Mittel der Stundenmittel. Abgedeckt in Task 1.
- **Schlaf ohne Phasendaten:** Es gibt keine Phasenfelder und keine leere Phasen-Zeile. Abgedeckt in Task 1 und 2.

---

### Task 1: Katalog und neue Tagesfelder (main)
**Files:** Create `src/health-metrics.js`, `tests/health-metrics.test.js`. Modify `src/vitals.js`, `tests/vitals.test.js`.

**Produces:**
- `METRICS: {id, label, hc: string[], fields: string[], text(day): string | null, tile(day): {value, unit?} | null, chart?: {label, value(day): number | undefined, caption}[]}[]` mit den ids `steps`, `distance`, `floors`, `kcal`, `restingHr`, `hr`, `hrv`, `spo2`, `respRate`, `vo2max`, `sleep`, `bodyFat`, `weight` und `workouts`. Die Health-Connect-Typen gehen aus der Tabelle in der Spec hervor. `kcal` umfasst `calories` und `totalCalories`.
- `enabledMetrics(settings): string[]` liefert `settings.health?.metrics ?? alle ids`.
- `hcTypesFor(ids): string[]`.
- In `vitals.js`: `buildVitalsDays` nimmt zusätzlich `distance`, `floors`, `hr` (Stundenproben mit `values.average/min/max`), `hrv`, `spo2`, `respRate`, `vo2max` und `bodyFat`. `sleepByDay` liefert `sleepDeep`, `sleepRem`, `sleepLight` und `sleepAwake`, nur wenn Phasen da sind. `mergeVitalsDays` nimmt die Felder aus `METRICS`. Die Schlüssel für `read` sind die Rohschlüssel von `readAll`.

- [ ] Tests:
  - Puls je Tag: Min ist das Minimum der Stunden-Mins, Max das Maximum, Ø das gerundete Mittel.
  - Strecke wird in Metern summiert.
  - Phasen werden aus Start und Ende summiert und zum End-Tag gezählt, ohne `stages` gibt es keine Phasenfelder.
  - `bodyFat` als letzter Wert mit einer Nachkommastelle, `spo2`, `hrv` und `respRate` als gerundetes Tagesmittel.
  - `mergeVitalsDays` mit `read: ['hr']` ersetzt nur `hrAvg`, `hrMin` und `hrMax`.
  - `enabledMetrics` ohne `metrics` ergibt alle.
  - Jeder Eintrag in `METRICS` hat `text` und `tile`, die `null` liefern, wenn der Wert fehlt.
- [ ] Rot sehen, umsetzen, `npm test` ist grün. Commit.

### Task 2: Anzeige nach Auswahl (main)
**Files:** Modify `src/views/body-card.js`, `src/views/today.js`, `src/views/history.js`, `styles.css`, `sw.js`.

**Consumes:** Task 1.

- [ ] Änderungen:
  - `bodyCard(day, enabled)` zeigt Kacheln in Reihen zu je 4. Unter der Kachelreihe steht die Phasen-Zeile „Tief 1 h 20 · REM 1 h 40 · Leicht 3 h 50“, falls `sleep` an ist und Phasen da sind.
  - `bodyLine(day, enabled)`.
  - Die Diagramm-Chips kommen aus `METRICS[].chart`, gefiltert nach `enabled`.
  - Heute und Verlauf lesen `enabledMetrics(settings)`.
- [ ] Im Browser mit eingespielten `vitals` und `settings.health.metrics` prüfen: Abgeschaltete Werte fehlen überall, nichts ragt über den Rand. Commit.

### Task 3: Zusammenhänge rechnen und prüfen (main)
**Files:** Create `src/insights.js`, `tests/insights.test.js`.

**Produces:**
- `computeFindings({meals, vitals, workouts, days, todayKey}): Finding[]`. Ein `Finding` ist `{id, text, a: {label, mean, n}, b: {label, mean, n}, unit, diff, pct, thresholds: number[]}`. Ausgewertet werden die 7 Vergleiche aus der Spec über die 56 Tage bis gestern, sortiert nach `pct` absteigend.
- `allowedNumbers(findings): Set<number>` enthält alle Zahlen samt gerundeten Formen.
- `checkHint(text, allowed): boolean` prüft auf verbotene Wörter und auf jede Zahl im Text.
- `fallbackSentences(findings): string[]` liefert schlichte Sätze aus den Ergebnissen, zum Beispiel „Nach Nächten unter 6 h: Ø 2.350 kcal, nach 7 h und mehr: Ø 1.950 kcal (41 Tage)“.

- [ ] Tests:
  - `sleep_kcal` mit 6 kurzen und 6 langen Nächten und klarem Unterschied wird gemeldet.
  - Bei 4 Tagen in einer Gruppe nicht, bei 8 % Unterschied nicht.
  - Krankheitstage und Tage ohne Mahlzeit zählen nicht.
  - `late_sleep` ignoriert nachgetragene Mahlzeiten.
  - `weekend_kcal`, `training_sleep` (Nacht danach) und `steps_kcal` (Median) sind abgedeckt.
  - `checkHint` lehnt „solltest“ und die fremde Zahl „2500“ ab und akzeptiert „rund 400 kcal mehr“, wenn `diff` 412 ist.
- [ ] Rot sehen, umsetzen, grün. Commit.

### Task 4: Gemini und Karte „Zusammenhänge“ (main)
**Files:** Modify `src/gemini.js`, `src/backup.js`, `src/views/history.js`, `sw.js`. Create `src/views/insights-card.js`, `tests/insights-gemini.test.js`.

**Produces:**
- `insightsRequestBody(findings)` mit `responseSchema` `{observations: [{title, text}], suggestions: [{text}]}`, Prompt-Regeln aus der Spec, nur `findings` als Daten.
- `parseInsightsResponse(apiJson)`.
- `askInsights(findings, key, model)` wirft nie.
- `insightsCard(state, rerender)`:
  - Ein Knopf „Zusammenhänge finden“.
  - Beim ersten Mal (`settings.insights?.consented`) ein Hinweis, was verschickt wird.
  - Ohne Ergebnisse gibt es den freundlichen Text ohne Aufruf.
  - Nach der Antwort filtert `checkHint`. Bleibt nichts übrig, kommt `fallbackSentences`.
  - Gespeichert wird in `settings.insights = {consented, at, observations, suggestions}`, angezeigt mit „Stand vom …“ und „Neu finden“.
  - Ohne Key oder offline kommt ein ruhiger Hinweis.
- `buildBackup` entfernt `insights`.

- [ ] Tests:
  - Der Request enthält nur die Findings, ohne `dateKey` und ohne Mahlzeitennamen, mit `responseSchema`.
  - Der Parse kürzt auf je 3.
  - `buildBackup` enthält kein `insights`.
- [ ] Im Browser mit gefälschtem Gemini durchspielen: Hinweis beim ersten Mal, eine Antwort mit fremder Zahl wird gefiltert, der Rückfall auf schlichte Sätze greift. Commit.

### Task 5: Lesen und Auswahl in der App (native)
**Files:** Modify `src/native-health.js`, `src/health-sync.js`, `src/views/health-ui.js`, Tests dazu.

- [ ] Änderungen:
  - `readAll(range, types)` liest nur die angefragten Typen. Neue Typen:
    - `heartRate` stündlich mit `aggregation: ['average','min','max']`
    - `distance` stündlich als Summe
    - `flightsClimbed`, `heartRateVariability`, `oxygenSaturation`, `respiratoryRate`, `vo2Max` und `bodyFat` wochenweise als Einzelwerte
  - `connect(types)`.
  - `syncHealth` liest `hcTypesFor(enabledMetrics(settings))`.
  - Einstellungen:
    - Liste mit Schaltern je Wert, „Recht fehlt“ bei fehlender Freigabe, Knopf „Neue Werte freigeben“.
    - Schalter an ohne Recht: `connect` nur für diesen Wert, danach `lastSyncAt: null`.
    - Schalter aus: nur aus `metrics` entfernen.
- [ ] Tests:
  - `readAll` fragt nur angefragte Typen ab.
  - Puls-Aggregation mit drei Werten.
  - `syncHealth` liest bei abgeschaltetem Schlaf keinen Schlaf.
- [ ] Im Browser mit gefälschtem Plugin prüfen: Schalter, „Neue Werte freigeben“, „Recht fehlt“. Commit.

### Task 6: Kleinerer APK (native)
- [ ] In `android/app/build.gradle` steht `ndk { abiFilters 'arm64-v8a', 'armeabi-v7a' }` in `defaultConfig`. Commit.

### Task 7: Abschluss
- [ ] Ein frischer Prüfer liest den ganzen Umbau gegen, die Befunde werden behoben.
- [ ] Nach `ok push` folgen Build, Prüfung des APK (unter 30 MB, Zertifikat, Plugin) und der Versand.
