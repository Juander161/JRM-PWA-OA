import React, { useEffect, useRef, useState } from 'react';
import { useFolderWatcher } from '../hooks/useFolderWatcher.js';

function tiempoRelativo(fecha) {
  if (!fecha) return '—';
  const s = Math.round((Date.now() - fecha.getTime()) / 1000);
  if (s < 60)   return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)} h`;
}

export default function FolderWatchPanel({ onNuevoEmail }) {
  const [abierto, setAbierto]   = useState(false);
  const [ahora, setAhora]       = useState(Date.now());
  const wrapRef                 = useRef(null);

  const {
    estado, folderName, ultimaRevision, correosProcesados,
    errorMsg, soportado, seleccionarYVigilar, detener,
  } = useFolderWatcher(onNuevoEmail);

  const watching = estado === 'watching';

  // Actualiza el tiempo relativo cada 5 s
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  void ahora;

  // Cierra el panel al hacer clic fuera
  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Botón ribbon */}
      <button
        className="btn-ribbon"
        onClick={() => setAbierto((v) => !v)}
        title={watching ? `Vigilando carpeta: ${folderName} — clic para ver detalles` : 'Modo automático: vigilar carpeta de correos'}
        style={watching ? { color: '#16a34a' } : undefined}
      >
        <span className="btn-ribbon-icon">📂</span>
        <span className="btn-ribbon-label" style={{ color: watching ? '#16a34a' : undefined }}>
          {watching ? '● Auto' : 'Auto'}
        </span>
      </button>

      {/* Panel flotante */}
      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: 16, width: 390, boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 13 }}>📂 Modo automático — Carpeta</strong>
            <button
              onClick={() => setAbierto(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}
            >×</button>
          </div>

          {!soportado ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: '#991b1b' }}>
              Tu navegador no soporta acceso a carpetas locales.
              Usa <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong> para activar este modo.
            </div>
          ) : watching ? (
            /* ── Estado: vigilando ── */
            <>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#166534' }}>
                      ● Vigilando: <em>{folderName}</em>
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 10, color: '#15803d' }}>
                      Revisión cada 10 s · última revisión: {tiempoRelativo(ultimaRevision)}
                    </p>
                  </div>
                  <button
                    onClick={detener}
                    style={{ fontSize: 10, padding: '3px 9px', background: 'none', border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer', color: '#166534', marginLeft: 10, flexShrink: 0 }}
                  >
                    Detener
                  </button>
                </div>
              </div>

              {correosProcesados.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: '12px 0' }}>
                  Esperando correos en la carpeta…
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#475569' }}>
                    {correosProcesados.length} correo(s) procesado(s) automáticamente:
                  </p>
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {correosProcesados.map((c, i) => (
                      <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.asunto || c.nombre}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>
                          {c.de || '—'} · {tiempoRelativo(c.procesadoEn)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            /* ── Estado: idle ── */
            <>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                La app revisará la carpeta seleccionada cada 10 segundos.
                Cualquier archivo <code>.txt</code> o <code>.eml</code> nuevo será procesado
                y su resultado aparecerá automáticamente en la tabla, sin ninguna acción adicional.
              </p>

              <button
                className="primary"
                onClick={seleccionarYVigilar}
                style={{ width: '100%', marginBottom: 10 }}
              >
                📂 Seleccionar carpeta de entrada
              </button>

              {errorMsg && (
                <p style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{errorMsg}</p>
              )}

              <details style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', userSelect: 'none', marginBottom: 6, fontWeight: 600 }}>
                  ¿Cómo configurar Outlook para guardado automático?
                </summary>
                <p style={{ margin: '0 0 4px' }}>
                  Una macro VBA enganchada a la carpeta de Outlook exporta cada correo
                  nuevo como <code>.txt</code> en la carpeta que vigila la app:
                </p>
                <ol style={{ margin: '0 0 6px', paddingLeft: 16, lineHeight: 1.9 }}>
                  <li><strong>Archivo → Opciones → Centro de confianza → Configuración de macros</strong> → Habilitar todas las macros</li>
                  <li><strong>Alt+F11</strong> → doble clic en <code>ThisOutlookSession</code> → pegar la macro <code>ItemAdd</code></li>
                  <li>Ajustar el nombre de la carpeta de Outlook y la ruta de salida en las constantes</li>
                  <li>Ejecutar <code>IniciarVigilancia</code> (F5) y seleccionar esa ruta aquí — listo</li>
                </ol>
                <p style={{ margin: 0, color: '#94a3b8' }}>
                  No se usa la acción “ejecutar script” de las reglas (Microsoft la quitó
                  en Outlook 365); el evento <code>ItemAdd</code> de la carpeta la reemplaza
                  y funciona aunque el correo llegue por una regla de servidor.
                </p>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
