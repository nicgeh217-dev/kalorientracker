# Health Connect: Vitaldaten in der App

Stand: 2026-11-23, von Nic freigegeben ("Beides wie vorgeschlagen, mach es so").

## Absicht
Nic trägt eine Fitbit und nutzt Google Health und Health Connect auf dem Pixel. Das Kalorien-Tracken ist in der eigenen App besser, die Vitaldaten sind bei Google besser. Ziel: **alles in einer App sehen.** Die eigene App wird der Ort, an dem Essen, Training, Gewicht und die Werte der Fitbit zusammenkommen.

## Ziele
- Werte aus Health Connect in der Android-App zeigen: Schritte, verbrannte Kalorien, Ruhepuls, Schlaf, dazu Fitbit-Trainings und Gewicht.
- Verlauf über Wochen, neben Essen, Training und Gewicht.
- Gegessene Kalorien und Protein zurück an Health Connect, damit Google Health die Bilanz kennt.

## Nicht-Ziele
- Kein Einfluss auf das Kalorienziel. **Das Ziel bleibt fest, verbrannte Kalorien stehen nur daneben** (Entscheidung von Nic).
- Keine Vitaldaten in der PWA oder auf dem iPhone (Health Connect gibt es nur auf Android).
- Kein Google Fit (wird eingestellt), keine Fitbit-Web-Schnittstelle, kein Cloud-Login.
- Keine Kohlenhydrate, Fett oder Zucker nach Health Connect (das Plugin kann es nicht).

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)
- Irgendeine Bewertung: keine Ampel- oder Rotfarben, keine "zu wenig Schritte", kein Soll und Ist bei Vitalwerten. Gleiche Regel wie überall in der App.
- Doppelte Einträge: doppeltes Gewicht in der App oder doppelte Kalorien bei Google.
- Die App wird langsam oder hängt, wenn Health Connect fehlt, nichts erlaubt ist oder keine Daten da sind.
- Gesundheitsdaten verlassen das Handy, außer verschlüsselt in Nics eigener Sicherung.

## Randbedingungen
- Android-App (Capacitor 8, Zweig `native`), Pixel 10 Pro XL, Android 16, Health Connect vorinstalliert.
- Plugin `@capgo/capacitor-health` 8.x. Liest: steps, calories (aktiv), totalCalories, basalCalories, heartRate, restingHeartRate, heartRateVariability, sleep (mit Phasen), oxygenSaturation, weight, bodyFat, workouts. Schreibt für Ernährung nur dietaryEnergyConsumed, dietaryProtein, dietaryWater.
- **Das Plugin kann geschriebene Werte weder ändern noch löschen.**
- Health Connect liest ohne Zusatzerlaubnis nur die letzten 30 Tage. Ältere Werte nur mit READ_HEALTH_DATA_HISTORY.
- Health Connect verlangt eine Datenschutzseite in der App.
- Es kann nichts auf einem echten Gerät getestet werden, bevor Nic den APK installiert.
- Welche Werte die Fitbit-App tatsächlich nach Health Connect schreibt, ist nicht geprüft. Die App muss mit jeder Teilmenge zurechtkommen.

## Approaches
1. **Plugin `@capgo/capacitor-health`** (gewählt): liest alle gewünschten Werte, bringt Erlaubnis-Dialog und Datenschutz-Hilfe mit, wenig eigener Android-Code. Verlust: Rückschreiben nur Kalorien und Protein.
2. **Eigene Android-Brücke zum Health-Connect-SDK:** könnte vollständige Mahlzeiten schreiben, aber viel ungetesteter Android-Code. Später für das Rückschreiben nachrüstbar.
3. **Fitbit/Google über das Internet:** ginge auch in der PWA, braucht aber eine registrierte Google-App und schickt Gesundheitsdaten durchs Netz. Verworfen.

## Wie es sich verhält

