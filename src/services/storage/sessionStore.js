// Igual que localStore.js pero usando sessionStorage: para datos que solo
// deben sobrevivir mientras dura la pestaña/sesión de trabajo (por ejemplo,
// el Excel de disponibilidad del día o el historial de comparaciones), sin
// quedar guardados indefinidamente en el navegador.
const NAMESPACE = 'office-suite-session';

function fullKey(key) {
  return `${NAMESPACE}:${key}`;
}

export function loadSessionJSON(key, fallback) {
  try {
    const raw = window.sessionStorage.getItem(fullKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`No se pudo leer "${key}" de sessionStorage`, error);
    return fallback;
  }
}

export function saveSessionJSON(key, value) {
  try {
    window.sessionStorage.setItem(fullKey(key), JSON.stringify(value));
  } catch (error) {
    console.warn(`No se pudo guardar "${key}" en sessionStorage (¿archivo muy grande?)`, error);
  }
}

export function removeSessionItem(key) {
  try {
    window.sessionStorage.removeItem(fullKey(key));
  } catch {
    // Ignorar: si sessionStorage no está disponible, no hay nada que limpiar.
  }
}
