# Mehr Werte aus Health Connect und Zusammenhänge mit Gemini

Stand: 2026-11-24, von Nic freigegeben ("Weglassen wie vorgeschlagen, mach es so"). Baut auf `2026-11-23-health-connect-design.md` auf.

## Absicht
Nic will alles in einer App: mehr Werte aus Google (Fitbit, Google Health), selbst ausgewählt, und die App soll Zusammenhänge zwischen Essen, Training, Schlaf und Körperwerten zeigen. Gemini formuliert sie, **freundlich und ohne Druck, mit Beobachtungen und Vorschlägen** (Wortlaut von Nic). Reihenfolge: erst die Werte (Teil A), dann die Zusammenhänge (Teil B). Nebenbei wird der APK kleiner (Teil C).

## Ziele
- **A:** Zusätzliche Werte lesen und zeigen. Nic wählt in den Einstellungen per Schalter, was gelesen und gezeigt wird.
- **B:** Eine Karte "Zusammenhänge" im Verlauf. Auf Knopfdruck rechnet die App Zusammenhänge auf dem Handy aus, Gemini formuliert daraus bis zu drei Beobachtungen und bis zu drei Vorschläge.
- **C:** Der APK passt wieder unter die 30-MB-Grenze des Chats.

## Nicht-Ziele
- Keine Zusammenhänge ohne Knopfdruck, keine Benachrichtigungen dazu, kein Fuchs, der sie kommentiert.
- Kein Einfluss auf Kalorienziel, Fuchs, Serie (wie bisher).
- Keine medizinischen Aussagen, keine Diagnosen.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)
- Druck oder Schuld: "solltest", "musst", "zu viel", "schlecht", Verbote, Diätsprache, Bewertung von Gewicht oder Körper.
- Erfundene oder falsche Zahlen in einem Hinweis.
- Ein Zusammenhang aus zu wenigen Tagen, der wie eine Tatsache klingt.
- Tageswerte oder Mahlzeitennamen gehen an Gemini.

## Randbedingungen
- Plugin `@capgo/capacitor-health` 8.13. Als Stundenwerte aggregierbar: steps, distance, calories (sum); heartRate, restingHeartRate, weight (average, min, max). Alles andere nur als Einzelwerte (`readSamples`). Die Rechte im Manifest bringt das Plugin für alle hier genannten Typen mit.
- Gemini: der vorhandene Key und das vorhandene Modell des Nutzers, Aufruf wie bei der Etiketten-Erkennung (mit Ausweichmodell).
- Teil A nur in der Android-App. Teil B auch in der PWA (dort ohne Health-Werte, nur Essen, Training, Gewicht).

## Approaches (Teil B)
1. **Die App rechnet, Gemini formuliert** (gewählt): sichere Zahlen, nur Ergebnisse verlassen das Handy. Grenze: nur vordefinierte Zusammenhänge.
2. Gemini bekommt alle Tageswerte: flexibler, aber mehr Daten weg und Rechenfehler möglich. Verworfen.
3. Nur feste Textbausteine ohne Gemini: steif, widerspricht "freundlich". Verworfen.

## Teil A: Werte und Auswahl

### Werte
| Wert | Health-Connect-Typ | Lesen | Tagesfeld(er) | Anzeige |
|---|---|---|---|---|
| Schritte | steps | Stunden, Summe | steps | 8.412 |
| Strecke | distance | Stunden, Summe | distanceM | 6,2 km |
| Stockwerke | flightsClimbed | Einzelwerte, Summe | floors | 12 |
| Kalorien aktiv / gesamt | calories / totalCalories | wie bisher | activeKcal / totalKcal | wie bisher |
| Ruhepuls | restingHeartRate | Stunden, Ø | restingHr | wie bisher |
| Puls | heartRate | Stunden, Ø/Min/Max | hrAvg, hrMin, hrMax | Ø 72 (54 bis 148) |
| HRV | heartRateVariability | Einzelwerte, Ø | hrv | 42 ms |
| Sauerstoff | oxygenSaturation | Einzelwerte, Ø | spo2 | 96 % |
| Atemfrequenz | respiratoryRate | Einzelwerte, Ø | respRate | 14 /min |
| VO2max | vo2Max | Einzelwerte, letzter | vo2max | 44 |
| Schlaf | sleep | wie bisher, plus Phasen | sleepMin, sleepStart, sleepEnd, sleepDeep, sleepRem, sleepLight, sleepAwake | 7 h 12 min, darunter Phasen |
| Körperfett | bodyFat | Einzelwerte, letzter | bodyFat | 18,4 % |
| Gewicht, Trainings | wie bisher | wie bisher | wie bisher | wie bisher |

