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
- **Foto scannen:** Etikett fotografieren → Werte prüfen und korrigieren → Menge angeben → speichern. Rot markierte Felder wurden nicht erkannt.
- **Manuell:** Werte selbst eintragen, wenn das Foto nichts taugt.
- **Produkte:** bereits gescannte Produkte erneut eintragen, ohne neues Foto.
- **Gewicht:** ein Eintrag pro Tag, Diagramm über die Zeit.

## Sicherung
Unter **Einstellungen → Sicherung exportieren** lädt die App eine JSON-Datei herunter (ohne Gemini-Key). Mach das regelmäßig und lege die Datei in die Cloud. Wenn du Browserdaten löschst oder das Handy wechselst, stellt **Sicherung importieren** alles wieder her.

## Entwicklung
```
npm test          # Logik-Tests (Node)
python -m http.server 8080   # lokal öffnen unter http://localhost:8080
```
- Gemini-Modell: in den Einstellungen wählbar (Standard `gemini-3.8-flash`; Auswahlliste `MODELS` in `src/gemini.js`, eigene ID möglich).
- Spec und Plan: `docs/superpowers/`.
