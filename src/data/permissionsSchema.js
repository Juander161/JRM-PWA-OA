// Catálogo central de secciones y acciones de la app.
// Cuando se agregue una sección nueva (p. ej. una tercera herramienta),
// solo hay que añadirla aquí y el panel de administración y el modelo
// de permisos la reconocen automáticamente.
export const SECTIONS = [
  {
    key: 'orderApproval',
    label: 'Order Approval',
    actions: [
      { key: 'view', label: 'Ver la sección' },
      { key: 'run', label: 'Ejecutar comparación (pegar solicitud + Excel)' },
      { key: 'configureThreshold', label: 'Configurar el umbral de aprobación' },
    ],
  },
  {
    key: 'tracking',
    label: 'Revisión de Trackings (UPS)',
    actions: [
      { key: 'view', label: 'Ver la sección' },
      { key: 'search', label: 'Ejecutar búsqueda / consulta de trackings' },
      { key: 'export', label: 'Descargar reporte Excel' },
      { key: 'configureSource', label: 'Cambiar la fuente de datos (simulado / scraping real)' },
    ],
  },
  {
    key: 'reportes',
    label: 'Reportes',
    actions: [
      { key: 'view', label: 'Ver la sección' },
      { key: 'upload', label: 'Cargar reportes manualmente' },
      { key: 'export', label: 'Descargar reportes del historial' },
      { key: 'eliminar', label: 'Eliminar reportes del historial' },
    ],
  },
  {
    key: 'emailIntegration',
    label: 'Integración de Correo (Microsoft Graph API)',
    actions: [
      { key: 'view',       label: 'Ver el panel de integración de correo' },
      { key: 'connect',    label: 'Conectar cuenta de Microsoft 365' },
      { key: 'readEmails', label: 'Leer correos del buzón y procesarlos' },
      { key: 'sendEmails', label: 'Enviar respuestas y reenvíos automáticos' },
    ],
  },
];

export const ROLES = ['admin', 'user'];

export function buildEmptyPermissions() {
  const permissions = {};
  for (const section of SECTIONS) {
    permissions[section.key] = {};
    for (const action of section.actions) {
      permissions[section.key][action.key] = false;
    }
  }
  return permissions;
}

export function buildFullPermissions() {
  const permissions = {};
  for (const section of SECTIONS) {
    permissions[section.key] = {};
    for (const action of section.actions) {
      permissions[section.key][action.key] = true;
    }
  }
  return permissions;
}
