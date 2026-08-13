import React from 'react';

// Barra de pestañas estilo editor de código (VSCode): cada resultado
// (un reporte cargado, un BO# evaluado, una búsqueda de trackings...) es
// una pestaña seleccionable, en vez de apilar tarjetas una debajo de otra.
export default function TabBar({ tabs, activeId, onSelect, onClose, extra, emptyMessage }) {
  if (!tabs.length) {
    return emptyMessage ? <p className="hint tab-bar-empty">{emptyMessage}</p> : null;
  }

  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab${tab.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(tab.id)}
            // `label` puede ser un nodo (p. ej. con indicador de "sin ver"),
            // así que el tooltip usa `tab.title` cuando viene dado.
            title={tab.title ?? (tab.sublabel ? `${tab.label} — ${tab.sublabel}` : tab.label)}
          >
            <span className="tab-label">{tab.label}</span>
            {tab.sublabel && <span className="tab-sublabel">{tab.sublabel}</span>}
            {tab.closable && (
              <span
                className="tab-close"
                role="button"
                aria-label={`Cerrar ${tab.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>
      {extra && <div className="tab-bar-extra">{extra}</div>}
    </div>
  );
}
