import React from 'react';

function formatearFechaHora(iso) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// Selector compacto de reportes de inventario (tipo "Inventario (OH)")
// disponibles en el módulo de Reportes. El archivo ya no se sube aquí:
// todos los reportes se cargan en su sección centralizada y este picker
// solo permite escoger cuáles días se usan para la comparación actual.
export default function InventoryFilesPicker({
  archivos,
  seleccionados,
  onSeleccionChange,
}) {
  function handleChangeSeleccion(e) {
    const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
    onSeleccionChange(ids);
  }

  if (archivos.length === 0) {
    return (
      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #9ca3af)' }}>
        Sin reportes de inventario — carga uno en{' '}
        <strong>Reportes</strong>
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted, #6b7280)', whiteSpace: 'nowrap' }}>
        Disponibilidad (Ctrl+clic = varios días)
      </span>
      <select
        multiple
        size={Math.min(3, archivos.length)}
        value={seleccionados}
        onChange={handleChangeSeleccion}
        style={{ minWidth: 220, maxWidth: 320, fontSize: '0.82rem' }}
        title="Ctrl/Cmd + clic para comparar contra varios días a la vez"
      >
        {archivos.map((a) => (
          <option key={a.id} value={a.id}>
            {formatearFechaHora(a.fechaSubida)} — {a.nombreArchivo}
          </option>
        ))}
      </select>
    </div>
  );
}
