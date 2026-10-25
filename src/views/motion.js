// Kleine Bewegungs-Helfer. Alles hier respektiert "Bewegung reduzieren": dann springen Zahlen sofort, nichts fliegt.

export const easeOutCubic = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
};

export const prefersReducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

// Zählt den Text eines Elements von `from` nach `to`. Dezimalstellen mit Komma.
export function countUp(node, to, { from = 0, ms = 650, decimals = 0 } = {}) {
  if (!node) return;
  const fmt = (v) => (decimals ? v.toFixed(decimals) : String(Math.round(v))).replace('.', ',');
  if (prefersReducedMotion() || from === to) {
    node.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const p = (now - t0) / ms;
    node.textContent = fmt(p >= 1 ? to : from + (to - from) * easeOutCubic(p));
    if (p < 1) requestAnimationFrame(step);
  };
  node.textContent = fmt(from);
  requestAnimationFrame(step);
  setTimeout(() => { node.textContent = fmt(to); }, ms + 100); // falls die Seite im Hintergrund keine Frames bekommt
}

// Lässt ein Symbol in einem Bogen von einem Rechteck zum anderen fliegen (nur transform und opacity), danach wird es entfernt.
export function flyIcon(icon, fromRect, toRect, { ms = 650 } = {}) {
  if (prefersReducedMotion()) return Promise.resolve();
  const size = 44;
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:${fromRect.left + fromRect.width / 2 - size / 2}px;top:${fromRect.top + fromRect.height / 2 - size / 2}px;width:${size}px;height:${size}px;z-index:200;pointer-events:none`;
  box.append(icon);
  document.body.append(box);
  const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);
  const anim = box.animate([
    { transform: 'translate(0, 0) scale(.6)', opacity: 0 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(1.1)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0.9 },
  ], { duration: ms, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
  return anim.finished.catch(() => {}).then(() => box.remove());
}
