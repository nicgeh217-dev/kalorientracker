# Redesign, Nährstoff-Übersicht, Verlauf, Training und Fuchs-Animationen

Datum: 2026-10-25
Status: Entwurf zur Durchsicht

## Ziel
Die App bekommt eine Struktur wie die Referenz-App, die der Nutzer mag (Wochenleiste, Nährstoff-Ringe, Mahlzeiten-Abschnitte, Verlauf mit Tagesstatus und Jahres-Heatmap, Training), behält aber die eigene Identität: Fuchs-Orange, Barlow-Zahlen, der Fuchs als Maskottchen. Dazu kommen ein schöner App-Start und Animationen mit Fuchs und Essens-Symbolen. Zusätzlich wird der Datenverlust nach dem Löschen der Chrome-Daten abgefedert.

## Entscheidungen des Nutzers
- Reihenfolge: Stufe 0 (Datensicherheit), Stufe 1 (Essen, Verlauf, Animationen), Stufe 2 (Training). Jede Stufe wird einzeln veröffentlicht.
- Farbe: Fuchs-Orange bleibt, kein Rot wie die Referenz.
- Mahlzeiten-Abschnitte zeigen nur kcal, **keine Vorgabe** pro Mahlzeit ("0 / 740").
- **Wasser entfällt.**

## Nicht im Umfang
Wasser, Freunde und soziale Funktionen, Bezahl-Hinweise, Budgets pro Mahlzeit, Push-Benachrichtigungen, Cloud-Synchronisation (offen als spätere Option: verschlüsselte automatische Sicherung auf GitHub).

## Grundregeln (bleiben bestehen)
- Nichts wird bewertet: Nährstoff-Ringe werden nie rot, es gibt keine Warnung für "zu viel". Der Fuchs reagiert nur darauf, **ob** eingetragen wird.
- Alle Daten bleiben auf dem Gerät, der API-Key steht nicht in der Sicherung.
- Pure Logik liegt in eigenen Modulen mit Node-Tests, Oberfläche wird im Browser geprüft.
- Bei "Bewegung reduzieren" im Handy gibt es keine Animationen.

## Design

### Farben und Schrift
Kohle `#0e0e10` (Hintergrund), Karte `#18181b`, Fläche `#26262b`, Fuchs-Orange `#f2711c` mit Verlauf `#ff8a3d` (ersetzt das bisherige `#fc4c02`, ein einziges Orange).
Nährstoffe: Eiweiß `#ff6b57`, Kohlenhydrate `#ffb020`, Fett `#4da3ff`, Ballaststoffe `#3ccf7a`, Zucker `#ff7ac0`.
Schrift: Barlow Condensed kursiv für Zahlen und Seitentitel (Seitentitel in Großbuchstaben, sonst keine Großbuchstaben-Beschriftungen), Figtree für Text. Hellmodus bleibt erhalten und folgt dem Handy.

### Bewusste Abgrenzung von der Vorlage
- Keine Kopie von "Rot auf Schwarz": das warme Leuchten sitzt nur hinter dem Fuchs.
- Nicht alles in gleichen Karten: Ringe stehen frei, Mahlzeiten sind eine zusammenhängende Liste.
- Das Unverwechselbare ist das Ritual aus Fuchs und Essens-Symbol, alles andere bleibt ruhig.

### Navigation
- Stufe 1: Heute, Verlauf, Kamera-Button, Gewicht, Mehr.
- Stufe 2: Heute, Training, Kamera-Button, Verlauf, Mehr. Das Gewicht wandert in den Verlauf (Karte "Gewicht") und in "Mehr".
- "Mehr" ist eine Liste: Gewicht, Gespeicherte Produkte, Einstellungen, Sicherung.

### Heute
```
HEUTE                              ‹ ›
Mo Di Mi Do Fr Sa [So]                 Wochenleiste (Kalenderwoche, antippbar, ‹ › wechselt die Woche)
┌ Kalorien ───────────────────────┐
│ 785 / 2150 kcal        (Ring)   │   Fuchs sitzt oben rechts auf der Karte,
└─────────────────────────────────┘   Sprechblase als Zeile unter dem Titel
(Eiweiß)(Kohlenh.)(Fett)
(Ballast.)(Zucker)                      Ringe mit Essens-Symbol, "von X g"
Frühstück        320 kcal         [+]
Mittagessen      ...              [+]
Abendessen / Snacks
```
- Hinweise (Warnung, Zielvorschlag, Sicherung) bleiben "nur einer auf einmal" und erscheinen über der Kalorien-Karte.
- "Zuletzt gegessen" als Chips-Zeile bleibt, die Warteschlange "Wartet auf Auswertung" bleibt.

