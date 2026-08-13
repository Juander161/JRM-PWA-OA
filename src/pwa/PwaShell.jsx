import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import OrderApprovalPage from '../modules/orderApproval/OrderApprovalPage.jsx';
import { agregarReporte } from '../modules/reportes/utils/reportesStore.js';
import { listarReportesInventario } from '../services/reporteHub.js';

// El reporte OH trae varias hojas y solo la llamada "OH" es inventario
// disponible para enviar; las demás (p. ej. "QC MEX") son material en otras
// situaciones y no deben contarse. Mismo criterio que parseInventoryFile.js.
function elegirHoja(workbook) {
  const nombre = workbook.SheetNames.find((n) => n.trim().toUpperCase() === 'OH');
  return workbook.Sheets[nombre || workbook.SheetNames[0]];
}

function CargadorInventario({ onCargado }) {
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const reportes = listarReportesInventario();
  const activo = reportes[0];

  async function handleArchivo(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;

    setError('');
    setCargando(true);
    try {
      const arrayBuffer = await archivo.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const filas = XLSX.utils.sheet_to_json(elegirHoja(workbook), { defval: '' });
      const columnas = filas.length ? Object.keys(filas[0]) : [];

      await agregarReporte({
        tipo: 'Inventario (OH)',
        nombreArchivo: archivo.name,
        subidoPor: 'PWA',
        columnas,
        totalFilas: filas.length,
        tamanioBytes: archivo.size,
        arrayBuffer,
        origen: 'pwa',
      });
      onCargado();
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {activo && (
        <span style={{ fontSize: 11, color: '#bfd0f5', maxWidth: 240, overflow: 'hidden',
                       textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={`${activo.nombreArchivo} · ${activo.totalFilas} filas`}>
          📗 {activo.nombreArchivo}
        </span>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={cargando}
        style={{
          fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)',
          color: 'white', cursor: cargando ? 'progress' : 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {cargando ? 'Leyendo…' : activo ? 'Cambiar OH' : '📗 Cargar inventario OH'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleArchivo}
      />
      {error && <span style={{ fontSize: 11, color: '#fecaca' }}>{error}</span>}
    </div>
  );
}

export default function PwaShell() {
  // OrderApprovalPage lee la lista de reportes una sola vez al montarse, así
  // que al cargar un OH nuevo se le cambia la clave para que vuelva a leerla.
  const [version, setVersion] = useState(0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: '#22346B', color: 'white', padding: '10px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <strong style={{ fontSize: 15, letterSpacing: '-0.01em' }}>Order Approval</strong>
          <span style={{ fontSize: 11, color: '#bfd0f5' }}>CS JRM</span>
        </div>
        <CargadorInventario onCargado={() => setVersion((v) => v + 1)} />
      </header>

      <main style={{ flex: 1, padding: '14px 18px 32px' }}>
        <OrderApprovalPage key={version} />
      </main>
    </div>
  );
}
