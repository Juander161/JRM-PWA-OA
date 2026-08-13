import React, { useEffect, useRef, useState } from 'react';
import { usePermission } from '../../../context/PermissionsContext.jsx';

// Popover flotante con la lista de items excluidos (siempre rechazados).
function ExclusionListPopover({ codigosExcluidos, onChange, disabled }) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  function agregar() {
    const cod = valor.trim().toUpperCase();
    if (cod && !codigosExcluidos.includes(cod)) onChange([...codigosExcluidos, cod]);
    setValor('');
  }

  const n = codigosExcluidos.length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="btn-ribbon"
        onClick={() => !disabled && setAbierto((v) => !v)}
        disabled={disabled}
        title="Items que se rechazan siempre, sin importar el inventario disponible"
        style={n ? { color: '#b91c1c' } : undefined}
      >
        <span className="btn-ribbon-icon">🚫</span>
        <span className="btn-ribbon-label">{n ? `Excl. (${n})` : 'Excluidos'}</span>
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: 14, minWidth: 300, boxShadow: '0 6px 20px rgba(0,0,0,0.13)',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#334155' }}>
            Items excluidos — siempre Rechazado
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: '#64748b' }}>
            Estos códigos se rechazan automáticamente aunque haya inventario disponible.
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Código de item…"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
              style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
              autoFocus
            />
            <button
              className="primary"
              onClick={agregar}
              style={{ fontSize: 12, padding: '4px 12px', whiteSpace: 'nowrap' }}
            >
              + Agregar
            </button>
          </div>
          {n === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Sin items excluidos.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {codigosExcluidos.map((cod) => (
                <span key={cod} style={{
                  background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca',
                  borderRadius: 4, padding: '2px 6px', fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {cod}
                  <button
                    onClick={() => onChange(codigosExcluidos.filter((c) => c !== cod))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 14, lineHeight: 1 }}
                    title={`Quitar ${cod} de la lista`}
                  >×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Versión compacta para la barra de herramientas: inputs numéricos + lista de
// exclusión, todo en línea sin envolver en Card.
export default function ThresholdConfig({
  umbral,          onUmbralChange,
  margenDias,      onMargenDiasChange,
  margenAmbar,     onMargenAmbarChange,
  cantidadMaxima,  onCantidadMaximaChange,
  cantidadMinima,  onCantidadMinimaChange,
  codigosExcluidos, onCodigosExcluidosChange,
}) {
  const puedeConfigurar = usePermission('orderApproval', 'configureThreshold');

  const inputStyle = { width: 54, textAlign: 'center' };
  const labelStyle = { fontSize: '0.72rem', color: 'var(--color-text-muted, #6b7280)', whiteSpace: 'nowrap' };

  function Campo({ label, valor, onChange, min = 0, max, title }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={labelStyle}>{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={valor}
          disabled={!puedeConfigurar}
          style={inputStyle}
          title={title}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Campo
        label="Umbral %"
        valor={umbral}
        onChange={onUmbralChange}
        min={1} max={100}
        title="Umbral de consumo para aprobar (%). Solicitado ÷ disponible por debajo de este % = Aprobado"
      />
      <Campo
        label="Zona ámbar %"
        valor={margenAmbar}
        onChange={onMargenAmbarChange}
        min={0} max={30}
        title="Puntos porcentuales antes del umbral que se clasifican como 'Revisar'"
      />
      <Campo
        label="Días RDD"
        valor={margenDias}
        onChange={onMargenDiasChange}
        min={0} max={30}
        title="RDD a menos de estos días de hoy = rechazo automático"
      />
      <div style={{ width: 1, alignSelf: 'stretch', background: '#e2e8f0', margin: '0 2px' }} />
      <Campo
        label="Qty máx"
        valor={cantidadMaxima}
        onChange={onCantidadMaximaChange}
        min={0}
        title="Rechazar si la cantidad solicitada supera este valor (0 = sin límite)"
      />
      <Campo
        label="Qty mín"
        valor={cantidadMinima}
        onChange={onCantidadMinimaChange}
        min={0}
        title="Rechazar si la cantidad solicitada es menor a este valor (0 = sin mínimo)"
      />
      <ExclusionListPopover
        codigosExcluidos={codigosExcluidos}
        onChange={onCodigosExcluidosChange}
        disabled={!puedeConfigurar}
      />
    </div>
  );
}
