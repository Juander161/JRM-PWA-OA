import React, { useEffect, useRef, useState } from 'react';
import { GRAPH_CONFIGURED } from '../../../services/graphApi/graphConfig.js';
import {
  estaConectado, cuentaActual,
  iniciarSesionMicrosoft, cerrarSesion,
} from '../../../services/graphApi/graphClient.js';
import {
  leerCorreosSolicitudes, responderCorreo, marcarLeido,
} from '../../../services/graphApi/emailService.js';
import { construirTablaHtml } from '../utils/buildCopySummary.js';

// Formatea fecha relativa corta (p. ej. "hace 3 h").
function tiempoRelativo(fecha) {
  const mins = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (mins < 60)  return `hace ${mins} min`;
  if (mins < 1440) return `hace ${Math.floor(mins / 60)} h`;
  return `hace ${Math.floor(mins / 1440)} d`;
}

export default function EmailIntegrationPanel({ onCorreosProcesados }) {
  const [abierto, setAbierto]           = useState(false);
  const [conectado, setConectado]       = useState(() => estaConectado());
  const [cuenta, setCuenta]             = useState(() => cuentaActual());
  const [correos, setCorreos]           = useState([]);
  const [cargando, setCargando]         = useState(false);
  const [error, setError]               = useState('');
  const [respondiendo, setRespondiendo] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  async function handleConectar() {
    setError('');
    setCargando(true);
    try {
      await iniciarSesionMicrosoft();
      setConectado(true);
      setCuenta(cuentaActual());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function handleDesconectar() {
    await cerrarSesion();
    setConectado(false);
    setCuenta(null);
    setCorreos([]);
  }

  async function handleLeerCorreos() {
    setError('');
    setCargando(true);
    try {
      const lista = await leerCorreosSolicitudes({ top: 20 });
      setCorreos(lista);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function handleProcesarCorreo(correo) {
    if (onCorreosProcesados) onCorreosProcesados(correo.textoPlano);
    await marcarLeido(correo.id).catch(() => {});
    setCorreos((prev) => prev.filter((c) => c.id !== correo.id));
  }

  async function handleResponder(correo, solicitudEvaluada) {
    setRespondiendo(correo.id);
    try {
      const html = construirTablaHtml(solicitudEvaluada);
      await responderCorreo(correo.id, html);
      setCorreos((prev) => prev.filter((c) => c.id !== correo.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setRespondiendo(null);
    }
  }

  const noConfigurado = !GRAPH_CONFIGURED;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Botón ribbon */}
      <button
        className="btn-ribbon"
        onClick={() => setAbierto((v) => !v)}
        title={noConfigurado ? 'Microsoft Graph API no configurada — ver panel para instrucciones' : 'Panel de integración de correo Microsoft 365'}
        style={conectado ? { color: '#2563eb' } : undefined}
      >
        <span className="btn-ribbon-icon">📧</span>
        <span className="btn-ribbon-label" style={{ color: conectado ? '#2563eb' : noConfigurado ? '#94a3b8' : undefined }}>
          {conectado ? `Correo ✓` : 'Correos'}
        </span>
      </button>

      {/* Panel flotante */}
      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: 16, width: 380, boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 13 }}>📧 Integración Microsoft 365</strong>
            <button
              onClick={() => setAbierto(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}
            >×</button>
          </div>

          {/* Bloque de estado / configuración */}
          {noConfigurado ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                Pendiente de configuración
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#78350f' }}>
                Para activar la lectura y respuesta automática de correos:
              </p>
              <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#78350f', lineHeight: 1.7 }}>
                <li>Registra la app en <strong>portal.azure.com</strong> → App registrations</li>
                <li>Agrega permisos delegados: <code>Mail.Read</code>, <code>Mail.Send</code></li>
                <li>Añade al <code>.env.local</code>:<br />
                  <code style={{ display: 'block', marginTop: 2, background: '#fef3c7', padding: '2px 6px', borderRadius: 3 }}>
                    VITE_GRAPH_CLIENT_ID=…<br />
                    VITE_GRAPH_TENANT_ID=…
                  </code>
                </li>
                <li>Instala: <code>npm i @azure/msal-browser @microsoft/microsoft-graph-client</code></li>
                <li>Descomenta el código en <code>src/services/graphApi/graphClient.js</code></li>
              </ol>
            </div>
          ) : !conectado ? (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#475569' }}>
                Conecta tu cuenta de Microsoft 365 para leer solicitudes directamente del buzón
                y enviar respuestas de aprobación automáticamente.
              </p>
              {error && <p style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
              <button
                className="primary"
                onClick={handleConectar}
                disabled={cargando}
                style={{ width: '100%' }}
              >
                {cargando ? 'Conectando…' : '🔑 Iniciar sesión con Microsoft'}
              </button>
            </div>
          ) : (
            <div>
              {/* Cuenta conectada */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: 11, color: '#166534' }}>
                  ✓ Conectado como <strong>{cuenta?.username || cuenta?.name}</strong>
                </span>
                <button
                  onClick={handleDesconectar}
                  style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Desconectar
                </button>
              </div>

              {error && <p style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</p>}

              <button
                className="secondary"
                onClick={handleLeerCorreos}
                disabled={cargando}
                style={{ width: '100%', marginBottom: 10 }}
              >
                {cargando ? 'Cargando…' : '📥 Leer correos no leídos'}
              </button>

              {/* Lista de correos */}
              {correos.length === 0 && !cargando && (
                <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: '8px 0' }}>
                  Sin correos. Usa "Leer correos" para actualizar.
                </p>
              )}
              {correos.map((c) => (
                <div key={c.id} style={{
                  border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px', marginBottom: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.asunto}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0, marginLeft: 6 }}>
                      {tiempoRelativo(c.recibiEn)}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 10, color: '#64748b' }}>{c.de}</p>
                  <button
                    className="primary"
                    onClick={() => handleProcesarCorreo(c)}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    Procesar solicitud
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
