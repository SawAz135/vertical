// LOOPLAB — "Mes vidéos": rendered videos kept in IndexedDB on this device.
const NAME = 'looplab', STORE = 'videos';
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}
export const saveVideo = (v) => tx('readwrite', (s) => s.put(v));
export const deleteVideo = (id) => tx('readwrite', (s) => s.delete(id));
export async function listVideos() {
  try {
    const all = await tx('readonly', (s) => s.getAll());
    return (all || []).sort((a, b) => b.created - a.created);
  } catch (e) { return []; }
}
