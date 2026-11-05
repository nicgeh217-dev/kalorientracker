import { MUSCLES } from './training.js';

// Übungen zum Auswählen. In die eigene Liste kommt nur, was man wirklich nutzt, damit sie übersichtlich bleibt.
const BY_MUSCLE = {
  Brust: [
    'Bankdrücken', 'Schrägbankdrücken', 'Negativ-Bankdrücken', 'Kurzhantel-Bankdrücken', 'Kurzhantel-Schrägbankdrücken',
    'Fliegende mit Kurzhanteln', 'Schräge Fliegende', 'Butterfly (Maschine)', 'Cable Crossover', 'Brustpresse (Maschine)',
    'Schräge Brustpresse (Maschine)', 'Dips (Brust)', 'Liegestütze', 'Pullover mit Kurzhantel',
  ],
  'Rücken': [
    'Klimmzüge', 'Klimmzüge im Untergriff', 'Klimmzüge (Maschine, unterstützt)', 'Latzug', 'Latzug eng', 'Latzug im Untergriff',
    'Latzug einarmig', 'Rudern', 'Langhantelrudern', 'Kurzhantelrudern einarmig', 'Rudern am Kabel (sitzend)', 'T-Bar-Rudern',
    'Rudern (Maschine)', 'Kreuzheben', 'Rack Pulls', 'Hyperextensions', 'Überzüge am Kabel',
  ],
  Beine: [
    'Kniebeugen', 'Frontkniebeugen', 'Hackenschmidt-Kniebeugen', 'Goblet Squats', 'Smith-Maschine Kniebeugen', 'Beinpresse',
    'Bulgarian Split Squats', 'Ausfallschritte', 'Step-ups', 'Beinstrecker', 'Beinbeuger liegend', 'Beinbeuger sitzend',
    'Rumänisches Kreuzheben', 'Sumo-Kreuzheben', 'Hip Thrust', 'Glute Bridge', 'Abduktoren (Maschine)', 'Adduktoren (Maschine)',
    'Wadenheben stehend', 'Wadenheben sitzend',
  ],
  Schultern: [
    'Schulterdrücken', 'Kurzhantel-Schulterdrücken', 'Arnold Press', 'Schulterpresse (Maschine)', 'Seitheben', 'Seitheben am Kabel',
    'Seitheben (Maschine)', 'Frontheben', 'Vorgebeugtes Seitheben', 'Reverse Butterfly', 'Face Pulls', 'Aufrechtes Rudern', 'Shrugs',
  ],
  Arme: [
    'Bizeps-Curls', 'Incline Bizeps-Curls', 'Langhantel-Curls', 'SZ-Curls', 'Hammer Curls', 'Incline Hammer Curls', 'Kabel-Curls',
    'Konzentrations-Curls', 'Preacher Curls', 'Spider Curls', 'Reverse Curls', 'Bizeps-Curls (Maschine)', 'Trizepsdrücken am Kabel',
    'Trizepsdrücken mit Seil', 'Überkopf-Trizepsdrücken am Kabel', 'Überkopf-Trizepsdrücken mit Kurzhantel', 'French Press',
    'Skull Crushers', 'Enges Bankdrücken', 'Trizeps-Dips', 'Trizeps-Kickbacks', 'Unterarm-Curls',
  ],
  Core: [
    'Plank', 'Seitstütz', 'Crunches', 'Kabel-Crunches', 'Sit-ups', 'Beinheben hängend', 'Beinheben liegend', 'Russian Twists',
    'Ab Wheel', 'Mountain Climbers', 'Dead Bug', 'Pallof Press',
  ],
  'Ganzkörper': [
    'Burpees', 'Kettlebell Swings', 'Thruster', 'Umsetzen und Drücken', 'Farmer\'s Walk', 'Turkish Get-up',
  ],
};

export const EXERCISE_CATALOG = Object.entries(BY_MUSCLE).flatMap(([muscle, names]) => names.map((name) => ({ name, muscle })));

// Für den Vergleich zählen nur Buchstaben und Ziffern: "Hammer-Curls" und "hammer curls" sind dieselbe Übung.
const norm = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function matchesExercise(exercise, query) {
  const q = norm(query);
  return norm(exercise.name).includes(q) || norm(exercise.muscle ?? '').includes(q);
}

// Katalog-Übungen, die man noch nicht in der eigenen Liste hat, passend zur Suche.
export function catalogSuggestions(own, query) {
  const owned = new Set(own.map((e) => norm(e.name)));
  return EXERCISE_CATALOG
    .filter((e) => !owned.has(norm(e.name)) && matchesExercise(e, query))
    .sort((a, b) => MUSCLES.indexOf(a.muscle) - MUSCLES.indexOf(b.muscle) || a.name.localeCompare(b.name, 'de'));
}
