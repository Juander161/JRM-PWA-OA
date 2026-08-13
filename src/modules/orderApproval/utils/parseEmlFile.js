// Parser ligero de archivos .eml (RFC 2822 / MIME).
// Extrae el cuerpo de texto listo para pasarlo al parseador de solicitudes.
// Cubre los casos más comunes en correos de Outlook/Gmail:
//   - Cuerpo simple text/plain
//   - multipart/alternative (prefiere text/plain sobre text/html)
//   - multipart/mixed (busca la parte de texto)
//   - Codificaciones quoted-printable y base64
//   - Cabeceras codificadas =?UTF-8?B?...?= y =?UTF-8?Q?...?=

import { parseFlowJson } from './flowJson.js';

// ── Decoders ─────────────────────────────────────────────────────────────────

function decoQP(str) {
  return str
    .replace(/=[ \t]*\r?\n/g, '')          // soft line break
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function decoCuerpo(cuerpo, encoding) {
  const enc = (encoding || '').toLowerCase().trim();
  if (enc === 'base64') {
    try {
      const bytes = Uint8Array.from(atob(cuerpo.replace(/\s/g, '')), (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch { return cuerpo; }
  }
  if (enc === 'quoted-printable') return decoQP(cuerpo);
  return cuerpo;
}

// Decodifica cabeceras RFC 2047: =?charset?B|Q?encoded?=
function decoHeader(valor) {
  return String(valor || '').replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_, charset, enc, encoded) => {
      try {
        if (enc.toUpperCase() === 'B') {
          const bytes = Uint8Array.from(atob(encoded.replace(/\s/g, '')), (c) => c.charCodeAt(0));
          return new TextDecoder(charset, { fatal: false }).decode(bytes);
        }
        if (enc.toUpperCase() === 'Q') return decoQP(encoded.replace(/_/g, ' '));
      } catch { /* silencioso */ }
      return encoded;
    }
  );
}

function htmlATexto(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body?.innerText ?? doc.body?.textContent ?? '';
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

// ── Parser MIME ───────────────────────────────────────────────────────────────

// Separa las cabeceras del cuerpo de una parte MIME.
function separarHeadersCuerpo(raw) {
  const lineas = raw.split(/\r?\n/);
  const headers = {};
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];
    if (linea === '') { i++; break; }

    // Unfold: las líneas de continuación empiezan con espacio/tab
    let valor = linea;
    while (i + 1 < lineas.length && /^[ \t]/.test(lineas[i + 1])) {
      i++;
      valor += ' ' + lineas[i].trim();
    }

    const c = valor.indexOf(':');
    if (c > 0) {
      headers[valor.slice(0, c).toLowerCase().trim()] = valor.slice(c + 1).trim();
    }
    i++;
  }

  const cuerpo = lineas.slice(i).join('\n');
  return { headers, cuerpo };
}

// Extrae el boundary de un Content-Type multipart
function extraerBoundary(ct) {
  const m = ct.match(/boundary=["']?([^"';\r\n]+?)["']?\s*(?:;|$)/i);
  return m ? m[1].trim() : null;
}

// Divide el cuerpo de un multipart en sus partes individuales
function dividirMultipart(cuerpo, boundary) {
  const delim = '--' + boundary;
  const partes = [];
  const lineas = cuerpo.split(/\r?\n/);
  let actual = [];
  let dentro = false;

  for (const linea of lineas) {
    if (linea.startsWith(delim + '--')) {
      if (dentro && actual.length) partes.push(actual.join('\n'));
      break;
    } else if (linea.startsWith(delim)) {
      if (dentro && actual.length) partes.push(actual.join('\n'));
      actual = [];
      dentro = true;
    } else if (dentro) {
      actual.push(linea);
    }
  }
  // Si no había delimitador final
  if (dentro && actual.length) partes.push(actual.join('\n'));

  return partes;
}

// Extrae el texto más apropiado de una parte MIME (recursivo para multipart)
function extraerTextoDeParte(raw) {
  const { headers, cuerpo } = separarHeadersCuerpo(raw);
  const ct  = headers['content-type'] || 'text/plain';
  const enc = headers['content-transfer-encoding'];

  if (ct.toLowerCase().startsWith('multipart/')) {
    const boundary = extraerBoundary(ct);
    if (!boundary) return '';

    const partes = dividirMultipart(cuerpo, boundary);
    let textPlain = null;
    let textHtml  = null;

    for (const parte of partes) {
      const { headers: ph } = separarHeadersCuerpo(parte);
      const pct = (ph['content-type'] || 'text/plain').toLowerCase();

      if (pct.startsWith('multipart/')) {
        const anidado = extraerTextoDeParte(parte);
        if (anidado && textPlain === null) textPlain = anidado;
      } else if (pct.startsWith('text/plain') && textPlain === null) {
        textPlain = extraerTextoDeParte(parte);
      } else if (pct.startsWith('text/html') && textHtml === null) {
        textHtml = extraerTextoDeParte(parte);
      }
    }

    return textPlain ?? textHtml ?? '';
  }

  // Parte hoja: decodificar y devolver
  const decodificado = decoCuerpo(cuerpo, enc);
  if (ct.toLowerCase().startsWith('text/html')) return htmlATexto(decodificado);
  return decodificado;
}

// ── Exportación principal ─────────────────────────────────────────────────────

/**
 * Parsea el contenido de texto de un archivo .eml.
 * Devuelve { de, asunto, fecha, texto } donde `texto` es el cuerpo
 * en texto plano listo para parseRequestText().
 */
export function parseEmlFile(contenido) {
  const normalizado = contenido.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const { headers } = separarHeadersCuerpo(normalizado);

  return {
    de:     decoHeader(headers['from']    || ''),
    asunto: decoHeader(headers['subject'] || ''),
    fecha:  headers['date'] || '',
    texto:  extraerTextoDeParte(normalizado),
  };
}

/**
 * Parsea el .txt que exporta la macro de Outlook. Formato:
 *
 *   From: Nombre <correo@dominio>
 *   Subject: …
 *   Date: dd/mm/yyyy hh:mm
 *   (línea en blanco)
 *   <cuerpo del correo tal cual>
 *
 * Si el archivo NO empieza con una de esas tres cabeceras se toma completo
 * como cuerpo — así un .txt pegado a mano (que suele arrancar directo con
 * "PRDF:") no pierde su primera línea al confundirla con una cabecera.
 */
export function parseTextoExportado(contenido) {
  const normalizado = contenido.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!/^(From|Subject|Date):/i.test(normalizado)) {
    return { de: '', asunto: '', fecha: '', texto: normalizado };
  }

  const { headers, cuerpo } = separarHeadersCuerpo(normalizado);
  return {
    de:     headers['from']    || '',
    asunto: headers['subject'] || '',
    fecha:  headers['date']    || '',
    texto:  cuerpo,
  };
}

/** Elige el parser según la extensión del archivo. */
export function parseArchivoCorreo(nombre, contenido) {
  const n = nombre.toLowerCase();
  if (n.endsWith('.json')) return parseFlowJson(contenido);
  if (n.endsWith('.txt'))  return parseTextoExportado(contenido);
  return parseEmlFile(contenido);
}
