# Kalorientracker

Persönliche Handy-App (PWA): Nährwerttabelle fotografieren, Gemini liest die Werte aus, die App summiert Kalorien, Protein, Kohlenhydrate und Fett pro Tag und trackt das Gewicht. Alle Daten bleiben auf dem Handy.

## Auf dem Handy installieren
1. Die veröffentlichte Adresse in Chrome auf dem Pixel öffnen.
2. Menü (⋮) → „Zum Startbildschirm hinzufügen“ → „Installieren“.

## Erste Einrichtung
1. Tab **Einstellungen** öffnen.
2. Dein Tageskalorienziel eintragen (berechnest du selbst).
3. Gemini-API-Key eintragen (https://aistudio.google.com/apikey). Der Key wird nur lokal auf dem Handy gespeichert, nicht im Code und nicht im Repo.

## Benutzung
- **Heute:** oben der Tag mit Pfeilen, dann (höchstens ein) Hinweis, der Fuchs als schmale Zeile und eine kompakte Kalorien-Karte mit Ring, Makros und Proteinziel. Direkt darunter die Schnellauswahl „Zuletzt gegessen“ und deine **Mahlzeiten**, damit du ohne Scrollen siehst, was du gegessen hast. Gelöscht wird mit „Rückgängig“ statt Rückfrage.
- **Kamera-Button (unten Mitte):** öffnet die Auswahl **Foto aufnehmen, Aus Galerie, Beschreiben, Aus Produkten, Manuell**. Fotos (bis zu 4 desselben Produkts, z. B. Vorderseite und Nährwerttabelle) und Beschreibung landen im Scan-Dialog, dort **Auswerten**.
  - Ist eine Nährwerttabelle lesbar, werden die Werte exakt abgelesen. Rot markierte Felder wurden nicht erkannt.
  - Koreanische Produktnamen werden ins Deutsche übersetzt, der Originalname steht in Klammern (Name im Formular prüfbar). Gibt es keine Tabelle (Restaurant, Bäcker) oder nur eine Beschreibung, **schätzt** die KI das ganze Gericht. Das ist markiert (**~**, "Schätzung") und kann 20–40 % danebenliegen.
  - Im Formular siehst du nach einem Scan nur Name, Nährwerte als Zusammenfassung und die Menge mit Schnelltasten (½, 1, 1½, 2 bzw. 50/100/150/200 g). **Werte bearbeiten** klappt alle Felder auf. Fehlen Werte, ist das Formular gleich aufgeklappt und die Felder sind markiert. Bei „pro 100 g“ ist Gramm die Standardeinheit.
- **Kurzbefehle auf dem App-Icon (Android):** Lange aufs Icon drücken zeigt „Foto scannen“ und „Gewicht eintragen“. Beides öffnet die App direkt an der richtigen Stelle.
- **Fotos teilen:** In der Galerie ein oder mehrere Fotos teilen und „Kalorientracker“ wählen. Die App öffnet den Scan-Dialog mit den Fotos (bis zu 4) und, falls vorhanden, dem geteilten Text als Beschreibung.
- **Hinweis:** Kurzbefehle und Teilen funktionieren nur für die **installierte** App. Nach einem Update übernimmt Android die neuen Einträge meist innerhalb eines Tages. Sofort geht es, wenn du die App einmal vom Startbildschirm entfernst und neu installierst (Daten bleiben im Browser erhalten, mach vorher trotzdem eine Sicherung).
- **Manuell:** Werte selbst eintragen, wenn das Foto nichts taugt.
- **Produkte:** erreichst du über den Kamera-Button („Aus Produkten“) oder unter Einstellungen („Gespeicherte Produkte verwalten“). Antippen trägt eine Mahlzeit ein, ✎ benennt um, korrigiert Werte oder löscht (mit „Rückgängig“, alte Mahlzeiten bleiben).
- **Offline:** Ohne Internet kannst du Fotos „für später speichern“. Sie erscheinen auf „Heute“ unter „Wartet auf Auswertung“ und werden online ausgewertet.
- **Schätzung nachbessern:** Im Formular „Mit Hinweis neu schätzen“, z. B. „kleine Portion, ohne Öl“.
- **Ziele (Einstellungen):** Kalorien, optional Protein und Zielgewicht. Beim Zielgewicht zeigt „Gewicht“ eine grobe Prognose aus den letzten 4 Wochen.
- **Gewicht:** ein Eintrag pro Tag, Diagramm über die Zeit.
- **Verlauf (Tab in der Leiste):** „Letzte 7 Tage“ (Ø kcal, Tage im Ziel, Balken mit Ziellinie) und **Kalender**: Monatsansicht (Montag zuerst) mit Heatmap: Die Farbe zeigt nur, **wie viele Einträge** du an dem Tag hattest (nicht Kalorien), ein blauer Punkt zeigt ein eingetragenes Gewicht. Antippen springt zu dem Tag, die Pfeile blättern durch die Monate. Zukünftige Tage sind gesperrt.

## Fuchs-Begleiter
Ein kleiner Fuchs oben auf „Heute“ erinnert dich in der App ans Tracken und freut sich über Einträge. Beim ersten Start kannst du ihn benennen oder ablehnen.

- **Stimmungen:** neugierig (heute noch nichts eingetragen, mit Sprüchen je nach Tageszeit: Frühstück, Mittag, Nachmittag, Abend), glücklich (eingetragen, kaut kurz nach jedem Eintrag), stolz (Serien-Meilensteine oder Gewicht eingetragen), „vermisst dich“ (2 oder mehr Tage ohne Eintrag, ohne Vorwurf), schläft (nachts, 22–5 Uhr).
- **Fortschritt:** Jeder Tag mit mindestens einem Eintrag zählt. Bei 3, 7, 14, 30 und 60 Tagen schaltet der Fuchs Halstuch, Mütze, Brille, Krone und Umhang frei. Dazu „Tage in Folge“ und Rekord. Antippen zeigt Details und erlaubt Umbenennen.
- **Grundregel:** Der Fuchs reagiert nur darauf, **ob** du einträgst, nie auf Kalorien, Essen oder Gewicht. Seine Sprüche werden per Test auf Wertungen (Diät, „zu viel“, Körper usw.) geprüft. Er wird nie krank und stirbt nie, eine Lücke setzt nur die Serie zurück.
- **Ausblenden:** im Fuchs-Dialog („Ausblenden“) oder in den Einstellungen (Haken). Der Zustand wird immer aus deinen Einträgen berechnet, nichts geht bei einer Sicherung verloren.
- **Grenze:** Die Erinnerungen erscheinen nur, wenn du die App öffnest. Echte Push-Nachrichten bei geschlossener App brauchen einen Server und sind nicht eingebaut. Stell dir dafür feste Handy-Wecker (z. B. 12:30 und 19:30).

## Kalorienrechner (Einstellungen → Kalorienrechner öffnen)
Berechnet ein Tagesziel aus Geschlecht, Alter, Größe, Gewicht, Aktivität und Ziel (halten, langsam/moderat abnehmen, zunehmen). Alternativ trägst du dein Ziel weiter selbst ein.

- **Formel:** Grundumsatz nach Mifflin-St Jeor × Aktivitätsfaktor (1,4 / 1,6 / 1,8 / 2,0 nach EFSA). Ergebnis ist ein **Startwert**, im Einzelfall ±10–20 % daneben.
- **Anpassung beim Abnehmen:** Wer leichter wird, verbraucht weniger. Die App schlägt ein neues Ziel vor, wenn sich dein 7-Tage-Schnitt um mindestens 1 kg seit der letzten Rechnung geändert hat. Übernommen wird es **nur nach deiner Bestätigung** ("Übernehmen"/"Später"). Bei erreichtem Zielgewicht schlägt sie die Erhaltung vor. Ein selbst eingetipptes Ziel schaltet die Vorschläge ab.
- **Schutzgrenzen:** nur ab 18 Jahren; kein Abnehmen bei BMI unter 18,5; Zielgewicht nicht unter BMI 18,5; Defizit höchstens 20 % des Gesamtverbrauchs; Ziel nie unter dem Grundumsatz und mindestens 1.200 kcal (Frauen) bzw. 1.500 kcal (Männer). Diese Mindestwerte sind eine vorsichtige App-Grenze, keine bestätigte Leitlinie.
- **Warnung:** Fällt dein Gewichtstrend schneller als ca. 1 % pro Woche, zeigt die App eine Warnung.
- **Kein Ersatz für ärztliche Beratung.** Bei Schwangerschaft/Stillzeit, Diabetes, Herz- oder Nierenerkrankungen, Medikamenten oder einer Essstörung bitte ärztlich klären.
- Quellen: Frankenfield et al. 2005 (Mifflin-St Jeor am genauesten unter den gängigen Formeln, J Am Diet Assoc), Hall et al. 2011 (Lancet: Energieverbrauch sinkt mit dem Gewicht, die 3500-kcal-Regel überschätzt die Abnahme), EFSA (Aktivitätsfaktoren), NICE/NHS (ca. 500–600 kcal Defizit, 0,5–1 kg pro Woche).

## Tipp: Gemini-Key absichern
In Google AI Studio / Google Cloud den Key auf die Website-Adresse der App (`nicgeh217-dev.github.io`) beschränken und ein Kostenlimit setzen. Dann richtet ein abgegriffener Key kaum Schaden an.

## Sicherung
Unter **Einstellungen → Sicherung teilen** öffnet sich das Teilen-Menü deines Handys: Schick die Datei an Google Drive, per E-Mail oder an dich selbst. **Als Datei speichern** lädt sie stattdessen herunter. Die Sicherung enthält keinen Gemini-Key. Fotos in der Warteschlange sind nicht dabei.

- **Erinnerung:** Auf „Heute“ erscheint ein Kasten, wenn du noch nie gesichert hast (ab 3 Tagen mit Daten) oder die letzte Sicherung mindestens 7 Tage alt ist und neue Einträge dazugekommen sind. „In 3 Tagen“ blendet ihn aus.
- **Wiederherstellen:** **Sicherung importieren** ersetzt alle aktuellen Daten (nach Rückfrage). Bei einer ungültigen Datei bleibt alles unverändert.

## Updates
Gibt es eine neue App-Version, zeigt die App oben „Neue Version verfügbar“. Tippe auf **Neu laden**, wenn du gerade nichts bearbeitest.

## Entwicklung
```
npm test          # Logik-Tests (Node), inkl. Wächter: sw.js muss alle Dateien cachen
python -m http.server 8080   # lokal öffnen unter http://localhost:8080
```
- **Release:** In `sw.js` die Zahl in `CACHE` (`kalorientracker-vNN`) bei jeder veröffentlichten Änderung hochzählen und neue Dateien in `ASSETS` eintragen. Nur dann erkennt die App ein Update und zeigt den Hinweis.
- Gemini-Modell: in den Einstellungen wählbar (Standard `gemini-3.8-flash`; Auswahlliste `MODELS` in `src/gemini.js`, eigene ID möglich).
- Spec und Plan: `docs/superpowers/`.