- Tageszuordnung, Zusammenführen und Teilfehler wie bisher (`mergeVitalsDays`). Neue Felder gehören zu ihrem Typ.
- Schlafphasen: Minuten je Phase aus den `stages`, zum Tag, an dem der Schlaf endet. Ohne Phasendaten fehlen die Phasenfelder.

### Auswahl
- Einstellungen, Abschnitt Health Connect: eine Liste "Werte" mit einem Schalter je Zeile der Tabelle (Gewicht und Trainings je eigener Schalter).
- **Beim ersten Verbinden sind alle eingeschaltet.** Ein Schalter aus: der Wert wird nicht mehr gelesen und nirgends gezeigt (gespeicherte Werte bleiben, werden aber ausgeblendet). Ein Schalter an für einen Wert ohne Recht: die App fragt Health Connect nur nach diesem Recht und lädt seinen Verlauf.
- Gespeichert im Gerätezustand `settings.health.metrics` (Liste der eingeschalteten ids).
- **Nach dem Update (schon verbunden):** Fehlt `metrics`, gelten alle Werte als eingeschaltet. Werte ohne Recht stehen in der Liste mit dem Zusatz „Recht fehlt“, darüber ein Knopf „Neue Werte freigeben“, der Health Connect in einem einzigen Dialog nach allen fehlenden Rechten fragt und danach deren Verlauf lädt. Die App fragt nie von selbst ohne Tippen. *(Entscheidung des Entwurfs)*

### Anzeige
- **Heute:** Karte "Körper" zeigt alle eingeschalteten Tageswerte in Reihen zu je 4. Schlaf zeigt unter der Dauer die Phasen als eine Zeile (z. B. "Tief 1 h 20 · REM 1 h 40 · Leicht 3 h 50").
- **Verlauf:** Tageskarte nennt alle eingeschalteten Werte des Tages in einer Zeile. Karte "Körper" hat einen Chip je eingeschaltetem Wert mit Kurve (Puls: Ø; Schlafphasen: Tiefschlaf und REM als eigene Chips).
- Weiterhin keine Farben für gut oder schlecht, keine Zielwerte.

## Teil B: Zusammenhänge

### Was die App rechnet (auf dem Handy)
Grundlage: die letzten 56 Tage. Jeder Zusammenhang vergleicht zwei Gruppen von Tagen und meldet die Mittelwerte, die Zahl der Tage je Gruppe und den Unterschied.

| id | Vergleich | Zielwert |
|---|---|---|
| sleep_kcal | Nacht unter 6 h gegen 7 h und mehr (Schlaf, der am Tag endet) | Kalorien desselben Tags |
| steps_kcal | Schritte über gegen unter dem Median | Kalorien desselben Tags |
| training_kcal | Trainingstag gegen ohne Training | Kalorien und Protein desselben Tags |
| training_sleep | Trainingstag gegen ohne Training | Schlaf der folgenden Nacht |
| late_sleep | letzte Mahlzeit nach 21 Uhr gegen früher | Schlaf der folgenden Nacht |
| weekend_kcal | Samstag/Sonntag gegen Montag bis Freitag | Kalorien |
| sleep_restinghr | Nacht unter 6 h gegen 7 h und mehr | Ruhepuls desselben Tags |

