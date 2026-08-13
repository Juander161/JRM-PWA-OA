import { loadJSON, saveJSON } from '../../../services/storage/localStore.js';
import { guardarArchivo, cargarArchivo, eliminarArchivo } from '../../../services/storage/indexedFileStore.js';

// Historial de reportes: los metadatos (tipo, nombre, fecha, columnas...)
// se guardan en localStorage (ligeros, deben sobrevivir indefinidamente
// para poder "acceder a reportes anteriores"). El contenido pesado del
// archivo se guarda aparte en IndexedDB (ver indexedFileStore.js), que no
// tiene el límite de unos pocos MB de localStorage/sessionStorage.
const METADATA_KEY = 'reportes-historial';

function claveArchivo(id) {
  return `reporte-${id}`;
}

export function listarReportes() {
  const reportes = loadJSON(METADATA_KEY, []);
  return [...reportes].sort((a, b) => b.fechaSubida.localeCompare(a.fechaSubida));
}

function guardarMetadatos(reportes) {
  saveJSON(METADATA_KEY, reportes);
}

// Registra un reporte nuevo: guarda el archivo original en IndexedDB y su
// metadata (para el historial) en localStorage.
export async function agregarReporte({
  tipo,
  nombreArchivo,
  descripcion,
  subidoPor,
  columnas,
  totalFilas,
  tamanioBytes,
  arrayBuffer,
  origen = 'manual',
}) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const metadata = {
    id,
    tipo,
    nombreArchivo,
    descripcion: descripcion || '',
    subidoPor,
    columnas,
    totalFilas,
    tamanioBytes,
    origen,
    fechaSubida: new Date().toISOString(),
  };

  await guardarArchivo(claveArchivo(id), { arrayBuffer });
  guardarMetadatos([...listarReportes(), metadata]);
  return metadata;
}

export async function obtenerArchivoReporte(id) {
  const datos = await cargarArchivo(claveArchivo(id));
  return datos ? datos.arrayBuffer : null;
}

export async function eliminarReporte(id) {
  await eliminarArchivo(claveArchivo(id));
  guardarMetadatos(listarReportes().filter((r) => r.id !== id));
}
