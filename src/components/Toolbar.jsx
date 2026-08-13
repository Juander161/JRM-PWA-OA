import React from 'react';

// Barra de herramientas compacta para la parte superior de un módulo:
// acciones principales (sincronizar, cargar, comparar, buscar...) en vez
// de tarjetas grandes siempre visibles. El contenido variable de cada
// módulo (formularios, resultados) va debajo, organizado en pestañas.
export default function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}