- "Kalorien" und "Protein" heißt in Teil B immer **gegessen** (eingetragene Mahlzeiten), nicht verbrannt. *(Entscheidung des Entwurfs)*
- Ein Tag zählt nur, wenn beide Seiten Werte haben. Kalorien zählen nur an Tagen mit mindestens einer Mahlzeit; Krankheitstage zählen nicht.
- **late_sleep:** Die Uhrzeit einer Mahlzeit ist die Eintragezeit. Sie zählt nur, wenn die Mahlzeit am selben Kalendertag eingetragen wurde, an dem sie gegessen wurde (Tag des Zeitstempels = dateKey). Tage, deren Mahlzeiten nachgetragen wurden, fallen aus diesem Vergleich heraus. *(Entscheidung des Entwurfs)*
- **Gemeldet wird ein Zusammenhang nur bei mindestens 5 Tagen je Gruppe und mindestens 10 % Unterschied.** Gibt es keinen, sagt die Karte das freundlich ("Noch keine klaren Zusammenhänge. Mit mehr eingetragenen Tagen wird das besser.") ohne Gemini aufzurufen.
- Gewicht ist bewusst nicht dabei, damit sich nichts wie eine Bewertung des Körpers anfühlt. *(Entscheidung von Nic)*

### Was an Gemini geht
- Nur die gemeldeten Zusammenhänge: id, eine kurze deutsche Beschreibung, beide Mittelwerte mit Einheit, Tage je Gruppe, **der Unterschied (absolut und in Prozent, gerundet) und die Schwellen des Vergleichs** (z. B. 6 h, 7 h, 21 Uhr, 56 Tage). Keine Tageswerte, keine Mahlzeiten, keine Daten.
- Antwortschema: `observations` (bis 3, je Titel und Text) und `suggestions` (bis 3, je Text).
- Regeln im Prompt: du-Form, freundlich, ohne Druck; Vorschläge als Einladung ("Wenn du magst, …"); nie "solltest", "musst", "zu viel", "schlecht"; keine Diätsprache, keine Aussagen über Gewicht oder Körper; keine Medizin; erwähnt, dass ein Zusammenhang keine Ursache beweist; **nur Zahlen aus den gelieferten Ergebnissen**.
- Die App prüft die Antwort: Erlaubt sind genau die gelieferten Zahlen (Mittelwerte, Tage, Unterschiede, Prozente, Schwellen), jeweils auch gerundet auf ganze Zahlen und auf volle Zehner bzw. Hunderter. Kommt eine andere Zahl vor oder ein verbotenes Wort, wird dieser Hinweis verworfen. *(Entscheidung des Entwurfs)* Bleibt nichts übrig, zeigt die Karte die Beobachtungen der App als schlichte Sätze ohne Gemini.

### Wo und wie
- **Verlauf**, Bereich Fortschritt, Karte "Zusammenhänge" mit Knopf "Zusammenhänge finden".
- Beim ersten Mal ein Hinweis, was an Gemini geht (Liste wie oben) mit "Verstanden, finden" und "Abbrechen". Danach nicht mehr.
- Ergebnis bleibt bis zum nächsten Knopfdruck sichtbar (gespeichert im Gerätezustand mit Datum, nicht in der Sicherung). Darunter "Stand vom 24. Nov." und "Neu finden".
- Ohne Key oder offline: kurzer Hinweis, keine Fehlermeldung in Rot.

## Teil C: kleinerer APK
- `android/app/build.gradle`: nur `arm64-v8a` und `armeabi-v7a` bauen. Folge: kein Emulator auf Intel-PCs, keine seltenen Intel-Android-Geräte.

## Code-Aufteilung
- `main`: `src/vitals.js` (neue Felder, Phasen), Anzeige (`body-card.js`, Verlauf), `src/insights.js` (Rechnung, Prüfung der Antwort), Gemini-Aufruf für Zusammenhänge in `src/gemini.js`, Karte im Verlauf.
- `native`: Lesen der neuen Typen (`native-health.js`), Auswahl in den Einstellungen (`health-ui.js`), Rechte je Wert, Build-Einstellung.
- Reine Funktionen mit Tests, Plugin und Gemini über gefälschte Antworten getestet.

## Dem Umsetzenden überlassen
- Genaue Texte der Karte und des Hinweises, Reihenfolge der Werte, Darstellung der Phasen-Zeile.
