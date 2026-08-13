// Microsoft Graph API — configuración de la aplicación Azure AD.
//
// Pasos para activar:
//   1. Registrar una aplicación en https://portal.azure.com → Azure Active Directory
//      → App registrations → New registration.
//   2. En Authentication añadir "Single-page application" con la URL de la app.
//   3. En API permissions agregar: Mail.Read, Mail.Send (Delegated).
//   4. Copiar Application (client) ID y Directory (tenant) ID al .env.local:
//
//        VITE_GRAPH_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
//        VITE_GRAPH_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
//        VITE_GRAPH_MAIL_FOLDER=Inbox   # opcional — carpeta a leer
//
//   5. npm install @azure/msal-browser @microsoft/microsoft-graph-client
//      y descomentar las importaciones en graphClient.js.

export const GRAPH_CONFIG = {
  clientId:    import.meta.env.VITE_GRAPH_CLIENT_ID  || '',
  tenantId:    import.meta.env.VITE_GRAPH_TENANT_ID  || '',
  redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
  scopes:      ['Mail.Read', 'Mail.Send', 'offline_access'],
  mailFolder:  import.meta.env.VITE_GRAPH_MAIL_FOLDER || 'Inbox',
};

// true cuando las credenciales están presentes en el entorno.
export const GRAPH_CONFIGURED = !!(GRAPH_CONFIG.clientId && GRAPH_CONFIG.tenantId);
