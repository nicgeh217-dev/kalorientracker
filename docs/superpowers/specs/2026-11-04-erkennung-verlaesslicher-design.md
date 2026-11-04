# Erkennung verlässlicher (Teilprojekt A)

Freigegeben im Chat am 2026-11-04.

- **Unsicherheit:** Die KI-Antwort enthält bei Etiketten `uncertain` (Liste unsicher gelesener Felder) und `labelPhotoIndex` (welches Foto die Tabelle zeigt). Der Parser lässt nur bekannte Feldnamen zu; bei Schätzungen bleibt die Liste leer.
- **Formular:** Markierte Felder sind orange. Eine Karte nennt sie. Antippen oder Ändern hebt die Markierung auf. Beim Speichern mit unberührten Markierungen kommt einmal die übliche Rückfrage "Trotzdem speichern?".
- **Foto (Variante 3):** Nur wenn mindestens ein Feld unsicher war, wird das Etikettenfoto verkleinert (800 px, JPEG 0,7) am Produkt gespeichert (`labelPhoto`). Es bleibt lokal: weder Sicherungsdatei noch Online-Sicherung enthalten es.
- **Produkt bearbeiten:** Vorschau, Antippen vergrößert, "Foto löschen".
- **Übersetzung (Punkt 6):** Für Fotos und Beschreibung schon im Prompt vorhanden. Beim Strichcode keine zusätzliche Übersetzung (zusätzlicher KI-Aufruf lohnt nicht).
- **Nicht Teil:** Nachfragen an die KI, zweite Prüfung.
