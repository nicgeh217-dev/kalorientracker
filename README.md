# Kalorientracker

Persönliche Handy-App (PWA): Nährwerttabelle fotografieren, Gemini liest die Werte aus, die App summiert Kalorien, Eiweiß, Kohlenhydrate, Fett, Ballaststoffe und Zucker pro Tag und trackt das Gewicht. Alle Daten bleiben auf dem Handy.

## Auf dem Handy installieren
1. Die veröffentlichte Adresse in Chrome auf dem Pixel öffnen.
2. Menü (⋮) → „Zum Startbildschirm hinzufügen“ → „Installieren“.

## Erste Einrichtung
1. Tab **Mehr** → **Einstellungen** öffnen.
2. Dein Tageskalorienziel eintragen (berechnest du selbst).
3. Gemini-API-Key eintragen (https://aistudio.google.com/apikey). Der Key wird nur lokal auf dem Handy gespeichert, nicht im Code und nicht im Repo.

## Benutzung
- **Navigation:** Heute, Verlauf, Kamera-Button, Gewicht und **Mehr** (Produkte, Einstellungen, Sicherung).
- **Heute:** oben die **Wochenleiste** (Montag bis Sonntag, Punkt = Einträge an dem Tag, blau = Ruhetag, rosa = krank; tippen wechselt den Tag, ‹ › blättert die Woche). Darunter (höchstens ein) Hinweis und die Kalorien-Karte mit Ring und dem Fuchs. Danach fünf **Nährstoff-Ringe** (Eiweiß, Kohlenhydrate, Fett, Ballaststoffe, Zucker, jeweils mit einem Essens-Symbol), die „Zuletzt gegessen“-Schnellauswahl und die Mahlzeiten in vier Abschnitten: **Frühstück, Mittagessen, Abendessen, Snacks** (nach Uhrzeit vorgewählt, im Formular änderbar; „+“ trägt direkt in den Abschnitt ein). Eine Mahlzeit antippen öffnet sie zum Bearbeiten oder **Löschen** (mit „Rückgängig“ statt Rückfrage).
- **Nährstoff-Ringe:** Die Ringe zeigen, wie weit du auf dem Weg zu einem **Richtwert** bist, und werden nie rot. Standard: Eiweiß = dein Proteinziel oder 20 % der Kalorien, Kohlenhydrate 50 %, Fett 30 %, Ballaststoffe 30 g, Zucker „höchstens“ 10 % der Kalorien. Das sind Orientierungswerte, keine Vorgabe. Unter **Einstellungen → Nährstoff-Richtwerte** kannst du jeden Wert überschreiben (leer = Standard). Ballaststoffe und Zucker liest Gemini aus der Nährwerttabelle ab (koreanisch 식이섬유 und 당류); bei Schätzungen sind sie geschätzt. Ältere Einträge ohne diese Werte zeigen „–“ statt einer falschen 0.
- **Kamera-Button (unten Mitte):** öffnet die Auswahl **Foto aufnehmen, Aus Galerie, Beschreiben, Aus Produkten, Manuell**. Fotos (bis zu 4 desselben Produkts, z. B. Vorderseite und Nährwerttabelle) und Beschreibung landen im Scan-Dialog, dort **Auswerten**.
  - Ist eine Nährwerttabelle lesbar, werden die Werte exakt abgelesen. Rot markierte Felder wurden nicht erkannt.
  - Koreanische Produktnamen werden ins Deutsche übersetzt, der Originalname steht in Klammern (Name im Formular prüfbar). Gibt es keine Tabelle (Restaurant, Bäcker) oder nur eine Beschreibung, **schätzt** die KI das ganze Gericht. Das ist markiert (**~**, "Schätzung") und kann 20–40 % danebenliegen.
  - Im Formular siehst du nach einem Scan nur Name, Nährwerte als Zusammenfassung und die Menge mit Schnelltasten (½, 1, 1½, 2 bzw. 50/100/150/200 g). **Werte bearbeiten** klappt alle Felder auf. Fehlen Werte, ist das Formular gleich aufgeklappt und die Felder sind markiert. Bei „pro 100 g“ ist Gramm die Standardeinheit.
- **Kurzbefehle auf dem App-Icon (Android):** Lange aufs Icon drücken zeigt „Foto scannen“ und „Gewicht eintragen“. Beides öffnet die App direkt an der richtigen Stelle.
- **Fotos teilen:** In der Galerie ein oder mehrere Fotos teilen und „Kalorientracker“ wählen. Die App öffnet den Scan-Dialog mit den Fotos (bis zu 4) und, falls vorhanden, dem geteilten Text als Beschreibung.
- **Hinweis:** Kurzbefehle und Teilen funktionieren nur für die **installierte** App. Nach einem Update übernimmt Android die neuen Einträge meist innerhalb eines Tages. Sofort geht es, wenn du die App einmal vom Startbildschirm entfernst und neu installierst (Daten bleiben im Browser erhalten, mach vorher trotzdem eine Sicherung).
- **Manuell:** Werte selbst eintragen, wenn das Foto nichts taugt.
- **Produkte:** erreichst du über den Kamera-Button („Aus Produkten“) oder unter Mehr („Gespeicherte Produkte“). Antippen trägt eine Mahlzeit ein, ✎ benennt um, korrigiert Werte oder löscht (mit „Rückgängig“, alte Mahlzeiten bleiben).
- **Offline:** Ohne Internet kannst du Fotos „für später speichern“. Sie erscheinen auf „Heute“ unter „Wartet auf Auswertung“ und werden online ausgewertet.
- **Schätzung nachbessern:** Im Formular „Mit Hinweis neu schätzen“, z. B. „kleine Portion, ohne Öl“.
- **Ziele (Einstellungen):** Kalorien, optional Protein und Zielgewicht. Beim Zielgewicht zeigt „Gewicht“ eine grobe Prognose aus den letzten 4 Wochen.
- **Gewicht:** ein Eintrag pro Tag, Diagramm über die Zeit.
- **Verlauf:** Wochenleiste, darunter die Karte des gewählten Tages mit den Schaltern **Ruhetag** und **Krank**. Ein Krankheitstag unterbricht die Fuchs-Serie nicht (zählt aber auch nicht mit), ein Ruhetag betrifft später nur das Training. „Dein Jahr“ zeigt Serie, Rekord und Tage insgesamt und eine **Jahres-Heatmap** (53 Wochen, scrollt seitwärts): Die Farbe zeigt nur, **wie viele Einträge** du an dem Tag hattest (nicht Kalorien), krank = kleiner blauer Punkt, Ruhetag = Haken. Darunter „Letzte 7 Tage“ (Ø kcal, Tage im Ziel, Balken mit Ziellinie).

## Animationen
Beim Start (nur ein Kaltstart pro Sitzung, höchstens 1,4 s, Tippen überspringt) füllt sich ein Ring, der Fuchs hüpft hinein und drei Essens-Symbole fliegen in die Mitte. Beim Eintragen fliegt das passende Symbol von der Kamera-Taste zum Fuchs, der kaut, und die Zahlen und Ringe zählen sich hoch. Es werden nur Bewegung und Transparenz animiert. Mit der Handy-Einstellung **Bewegung reduzieren** gibt es keinen Start-Splash, keinen Flug und die Zahlen springen sofort. Beim Start über Kurzbefehl oder „Teilen“ gibt es ebenfalls keinen Splash.

## Fuchs-Begleiter
Ein kleiner Fuchs oben in der Kalorien-Karte auf „Heute“ erinnert dich in der App ans Tracken und freut sich über Einträge. Beim ersten Start kannst du ihn benennen oder ablehnen.

- **Stimmungen:** neugierig (heute noch nichts eingetragen, mit Sprüchen je nach Tageszeit: Frühstück, Mittag, Nachmittag, Abend), glücklich (eingetragen, kaut kurz nach jedem Eintrag), stolz (Serien-Meilensteine oder Gewicht eingetragen), „vermisst dich“ (2 oder mehr Tage ohne Eintrag, ohne Vorwurf), schläft (nachts, 22–5 Uhr).
- **Fortschritt:** Jeder Tag mit mindestens einem Eintrag zählt. Bei 3, 7, 14, 30 und 60 Tagen schaltet der Fuchs Halstuch, Mütze, Brille, Krone und Umhang frei. Dazu „Tage in Folge“ und Rekord. Antippen zeigt Details und erlaubt Umbenennen.
- **Grundregel:** Der Fuchs reagiert nur darauf, **ob** du einträgst, nie auf Kalorien, Essen oder Gewicht. Seine Sprüche werden per Test auf Wertungen (Diät, „zu viel“, Körper usw.) geprüft. Er wird nie krank und stirbt nie, eine Lücke setzt nur die Serie zurück (außer du markierst den Tag im Verlauf als **Krank**: dann bleibt die Serie bestehen).
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
Unter **Mehr → Sicherung** (oder Einstellungen) → **Sicherung teilen** öffnet sich das Teilen-Menü deines Handys: Schick die Datei an Google Drive, per E-Mail oder an dich selbst. **Als Datei speichern** lädt sie stattdessen herunter. Die Sicherung (Version 2) enthält Mahlzeiten, Produkte, Gewicht, Tagesstatus und Ziele, aber keinen Gemini-Key; ältere Sicherungen (Version 1) lassen sich weiter einspielen. Fotos in der Warteschlange sind nicht dabei.

- **Erinnerung:** Auf „Heute“ erscheint ein Kasten, wenn du noch nie gesichert hast (ab 3 Tagen mit Daten) oder die letzte Sicherung mindestens 7 Tage alt ist und neue Einträge dazugekommen sind. „In 3 Tagen“ blendet ihn aus.
- **Wiederherstellen:** **Sicherung importieren** ersetzt alle aktuellen Daten (nach Rückfrage). Bei einer ungültigen Datei bleibt alles unverändert.
- **Daten weg?** Ist die App leer, erscheint auf „Heute“ die Karte „Neu hier oder zurück?“ mit **Sicherung wiederherstellen**. Die App fordert außerdem persistenten Speicher an; in den Einstellungen siehst du, ob Chrome ihn gewährt hat. Löschst du in Chrome „Cookies und Websitedaten“ für die Seite, sind die Daten trotzdem weg, deshalb regelmäßig sichern.

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
