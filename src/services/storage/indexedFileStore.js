// Guarda archivos binarios (como el Excel de disponibilidad, que puede
// pesar varios MB con miles de filas) usando IndexedDB en vez de
// localStorage/sessionStorage: esos dos tienen un límite de solo unos
// pocos MB por origen y truenan con "QuotaExceededError" en archivos
// reales de este tamaño. IndexedDB no tiene ese límite tan bajo.
const DB_NAME = 'office-suite-files';
const STORE_NAME = 'archivos';
const DB_VERSION = 1;

function abrirBaseDeDatos() {
  return new Promise((resolve, reject) => {
    const solicitud = window.indexedDB.open(DB_NAME, DB_VERSION);
    solicitud.onupgradeneeded = () => {
      if (!solicitud.result.objectStoreNames.contains(STORE_NAME)) {
        solicitud.result.createObjectStore(STORE_NAME);
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

// Guarda un objeto (p. ej. { nombre, arrayBuffer, guardadoEn }) bajo una
// clave. Si falla (navegador sin soporte, modo incógnito muy restringido,
// etc.) no lanza: solo se pierde la persistencia entre recargas, sin
// afectar el resto de la app.
export async function guardarArchivo(clave, datos) {
  try {
    const db = await abrirBaseDeDatos();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(datos, clave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn(`No se pudo guardar el archivo "${clave}" en IndexedDB`, error);
  }
}

export async function cargarArchivo(clave) {
  try {
    const db = await abrirBaseDeDatos();
    const resultado = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const solicitud = tx.objectStore(STORE_NAME).get(clave);
      solicitud.onsuccess = () => resolve(solicitud.result || null);
      solicitud.onerror = () => reject(solicitud.error);
    });
    db.close();
    return resultado;
  } catch (error) {
    console.warn(`No se pudo leer el archivo "${clave}" de IndexedDB`, error);
    return null;
  }
}

export async function eliminarArchivo(clave) {
  try {
    const db = await abrirBaseDeDatos();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(clave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Sin acción: si no se pudo abrir la base, no hay nada que borrar.
  }
}
