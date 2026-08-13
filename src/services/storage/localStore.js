// Envoltura simple sobre localStorage con espacio de nombres y manejo de errores.
// Toda la persistencia "temporal" de la app (mientras no hay backend real)
// pasa por aquí, para poder sustituirla después por llamadas a una API real
// sin tocar el resto del código.
const NAMESPACE = 'office-suite';

function fullKey(key) {
  return `${NAMESPACE}:${key}`;
}

export function loadJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(fullKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`No se pudo leer "${key}" de localStorage`, error);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    window.localStorage.setItem(fullKey(key), JSON.stringify(value));
  } catch (error) {
    console.warn(`No se pudo guardar "${key}" en localStorage`, error);
  }
}
