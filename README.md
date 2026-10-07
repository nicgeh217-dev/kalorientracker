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
- **Kamera-Button:** Fotos aufnehmen oder aus der Galerie wählen (bis zu 4 Fotos desselben Produkts, z. B. Vorderseite und Nährwerttabelle), optional mit Beschreibung. Dann **Auswerten**.
  - Ist eine Nährwerttabelle lesbar, werden die Werte exakt abgelesen. Rot markierte Felder wurden nicht erkannt.
  - Gibt es keine Tabelle (Restaurant, Bäcker) oder nur eine Beschreibung, **schätzt** die KI das ganze Gericht. Das ist markiert (**~**, "Schätzung") und kann 20–40 % danebenliegen.
  - Werte prüfen und korrigieren, Menge angeben, speichern.
- **Manuell:** Werte selbst eintragen, wenn das Foto nichts taugt.
- **Produkte:** bereits gescannte Produkte erneut eintragen, ohne neues Foto. Mit ✎ umbenennen, Werte korrigieren oder löschen (alte Mahlzeiten bleiben).
- **Offline:** Ohne Internet kannst du Fotos „für später speichern“. Sie erscheinen auf „Heute“ unter „Wartet auf Auswertung“ und werden online ausgewertet.
- **Schätzung nachbessern:** Im Formular „Mit Hinweis neu schätzen“, z. B. „kleine Portion, ohne Öl“.
- **Ziele (Einstellungen):** Kalorien, optional Protein und Zielgewicht. Beim Zielgewicht zeigt „Gewicht“ eine grobe Prognose aus den letzten 4 Wochen.
- **Gewicht:** ein Eintrag pro Tag, Diagramm über die Zeit.

## Tipp: Gemini-Key absichern
In Google AI Studio / Google Cloud den Key auf die Website-Adresse der App (`nicgeh217-dev.github.io`) beschränken und ein Kostenlimit setzen. Dann richtet ein abgegriffener Key kaum Schaden an.

## Sicherung
Unter **Einstellungen → Sicherung exportieren** lädt die App eine JSON-Datei herunter (ohne Gemini-Key). Mach das regelmäßig und lege die Datei in die Cloud. Fotos in der Warteschlange sind nicht Teil der Sicherung. Wenn du Browserdaten löschst oder das Handy wechselst, stellt **Sicherung importieren** alles wieder her.

## Entwicklung
```
npm test          # Logik-Tests (Node)
python -m http.server 8080   # lokal öffnen unter http://localhost:8080
```
- Gemini-Modell: in den Einstellungen wählbar (Standard `gemini-3.8-flash`; Auswahlliste `MODELS` in `src/gemini.js`, eigene ID möglich).
- Spec und Plan: `docs/superpowers/`.