### Einrichtung
- In den Einstellungen (nur Android-App) ein Abschnitt "Health Connect" mit "Verbinden". Das öffnet den Erlaubnis-Dialog von Health Connect für alle Lese- und die Schreibrechte, mit Verlauf über 30 Tage hinaus.
- Danach zeigt der Abschnitt, was erlaubt ist, und bietet "Health Connect öffnen" (Rechte ändern) und "Trennen" (die App liest und schreibt nicht mehr; gespeicherte Werte bleiben).
- Ein kurzer Hinweis erklärt, dass in der Fitbit- bzw. Google-Health-App die Synchronisierung mit Health Connect eingeschaltet sein muss.
- Lehnt Nic einzelne Rechte ab, fehlen nur diese Werte. Nichts davon wird als Fehler angezeigt.

### Abgleich
- Beim Öffnen der App und bei jeder Rückkehr in die App, wenn verbunden, höchstens alle 5 Minuten, still im Hintergrund.
- Erster Abgleich: so weit zurück, wie Health Connect erlaubt, höchstens 90 Tage. Danach jeweils die letzten 3 Tage neu (Fitbit liefert Werte oft verspätet nach).
- Gespeichert wird eine Tageszusammenfassung je Kalendertag in einem neuen Speicher `vitals` (siehe Daten). Ein neuer Abgleich ersetzt die Werte eines Tages vollständig.
- Fehler beim Abgleich bleiben still. In den Einstellungen steht der Zeitpunkt des letzten erfolgreichen Abgleichs.

### Heute
- Unter der Nährstoff-Karte eine ruhige Karte "Körper" mit bis zu vier Zahlen: Schritte, verbrannte Kalorien (gesamt, sonst aktiv), Ruhepuls, Schlaf der letzten Nacht (z. B. "7 h 12 min").
- Nur Werte, die es für den Tag gibt. Ohne Verbindung oder ohne Werte erscheint die Karte nicht.
- Keine Farben für gut oder schlecht, keine Ziele, keine Pfeile. Gleicher Stil wie die Nährstoff-Reihe.
- Für vergangene Tage (Tageswechsel oben) zeigt die Karte die Werte dieses Tages.

### Verlauf
- Neue Karte "Körper" im Bereich Fortschritt: eine Kurve über die letzten 8 Wochen, umschaltbar zwischen Schritten, verbrannten Kalorien, Ruhepuls und Schlaf (Chips wie bei "Verlauf pro Übung"). Neutrale Kurve, keine Bewertung.
- Der Tagesbereich oben im Verlauf nennt für den gewählten Tag dieselben Zahlen in einer Zeile.
- Der Wochenrückblick bekommt eine Zeile "Ø 8 412 Schritte am Tag", nur wenn es Werte gibt.

### Training
- Fitbit-Trainings (aus Health Connect) erscheinen in "Letzte Einheiten" zwischen den eigenen, mit Art (z. B. "Laufen"), Dauer und Kalorien und dem Zusatz "Fitbit".
- Sie sind nur lesbar: kein Bearbeiten, Wiederholen oder Löschen, keine Sätze.
- **Als Trainingstag** (Wochenziel, Wochenrückblick) zählen sie nur, wenn es kein Gehen oder Spazieren ist. Angezeigt werden alle. *(Entscheidung von Nic)*
- **Überschneidung:** Überschneidet sich ein Fitbit-Training zeitlich mit einer Einheit aus der App (Start bis Ende), wird das Fitbit-Training ausgeblendet und zählt nicht, die App-Einheit gilt. *(Entscheidung von Nic)*
- Eigene Einheiten, die die App selbst nach Health Connect geschrieben hätte, gibt es nicht (das Plugin kann keine Trainings schreiben), also keine Doppelungen.

### Gewicht
- Gewichte aus Health Connect (z. B. Fitbit-Waage) werden übernommen, wenn die App für dieses Datum noch kein Gewicht hat. **Ein in der App eingetragenes Gewicht gewinnt immer**, es wird nie überschrieben.
- Mehrere Messungen an einem Tag: die früheste des Tages.
- Übernommene Gewichte tragen `source: "health"`. Nur solche dürfen von einem späteren Abgleich korrigiert werden. Löscht Nic ein übernommenes Gewicht, merkt sich die App das Datum (Gerätezustand) und übernimmt es nicht erneut. *(Entscheidung des Entwurfs)*
- Übernommene Gewichte zählen wie eingetragene (Kurve, Fuchs, Hinweise), denn es ist eine echte Messung. *(Entscheidung des Entwurfs)*
- Die App schreibt kein Gewicht nach Health Connect (vermeidet Doppelungen mit der Waage).

