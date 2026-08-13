import React, { useRef } from 'react';
import Card from '../../../components/Card.jsx';

export default function InventoryUpload({ fileName, onFileSelected, error }) {
  const inputRef = useRef(null);

  function handleChange(e) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <Card title="2. Excel de material disponible">
      <p className="hint">
        Sube el Excel de inventario disponible del día (columnas esperadas: código de
        Item, Descripción, Cantidad Disponible y, si aplica, Demanda/Consumo).
      </p>
      <div className="dropzone" onClick={() => inputRef.current?.click()}>
        {fileName ? (
          <p>Archivo cargado: <strong>{fileName}</strong> (clic para cambiar)</p>
        ) : (
          <p>Haz clic para seleccionar el Excel de disponibilidad</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </div>
      {error && <p className="hint" style={{ color: '#b91c1c' }}>{error}</p>}
    </Card>
  );
}
