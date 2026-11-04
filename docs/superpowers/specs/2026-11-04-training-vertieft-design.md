# Training vertieft (Teilprojekt B)

Freigegeben im Chat am 2026-11-04.

- **Verlauf:** Mit Gewicht das geschätzte Maximum, nur mit Körpergewicht die meisten Wiederholungen in einem Satz. Sichtbar im Verlauf und im Bearbeiten-Dialog der Übung. Keine Farbe sagt "besser" oder "schlechter".
- **Notiz:** Gehört zur Übung (`exercise.note`), nicht zur Einheit, und ist beim nächsten Mal wieder da. Änderbar in der Einheit und im Bearbeiten-Dialog. Kommt mit in die Sicherung.
- **Superset:** `entry.linked` koppelt eine Übung an die direkt darüber. Pause erst nach der letzten Übung der Runde, davor der Hinweis "Weiter mit ...". Die Einheit speichert `links` (Übungen, die an der vorherigen hängen), "Wiederholen" übernimmt sie.
- **Entfernen:** Fällt die Spitze eines Supersets weg, wird die nächste Übung neue Spitze. "Rückgängig" stellt auch die Kopplung wieder her.
- **Nicht Teil:** Übungen in der Einheit umsortieren.
