import React, { useRef, useState } from 'react';
import Card from '../../../components/Card.jsx';
import { parseArchivoCorreo } from '../utils/parseEmlFile.js';

export default function RequestTextInput({ valor, onChange }) {
  const [dragging, setDragging]   = useState(false);
  const [meta, setMeta]           = useState(null); // { de, asunto, fecha }
  const [emlError, setEmlError]   = useState('');
  const fileInputRef              = useRef(null);

  function cargarEml(file) {
    if (!file) return;
    const nombre = file.name.toLowerCase();
    if (!nombre.endsWith('.eml') && !nombre.endsWith('.txt')) {
      setEmlError('El archivo debe tener extensión .eml o .txt');
      return;
    }
    setEmlError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const resultado = parseArchivoCorreo(file.name, e.target.result);
        setMeta({ de: resultado.de, asunto: resultado.asunto, fecha: resultado.fecha });
        onChange(resultado.texto);
      } catch {
        setEmlError('No se pudo procesar el archivo .eml');
      }
    };
    reader.onerror = () => setEmlError('Error al leer el archivo');
    reader.readAsText(file, 'utf-8');
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    cargarEml(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  }

  function handleFileChange(e) {
    cargarEml(e.target.files?.[0]);
    e.target.value = '';
  }

  function handleCambioManual(e) {
    if (meta) setMeta(null);
    onChange(e.target.value);
  }

  const dropStyle = dragging
    ? { outline: '2px dashed #2563eb', outlineOffset: -2, background: '#eff6ff', borderRadius: 6 }
    : {};

  return (
    <Card title="1. Pegar solicitud(es) del correo">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <p className="hint" style={{ margin: 0, flex: 1 }}>
          <strong>Completo</strong> — encabezado PRDF + items (varios BO# juntos).&nbsp;
          <strong>Solo items</strong> — líneas <code>Item [...]</code> sin encabezado.
        </p>
        <button
          className="btn-ribbon"
          style={{ fontSize: 11, padding: '2px 8px', minWidth: 'unset', flexDirection: 'row', gap: 4 }}
          title="Cargar un archivo .eml o .txt exportado desde Outlook"
          onClick={() => fileInputRef.current?.click()}
        >
          <span>📎</span>
          <span>Cargar archivo</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".eml,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {meta && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
          padding: '6px 10px', marginBottom: 6, fontSize: 11, color: '#166534',
          display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2,
        }}>
          <span style={{ fontWeight: 600 }}>De:</span>      <span>{meta.de || '—'}</span>
          <span style={{ fontWeight: 600 }}>Asunto:</span>  <span>{meta.asunto || '—'}</span>
          <span style={{ fontWeight: 600 }}>Fecha:</span>   <span>{meta.fecha || '—'}</span>
        </div>
      )}

      {emlError && (
        <p style={{ margin: '0 0 4px', fontSize: 11, color: '#b91c1c' }}>{emlError}</p>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={dropStyle}
      >
        {dragging ? (
          <div style={{
            height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: '#2563eb', fontWeight: 600,
          }}>
            Suelta el archivo .eml o .txt aquí
          </div>
        ) : (
          <textarea
            rows={10}
            style={{ width: '100%' }}
            placeholder={
              'Formato completo:\nPRDF: RDD 24-JUL-26, Event Date N/A, SLADE JAN, Rep SLADE JAN, BO# 95637276\nItem [2000097477]    Qty [1]    Description [SERVICE: RETURN.ALTERATION.]\n\nO solo items:\nItem [2000097477]    Qty [1]    Description [SERVICE: RETURN.ALTERATION.]\nItem [1012010779]    Qty [13]   Description [PRODUCT PACKAGE: ...]'
            }
            value={valor}
            onChange={handleCambioManual}
          />
        )}
      </div>

      {!meta && (
        <p style={{ margin: '3px 0 0', fontSize: 10, color: '#94a3b8' }}>
          También puedes arrastrar y soltar un archivo .eml o .txt directamente aquí.
        </p>
      )}
    </Card>
  );
}
