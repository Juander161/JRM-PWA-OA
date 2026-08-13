// Cliente de Microsoft Graph — autenticación con MSAL (OAuth 2.0 / PKCE).
//
// Estado actual: PENDIENTE DE CREDENCIALES.
// Una vez que tengas el App Registration de Azure, completa graphConfig.js
// y descomenta las importaciones de @azure/msal-browser a continuación.
//
// import { PublicClientApplication } from '@azure/msal-browser';
// import { Client } from '@microsoft/microsoft-graph-client';

import { GRAPH_CONFIG, GRAPH_CONFIGURED } from './graphConfig.js';

let _msalInstance = null;
let _graphClient  = null;
let _cuenta       = null;

export function estaConfigurado() {
  return GRAPH_CONFIGURED;
}

export function estaConectado() {
  return _cuenta !== null;
}

export function cuentaActual() {
  return _cuenta;
}

// Inicializa MSAL y devuelve el cliente de Graph.
// Llama a esto una sola vez en el punto de entrada de la feature.
export async function inicializarCliente() {
  if (!GRAPH_CONFIGURED) {
    throw new Error(
      'Microsoft Graph API no configurada. ' +
      'Completa VITE_GRAPH_CLIENT_ID y VITE_GRAPH_TENANT_ID en .env.local.'
    );
  }

  if (_graphClient) return _graphClient;

  // ── Descomentar cuando las dependencias estén instaladas ──────────────────
  // const { PublicClientApplication } = await import('@azure/msal-browser');
  // const { Client } = await import('@microsoft/microsoft-graph-client');
  //
  // _msalInstance = new PublicClientApplication({
  //   auth: {
  //     clientId:    GRAPH_CONFIG.clientId,
  //     authority:   `https://login.microsoftonline.com/${GRAPH_CONFIG.tenantId}`,
  //     redirectUri: GRAPH_CONFIG.redirectUri,
  //   },
  //   cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
  // });
  // await _msalInstance.initialize();
  //
  // const cuentas = _msalInstance.getAllAccounts();
  // if (cuentas.length) _cuenta = cuentas[0];
  //
  // _graphClient = Client.initWithMiddleware({
  //   authProvider: {
  //     getAccessToken: async () => {
  //       const resultado = await _msalInstance.acquireTokenSilent({
  //         scopes:  GRAPH_CONFIG.scopes,
  //         account: _cuenta,
  //       });
  //       return resultado.accessToken;
  //     },
  //   },
  // });
  //
  // return _graphClient;
  // ─────────────────────────────────────────────────────────────────────────

  throw new Error('Pendiente: instala @azure/msal-browser y descomenta el código en graphClient.js');
}

// Abre el popup de inicio de sesión de Microsoft y guarda la cuenta.
export async function iniciarSesionMicrosoft() {
  if (!_msalInstance) await inicializarCliente();
  // const resultado = await _msalInstance.loginPopup({ scopes: GRAPH_CONFIG.scopes });
  // _cuenta = resultado.account;
  throw new Error('Pendiente: instala @azure/msal-browser y descomenta el código en graphClient.js');
}

export async function cerrarSesion() {
  if (!_msalInstance || !_cuenta) return;
  // await _msalInstance.logoutPopup({ account: _cuenta });
  _cuenta = null;
  _graphClient = null;
}

export function obtenerCliente() {
  if (!_graphClient) throw new Error('Llama a inicializarCliente() antes de usar el cliente.');
  return _graphClient;
}
