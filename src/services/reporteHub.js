// Servicio central que expone los reportes guardados en el módulo de
// Reportes al resto de la app. Cada módulo consulta aquí los reportes
// que le corresponden en vez de tener su propio almacén de archivos.
//
// La detección de tipo se hace por columnas (no por la etiqueta que el
// usuario eligió al subir), porque las columnas son objetivas y no
// cambian aunque el usuario use otra etiqueta.

import { listarReportes, obtenerArchivoReporte } from '../modules/reportes/utils/reportesStore.js';

function normCol(c) {
  return String(c).trim().toUpperCase();
}

function tieneColumna(columnas, ...candidatos) {
  const set = new Set(columnas.map(normCol));
  return candidatos.some((c) => set.has(c.toUpperCase()));
}

// ── Detección por columnas ───────────────────────────────────────────

export function esReporteInventario(columnas = []) {
  // Reporte OH: tiene "On-hand Qty" (o variantes) + algo de Item/Locator
  return tieneColumna(columnas,
    'ON-HAND QTY', 'ON HAND QTY', 'ONHAND QTY', 'OH QTY',
    'CANTIDAD DISPONIBLE', 'DISPONIBLE',
  );
}

export function esReporteEmbarques(columnas = []) {
  // Reporte de Embarques de Oracle: columna WAYBILL es la señal definitiva
  return tieneColumna(columnas, 'WAYBILL');
}

// Devuelve un hint de tipo para pre-seleccionar el dropdown al subir
export function detectarTipoSugerido(columnas) {
  if (esReporteEmbarques(columnas)) return 'Envíos';
  if (esReporteInventario(columnas)) return 'Inventario (OH)';
  return null;
}

// ── Listas filtradas ─────────────────────────────────────────────────

export function listarReportesInventario() {
  return listarReportes().filter((r) => esReporteInventario(r.columnas || []));
}

export function listarReportesEmbarques() {
  return listarReportes().filter((r) => esReporteEmbarques(r.columnas || []));
}

// Re-exporta para que los módulos no importen directamente de reportesStore
export { obtenerArchivoReporte };
