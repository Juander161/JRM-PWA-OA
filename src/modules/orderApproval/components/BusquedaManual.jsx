import React, { useState } from 'react';

// Versión compacta para la barra de herramientas: input + resultado inline.
// Si no hay inventario cargado, no se muestra nada.
export default function BusquedaManual({ inventario }) {
  const [codigo, setCodigo] = useState('');

  if (!inventario) return null;

  const clave = codigo.trim().toUpperCase();
  const resultado = clave ? inventario.get(clave) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted, #6b7280)', whiteSpace: 'nowrap' }}>
        Consulta rápida
      </span>
      <input
        type="text"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Código de Item"
        style={{ width: 140, fontSize: '0.82rem' }}
        title="Escribe un código de Item para consultar su disponibilidad"
      />
      {clave && (
        <span style={{
          fontSize: '0.72rem',
          whiteSpace: 'nowrap',
          color: resultado ? 'var(--color-success, #15803d)' : 'var(--color-text-muted, #9ca3af)',
        }}>
          {resultado
            ? `✓ ${resultado.disponible} uds — ${resultado.descripcion || resultado.itemCode}`
            : `"${clave}" no encontrado`}
        </span>
      )}
    </div>
  );
}
