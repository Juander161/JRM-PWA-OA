// Operaciones de correo a través de Microsoft Graph API.
// Requiere graphClient.js inicializado y sesión activa.

import { obtenerCliente } from './graphClient.js';
import { GRAPH_CONFIG } from './graphConfig.js';

// Convierte el HTML de un cuerpo de correo a texto plano para pasarlo
// al parseador de solicitudes existente (parseRequestText).
function htmlATexto(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body?.innerText || doc.body?.textContent || '';
  } catch {
    return html;
  }
}

// Lee los correos no leídos de la carpeta configurada.
// Devuelve una lista de objetos listos para procesar con parseRequestText.
export async function leerCorreosSolicitudes({ top = 25 } = {}) {
  const client = obtenerCliente();
  const res = await client
    .api(`/me/mailFolders/${GRAPH_CONFIG.mailFolder}/messages`)
    .select('id,subject,from,receivedDateTime,body,isRead')
    .filter('isRead eq false')
    .top(top)
    .orderby('receivedDateTime desc')
    .get();

  return res.value.map((msg) => ({
    id:           msg.id,
    asunto:       msg.subject || '(sin asunto)',
    de:           msg.from?.emailAddress?.address || '',
    nombreDe:     msg.from?.emailAddress?.name    || '',
    recibiEn:     new Date(msg.receivedDateTime),
    // textoPlano: listo para parseRequestText()
    textoPlano:   msg.body?.contentType === 'html'
                    ? htmlATexto(msg.body.content)
                    : (msg.body?.content || ''),
    leido:        msg.isRead,
  }));
}

// Envía una respuesta al correo con el resumen de aprobación en HTML.
// El cuerpoHtml puede generarse con construirTablaHtml() de buildCopySummary.js.
export async function responderCorreo(messageId, cuerpoHtml) {
  const client = obtenerCliente();
  await client.api(`/me/messages/${messageId}/reply`).post({
    message: {
      body: { contentType: 'HTML', content: cuerpoHtml },
    },
  });
}

// Reenvía un correo de tipo RENTAL al equipo de Rentas.
export async function reenviarARentas(messageId, correoRentas, comentario = '') {
  const client = obtenerCliente();
  await client.api(`/me/messages/${messageId}/forward`).post({
    toRecipients: [{ emailAddress: { address: correoRentas } }],
    comment:      comentario,
  });
}

// Crea y envía un correo nuevo (p. ej. respuesta a un correo sin messageId).
export async function enviarCorreo({ para, asunto, cuerpoHtml }) {
  const client = obtenerCliente();
  await client.api('/me/sendMail').post({
    message: {
      subject:      asunto,
      body:         { contentType: 'HTML', content: cuerpoHtml },
      toRecipients: [{ emailAddress: { address: para } }],
    },
  });
}

// Marca el correo como leído después de procesarlo.
export async function marcarLeido(messageId) {
  const client = obtenerCliente();
  await client.api(`/me/messages/${messageId}`).patch({ isRead: true });
}