### Zurück an Health Connect
- Weil das Plugin nichts ändern oder löschen kann, schreibt die App **nur abgeschlossene Tage, einmal**: beim ersten Abgleich eines neuen Tages die Summe des Vortags (Kalorien und Protein) als je ein Eintrag über den ganzen Vortag.
- Übersprungen werden Tage ohne Mahlzeiten und Tage, die als krank markiert sind, damit Google keine falsche 0 bekommt. Alle anderen Tage werden mit ihrer Summe geschrieben. *(Entscheidung des Entwurfs)*
- Ein Tag wird nur einmal geschrieben (gemerkt im Gerätezustand). Ältere Tage werden nie nachgeschrieben, nur der direkte Vortag.
- Folge, die bewusst in Kauf genommen wird: Ändert Nic später etwas an einem schon geschriebenen Tag, kommt das bei Google nicht mehr an. Wird die App neu installiert, kann der Vortag einmal doppelt ankommen.
- Ein Schalter "Gegessene Kalorien an Health Connect senden" (Standard: an) erlaubt es abzuschalten.

## Fuchs und Serie
- Vitaldaten beeinflussen Fuchs, Serie, Stufe und Stimmung nicht. Der Fuchs reagiert weiter nur aufs Eintragen in der App. Die Karte "Körper" erscheint auch an Tagen ohne Mahlzeiten, sobald es Werte gibt. *(Entscheidung des Entwurfs)*

## Daten
- Neuer IndexedDB-Speicher `vitals` (Datenbank-Version 4), Schlüssel `dateKey`. Felder, jeweils optional: steps, activeKcal, totalKcal, restingHr, avgHr, sleepMin, sleepStart, sleepEnd, workouts (Liste mit title, start, durationMin, kcal), syncedAt.
- Schlaf wird dem Tag zugeordnet, an dem er endet (Nacht von Mo auf Di zählt für Di).
- Kalendertag nach Ortszeit des Handys, wie überall in der App (auch auf Reisen in Korea und Japan).
- `vitals` kommt in die Sicherungsdatei und in die verschlüsselte Online-Sicherung, genau wie Mahlzeiten und Gewicht (Werte älter als 30 Tage ließen sich sonst nicht wiederherstellen). *(Entscheidung von Nic)* Die Datenschutzseite sagt das so: Daten bleiben auf dem Handy, außer in deiner eigenen verschlüsselten Sicherung. Ältere Sicherungen ohne `vitals` bleiben gültig.
- Verbindungszustand, letzter Abgleich und geschriebene Tage sind Gerätezustand und kommen nicht in die Sicherung.

## Code-Aufteilung
- `main` (PWA und App): Speicher `vitals`, Anzeige auf Heute, im Verlauf und im Training, Sicherung. In der PWA bleibt der Speicher leer, nichts davon erscheint.
- `native`: Plugin, Abgleich, Einstellungen-Abschnitt, Android-Einrichtung (Rechte im Manifest, Datenschutzseite).
- Rechenlogik (Tagesaufteilung, Schlaf-Zuordnung, Gewichtsübernahme, welche Tage geschrieben werden) als reine Funktionen mit Tests. Das Plugin wird über einen Adapter mit gefälschtem Plugin getestet, wie bei Kamera und Timer.

## Dem Umsetzenden überlassen
- Genaue Texte, Reihenfolge der Zahlen in der Karte, Darstellung der Kurve innerhalb des bestehenden Stils.
- Wie die Datenschutzseite formuliert ist (kurz, deutsch, sagt: alles bleibt auf dem Handy, nichts geht an Dritte).
