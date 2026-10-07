const DB_NAME = 'kalorientracker';
const STORES = ['products', 'meals', 'weights', 'settings'];
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        const meals = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
        meals.createIndex('dateKey', 'dateKey');
        db.createObjectStore('weights', { keyPath: 'date' });
        db.createObjectStore('settings');
      }
      if (e.oldVersion < 2) {
        // Fotos, die offline aufgenommen wurden und auf Auswertung warten (nicht Teil der Sicherung).
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

async function getAll(name) {
  return wrap((await store(name)).getAll());
}

export async function addProduct(p) {
  const { id, ...rest } = p;
  return wrap((await store('products', 'readwrite')).add(rest));
}
export const listProducts = () => getAll('products');
export async function getProduct(id) {
  return wrap((await store('products')).get(id));
}
export async function deleteProduct(id) {
  await wrap((await store('products', 'readwrite')).delete(id));
}
export async function updateProduct(p) {
  await wrap((await store('products', 'readwrite')).put(p));
}

export async function addMeal(m) {
  const { id, ...rest } = m;
  return wrap((await store('meals', 'readwrite')).add(rest));
}
export async function mealsForDate(dateKey) {
  const s = await store('meals');
  const list = await wrap(s.index('dateKey').getAll(dateKey));
  return list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
export const listMeals = () => getAll('meals');
export async function updateMeal(m) {
  await wrap((await store('meals', 'readwrite')).put(m));
}
export async function deleteMeal(id) {
  await wrap((await store('meals', 'readwrite')).delete(id));
}

export async function setWeight(dateKey, kg) {
  await wrap((await store('weights', 'readwrite')).put({ date: dateKey, kg }));
}
export async function listWeights() {
  const list = await getAll('weights');
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getSettings() {
  const s = await wrap((await store('settings')).get('main'));
  return { calorieGoal: null, geminiKey: null, ...(s ?? {}) };
}
export async function saveSettings(s) {
  await wrap((await store('settings', 'readwrite')).put(s, 'main'));
}

export async function exportAll() {
  const [products, meals, weights, settings] = await Promise.all([
    getAll('products'), getAll('meals'), getAll('weights'), getSettings(),
  ]);
  return { products, meals, weights, settings };
}

// Ersetzt alles in einer Transaktion; bei Fehler wird nichts verändert.
export async function replaceAll(data) {
  const db = await open();
  const keepKey = (await getSettings()).geminiKey;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Import abgebrochen'));
    try {
      for (const name of STORES) tx.objectStore(name).clear();
      for (const p of data.products) tx.objectStore('products').put(p);
      for (const m of data.meals) tx.objectStore('meals').put(m);
      for (const w of data.weights) tx.objectStore('weights').put(w);
      tx.objectStore('settings').put({ calorieGoal: null, ...data.settings, geminiKey: keepKey }, 'main');
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
}

// ---------- Warteschlange (offline aufgenommene Fotos) ----------
// item: { blobs: Blob[], hint: string, dateKey: string, createdAt: string }
export async function addQueued(item) {
  const { id, ...rest } = item;
  return wrap((await store('queue', 'readwrite')).add(rest));
}
export async function listQueued() {
  const list = await getAll('queue');
  return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function deleteQueued(id) {
  await wrap((await store('queue', 'readwrite')).delete(id));
}