### Verlauf
```
VERLAUF
Wochenleiste
┌ 25. Oktober ─────────────────────┐
│ Training: Push, 52 min (Stufe 2) │
│ [Training nachtragen] [Ruhetag] [Krank]
└──────────────────────────────────┘
Dein Jahr   (Heatmap, 53 Wochen)   Serie
Fortschritt: Gewicht · (Stufe 2) Rekorde · Muskelverteilung · Sätze pro Woche · Kraft pro Übung
```
- Tagesstatus **Ruhetag** und **Krank** sind umschaltbar. **Krank** überbrückt die Eintrags-Serie des Fuchses (sie reißt nicht, zählt aber auch nicht weiter). **Ruhetag** betrifft nur das Training.
- Jahres-Heatmap: Farbe nur nach Anzahl der Einträge (nie nach Kalorien), kranke Tage mit blauem Punkt, Ruhetage mit leichtem Haken.

### Animationen
1. **App-Start** (nur Kaltstart, höchstens 1,4 s, Tipp überspringt): der orange Ring zeichnet sich, der Fuchs hüpft hinein, Onigiri, Banana Milk und Ramyun-Schale fliegen in den Ring, der Ring wird zum Ring auf "Heute". Kein Splash bei Start über Kurzbefehl oder "Teilen", nur einmal pro Sitzung.
2. **Beim Eintragen:** Das Symbol des Essens fliegt von der Kamera-Taste zum Fuchs, der kaut. Ring und passende Nährstoff-Ringe füllen sich, Zahlen zählen hoch.
3. **Beim Training (Stufe 2):** Satz abgehakt gibt Hüpfer und Vibration, Rekord gibt Krone und Funken.
4. Sonst nur kurze, ruhige Übergänge. Das Einblenden jeder Karte bei jedem Neuladen entfällt. Es werden nur `transform` und `opacity` animiert.
- **Essens-Symbole:** Etwa zwölf eigene SVG-Symbole (Onigiri/Kimbap, Ramyun-Schale, Milchkarton, Apfel, Brot, Ei, Hähnchenkeule, Reisschale, Brokkoli, Bonbon, Avocado, Teller als Standard). Zuordnung nach Stichwörtern im Produktnamen, auch Koreanisch.

## Stufe 0: Datensicherheit
- `navigator.storage.persist()` anfordern, Status in den Einstellungen ("Speicher geschützt: ja / nein / unbekannt"). Chrome entscheidet selbst, es schützt vor automatischem Entfernen, nicht sicher vor bewusstem Löschen.
- **Willkommen zurück:** Startet die App völlig leer und noch nie dismisst, zeigt "Heute" eine Karte mit "Sicherung wiederherstellen", "Gemini-Key eintragen" und "Neu starten".
- Hinweis in "Mehr → Sicherung": nicht "Cookies und Websitedaten" für diese Seite löschen.
- Offen für später: verschlüsselte automatische Sicherung außerhalb des Geräts (GitHub-Gist), eigene Entscheidung des Nutzers.

## Stufe 1: Essen, Verlauf, Animationen

### Datenmodell
- `products` und `meals`: neue optionale Felder `fiber` und `sugar` (Gramm, `null` = unbekannt). Bestehende Einträge bleiben gültig und zeigen "–".
- Neuer Speicher `days`: `{ dateKey, status: 'rest' | 'sick' }` (kein Eintrag = normaler Tag).
- Mahlzeiten bekommen optional `slot` (`breakfast` | `lunch` | `dinner` | `snack`). Fehlt es, wird es aus der Uhrzeit abgeleitet (5–11 Uhr Frühstück, 11–15 Mittag, 17–22 Abend, sonst Snack). Im Formular per Schalter änderbar.
- Datenbank-Version 3 (Upgrade ohne Datenverlust).
- Sicherung Version 2 mit den neuen Speichern. Sicherungen in Version 1 bleiben importierbar, fehlende Teile gelten als leer.

