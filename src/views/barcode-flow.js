import { el, openSheet, closeSheet, toast } from '../dom.js';
import { listProducts } from '../db.js';
import { normalizeBarcode, findProductByBarcode, lookupOpenFoodFacts } from '../barcode.js';
import { scanBarcode } from '../native-scanner.js';
import { openMealForm } from './meal-form.js';
import { startScanWithPicker, startDescribe } from './scan.js';

// Strichcode scannen und das Produkt eintragen. Reihenfolge: 1. eigene Produkte, 2. Open Food Facts, 3. Foto der Tabelle (der Code wird dann gemerkt).
export async function startBarcodeScan() {
  let raw;
  try {
    raw = await scanBarcode({ onInstalling: () => toast('Der Scanner wird einmalig geladen. Das kann einen Moment dauern.') });
  } catch (e) {
    toast(e?.message || 'Der Scanner konnte nicht geöffnet werden.');
    return undefined;
  }
  if (raw == null) return undefined;
  const code = normalizeBarcode(raw);
  if (!code) { toast('Dieser Strichcode wurde nicht sicher erkannt. Versuche es noch einmal.'); return undefined; }

  const own = findProductByBarcode(await listProducts(), code);
  if (own) return openMealForm({ ...own, productId: own.id }, { info: `Gefunden: ${own.name} (aus deinen Produkten)` });

  const found = await lookupOpenFoodFacts(code);
  if (found.ok) {
    return openMealForm({ ...found.label, barcode: code }, {
      barcode: code,
      info: `Aus Open Food Facts, Strichcode ${code}. Prüfe die Werte mit der Packung.`,
    });
  }
  return showUnknown(code, found);
}

function showUnknown(code, found) {
  const offline = Boolean(found.error);
  openSheet(
    el('h1', {}, 'Produkt unbekannt'),
    el('div', { class: 'note warn' }, offline
      ? `${found.error} Strichcode: ${code}. Du kannst die Nährwerttabelle fotografieren, die App merkt sich den Code dazu.`
      : `Dieses Produkt kenne ich noch nicht (Strichcode ${code}). Fotografiere die Nährwerttabelle, die App liest sie und merkt sich den Code. Beim nächsten Scan ist das Produkt sofort da.`),
    el('div', { class: 'actions' },
      el('button', { class: 'primary wide', onClick: () => { closeSheet(); startScanWithPicker({ camera: true, barcode: code }); } }, 'Nährwerttabelle fotografieren'),
      el('button', { class: 'btn', onClick: () => { closeSheet(); startDescribe({ barcode: code }); } }, 'Beschreiben'),
      el('button', { class: 'btn', onClick: () => { closeSheet(); openMealForm(null, { barcode: code }); } }, 'Manuell'),
      el('button', { class: 'btn wide', onClick: closeSheet }, 'Abbrechen')));
}
