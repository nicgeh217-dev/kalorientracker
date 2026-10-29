// Mahlzeit per Drag and Drop in einen anderen Abschnitt ziehen (Frühstück, Mittagessen, Abendessen, Snacks).
// Funktioniert mit Maus und Finger: Auf dem Handy erst kurz gedrückt halten, dann ziehen (so bleibt normales Scrollen möglich).
// Das Formular mit der Abschnitts-Auswahl bleibt als Alternative ohne Ziehen.

const HOLD_MS = 350;
const MOVE_CANCEL_PX = 8;
const EDGE_PX = 90;

let suppressClick = false;

export function enableMealDrag(row, { onDrop }) {
  row.classList.add('draggable');
  row.addEventListener('click', (e) => {
    if (suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); suppressClick = false; }
  }, true);

  row.addEventListener('pointerdown', (down) => {
    if (down.button != null && down.button > 0) return;
    const start = { x: down.clientX, y: down.clientY };
    const isTouch = down.pointerType === 'touch' || down.pointerType === 'pen';
    let dragging = false;
    let ghost = null;
    let target = null;
    let timer = null;
    let scrollTimer = null;
    let last = start;

    const preventScroll = (e) => { if (dragging) e.preventDefault(); };
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(scrollTimer);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('touchmove', preventScroll);
      ghost?.remove();
      row.classList.remove('dragging');
      document.body.classList.remove('meal-dragging');
      for (const s of document.querySelectorAll('.slot.drop-target')) s.classList.remove('drop-target');
    };

    const begin = () => {
      dragging = true;
      navigator.vibrate?.(15);
      const rect = row.getBoundingClientRect();
      ghost = row.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:40;pointer-events:none;`;
      document.body.append(ghost);
      row.classList.add('dragging');
      document.body.classList.add('meal-dragging');
      scrollTimer = setInterval(() => {
        if (last.y < EDGE_PX) window.scrollBy(0, -12);
        else if (last.y > window.innerHeight - EDGE_PX) window.scrollBy(0, 12);
        highlight();
      }, 30);
    };

    const highlight = () => {
      if (ghost) ghost.style.transform = `translate(${last.x - start.x}px, ${last.y - start.y}px)`;
      const under = document.elementFromPoint(last.x, last.y)?.closest?.('.slot[data-slot]') ?? null;
      for (const s of document.querySelectorAll('.slot.drop-target')) if (s !== under) s.classList.remove('drop-target');
      under?.classList.add('drop-target');
      target = under?.dataset.slot ?? null;
    };

    function move(e) {
      last = { x: e.clientX, y: e.clientY };
      if (!dragging) {
        if (Math.hypot(last.x - start.x, last.y - start.y) > MOVE_CANCEL_PX) {
          if (isTouch) cleanup(); // Finger bewegt sich vor dem Halten: normales Scrollen
          else begin();
        }
        return;
      }
      highlight();
    }
    function up() {
      const wasDragging = dragging;
      const dropTo = target;
      cleanup();
      if (wasDragging) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 400);
        if (dropTo && dropTo !== row.dataset.slot) onDrop(dropTo);
      }
    }
    function cancel() { cleanup(); }

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('touchmove', preventScroll, { passive: false });
    if (isTouch) timer = setTimeout(begin, HOLD_MS);
  });
}