### Auswertung der Etiketten
`gemini.js`-Prompt und Schema um `fiber` und `sugar` erweitern (koreanisch 식이섬유 und 당류), `gemini-parse.js` liest sie als optionale Zahlen. Bei Schätzungen darf das Modell beides schätzen, im Formular ist alles korrigierbar.

### Nährstoff-Richtwerte
Reine Funktion `nutrientTargets({ kcal, proteinGoal })`:
Eiweiß = `proteinGoal` oder 20 % der kcal / 4, Kohlenhydrate = 50 % / 4, Fett = 30 % / 9, Ballaststoffe 30 g (DGE), Zucker "höchstens" 10 % der kcal / 4 (WHO empfiehlt unter 10 % freie Zucker, auf dem Etikett steht Gesamtzucker, daher nur als Orientierung). Alles in den Einstellungen überschreibbar. Ringe zeigen Fortschritt bis 100 %, darüber bleibt der Ring voll, ohne Warnfarbe.

### Weitere reine Logik (mit Tests)
- `scaleNutrition` und `dayTotals` um Ballaststoffe und Zucker erweitern.
- `mealSlot(timestamp)` und Summen pro Abschnitt.
- `streak` mit Krank-Tagen als Überbrückung.
- `foodIconFor(name)`: Stichwort-Zuordnung.
- `weekOf(dateKey)`: Kalenderwoche Montag bis Sonntag.
- `yearGrid(counts, statuses, todayKey)`: Raster für die Jahres-Heatmap.

## Stufe 2: Training

### Datenmodell
- `exercises`: `{ id, name, muscle }` mit Muskelgruppen Brust, Rücken, Beine, Schultern, Arme, Core, Ganzkörper.
- `workouts`: `{ id, dateKey, startedAt, durationMin, title, sets: [{ exerciseId, kg, reps }] }`.
- Ein laufendes Training wird als Entwurf gespeichert, damit ein Schließen der App nichts verliert.

### Ablauf
- **Einheit starten**: Übungen aus der Bibliothek wählen oder neu anlegen. Pro Satz kg und Wiederholungen, der letzte Wert derselben Übung ist vorbelegt, Haken setzt den Satz. Pausen-Timer (Standard 90 s). Fertig speichert die Einheit.
- **Training nachtragen** für vergangene Tage im Verlauf.
- Vorlagen und Wochenpläne sind **nicht** Teil dieser Stufe.

### Auswertungen (reine Logik mit Tests)
- Geschätztes Maximum je Satz nach Epley: `kg × (1 + Wdh / 30)`.
- Rekorde je Übung (bestes geschätztes Maximum, größtes Gewicht, meiste Wiederholungen).
- Sätze pro Woche und je Muskelgruppe (letzte 7 und 30 Tage), Muskelverteilung in Prozent.
- Kraftkurve je Übung (bestes geschätztes Maximum pro Einheit).
- Neutraler Hinweis "Schultern zuletzt vor 9 Tagen" ohne Wertung.

## Tests und Prüfung
- Node-Tests für jede neue reine Logik (Richtwerte, Abschnitte, Serie mit Krank-Tagen, Symbol-Zuordnung, Wochen- und Jahresraster, Parser mit Ballaststoffen und Zucker, Datenbank-Upgrade-Format der Sicherung, Trainings-Auswertungen). Der Wächter-Test für `sw.js` bleibt.
- Browser-Prüfung pro Stufe: Layout bei 390 px Breite ohne Überlauf, Dunkel- und Hellmodus, "Bewegung reduzieren", Animationen laufen ruckelfrei (nur `transform` und `opacity`), Screenshots gegen die Tokens geprüft.
- README und Service-Worker-Liste pro Stufe aktualisiert, Cache-Version erhöht, danach Veröffentlichung nach Freigabe.

## Risiken
- Umfang: deshalb drei Stufen, jede einzeln nutzbar.
- Animationen auf einfachen Handys: nur GPU-freundliche Eigenschaften, Splash ist überspringbar.
- Ballaststoffe und Zucker aus Fotos können falsch gelesen werden: Felder sind optional und korrigierbar.
- Datenbank-Upgrade: wird vor der Veröffentlichung mit einem bestehenden Datensatz getestet.
