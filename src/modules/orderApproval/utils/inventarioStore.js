import { loadJSON, saveJSON } from '../../../services/storage/localStore.js';
import { guardarArchivo, cargarArchivo, eliminarArchivo } from '../../../services/storage/indexedFileStore.js';

// Historial de Excels de disponibilidad ("material disponible"), uno por
// día normalmente, pero se guardan todos los que se suban (no solo el de
// hoy) para poder comparar contra varios días a la vez cuando haga falta
// (p. ej. mientras la conexión a Outlook/base de datos no esté lista y el
// archivo siga llegando manualmente día a día).
// Mismo patrón que reportes/utils/reportesStore.js: metadata ligera en
// localStorage, contenido pesado del archivo en IndexedDB.
const METADATA_KEY = 'order-approval-inventarios-historial';

function claveArchivo(id) {
  return `order-approval-inventario-${id}`;
}

export function listarInventarios() {
  const inventarios = loadJSON(METADATA_KEY, []);
  return [...inventarios].sort((a, b) => b.fechaSubida.localeCompare(a.fechaSubida));
}

function guardarMetadatos(inventarios) {
  saveJSON(METADATA_KEY, inventarios);
}

export async function agregarInventario({ nombreArchivo, arrayBuffer }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const metadata = {
    id,
    nombreArchivo,
    fechaSubida: new Date().toISOString(),
  };

  await guardarArchivo(claveArchivo(id), { arrayBuffer });
  guardarMetadatos([...listarInventarios(), metadata]);
  return metadata;
}

export async function obtenerArchivoInventario(id) {
  const datos = await cargarArchivo(claveArchivo(id));
  return datos ? datos.arrayBuffer : null;
}

export async function eliminarInventario(id) {
  await eliminarArchivo(claveArchivo(id));
  guardarMetadatos(listarInventarios().filter((i) => i.id !== id));
}
