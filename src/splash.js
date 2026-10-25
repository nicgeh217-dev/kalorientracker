import { foxSvg } from './views/fox.js';
import { foodIconSvg } from './views/food-icons.js';

const SESSION_KEY = 'splashShown';
const NS = 'http://www.w3.org/2000/svg';
const TOTAL_MS = 2500;

export function shouldShowSplash({ navigationType, launchAction, reducedMotion, shownThisSession }) {
  return !(reducedMotion || launchAction != null || shownThisSession || navigationType === 'reload');
}

export function splashAlreadyShown() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markShown() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ohne Speicher: Splash darf wiederkommen */ }
}

// Ablauf (ca. 2,4 s, nur transform und opacity, Tipp überspringt):
// 1. Ring dreht sich weich ein, Titel blendet auf. 2. Fuchs hüpft mit Nachfedern hinein.
// 3. Onigiri, Milch und Ramyun schweben nacheinander im Bogen zum Fuchs, der bei jedem kurz nachgibt.
// 4. Der Ring pulsiert einmal, dann gleitet alles nach oben weg und blendet aus.
export function runSplash(root) {
  markShown();
  const ringSvg = document.createElementNS(NS, 'svg');
  ringSvg.setAttribute('viewBox', '0 0 200 200');
  ringSvg.setAttribute('class', 'sp-ring');
  ringSvg.innerHTML = '<circle cx="100" cy="100" r="84" fill="none" stroke="#26262b" stroke-width="14"/>'
    + '<circle cx="100" cy="100" r="84" fill="none" stroke="#f2711c" stroke-width="14" stroke-linecap="round" stroke-dasharray="396 132" transform="rotate(-90 100 100)"/>';
  const glow = document.createElement('div');
  glow.className = 'sp-glow';
  const fox = document.createElement('div');
  fox.className = 'sp-fox';
  fox.append(foxSvg({ mood: 'happy', size: 104 }));
  const title = document.createElement('div');
  title.className = 'sp-title';
  title.textContent = 'Kalorientracker';
  const foods = ['onigiri', 'milk', 'ramyun'].map((id, i) => {
    const d = document.createElement('div');
    d.className = 'sp-food';
    d.dataset.i = String(i);
    d.append(foodIconSvg(id, 56));
    return d;
  });
  const stage = document.createElement('div');
  stage.className = 'sp-stage';
  stage.append(glow, ringSvg, fox, ...foods);
  root.replaceChildren(stage, title);

  const soft = 'cubic-bezier(.22,1,.36,1)';
  const first = (delay, duration, easing = soft) => ({ delay, duration, easing, fill: 'both' }); // hält Anfangszustand vor dem Start
  const later = (delay, duration, easing = soft) => ({ delay, duration, easing, fill: 'forwards' });
  const arrive = [900, 1180, 1460]; // Zeitpunkt, an dem das Essen den Fuchs erreicht
  const from = [{ x: -150, y: 70 }, { x: 140, y: -40 }, { x: 40, y: 150 }];

  const anims = [
    glow.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 0.5, transform: 'scale(1)' }], first(0, 900)),
    ringSvg.animate([{ transform: 'rotate(-160deg) scale(.6)', opacity: 0 }, { transform: 'rotate(0) scale(1)', opacity: 1 }], first(0, 800)),
    title.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], first(500, 600)),
    fox.animate([
      { transform: 'translateY(70px) scale(.5)', opacity: 0 },
      { transform: 'translateY(-30px) scale(1.04, .98)', opacity: 1, offset: 0.5 },
      { transform: 'translateY(0) scale(1.06, .92)', offset: 0.72 },
      { transform: 'translateY(-6px) scale(.98, 1.03)', offset: 0.86 },
      { transform: 'none', opacity: 1 },
    ], first(250, 700)),
    ...foods.map((f, i) => f.animate([
      { transform: `translate(${from[i].x}px, ${from[i].y}px) scale(.7)`, opacity: 0 },
      { transform: `translate(${from[i].x * 0.45}px, ${from[i].y * 0.45 - 60}px) scale(1.05)`, opacity: 1, offset: 0.45 },
      { transform: 'translate(0, 8px) scale(.5)', opacity: 0 },
    ], first(arrive[i] - 520, 520, 'cubic-bezier(.4,0,.6,1)'))),
    ...arrive.map((t) => fox.animate([
      { transform: 'none' }, { transform: 'scale(1.1, .9)', offset: 0.35 }, { transform: 'scale(.97, 1.04)', offset: 0.7 }, { transform: 'none' },
    ], { delay: t, duration: 280, easing: 'ease-out' })),
    ringSvg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)', offset: 0.4 }, { transform: 'scale(1)' }], later(1750, 380, 'ease-in-out')),
    stage.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-60px) scale(.9)', opacity: 0 }], later(2050, 380, 'ease-in')),
    title.animate([{ opacity: 1 }, { opacity: 0 }], later(2050, 300)),
    root.animate([{ opacity: 1 }, { opacity: 0 }], later(2150, 300, 'ease-out')),
  ];

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      for (const a of anims) a.cancel();
      root.remove();
      resolve();
    };
    root.addEventListener('pointerdown', finish, { once: true });
    setTimeout(finish, TOTAL_MS);
  });
}
