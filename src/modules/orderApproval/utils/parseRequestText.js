// Parsea el texto tal como se pega desde el correo de Order Approval.
// Formato observado (correos auto-generados con formato estructurado):
//
//   PRDF: RDD 24-JUL-26, Event Date N/A, SLADE JAN, Rep SLADE JAN, BO# 95637276
//   Item [2000097477]    Qty [1]    Description [SERVICE: RETURN.ALTERATION.]
//   Item [1012010779]    Qty [13]   Description [PRODUCT PACKAGE: ...]
//
// Un mismo bloque de texto puede traer varias solicitudes (varios BO#) una
// tras otra; cada una se separa por su propia línea "PRDF: ...".
//
// Los correos con preguntas específicas (fuera de este formato con BO#)
// quedan fuera de esta primera fase, tal como se definió en el documento de
// reglas de negocio: no se intentan interpretar aquí.
//
// ⚠ El formato puede variar entre reps (espacios, mayúsculas/minúsculas,
// orden de campos). Las expresiones regulares de abajo ya toleran espacios
// extra y mayúsculas/minúsculas, pero cualquier línea que no encaje se
// reporta en `lineasNoReconocidas` (global) o `solicitud.lineasNoReconocidas`
// en vez de fallar en silencio, para poder ajustarlas con correos reales.

// ── Limpieza de cadenas / hilos de correo ───────────────────────────────────
// Elimina el "ruido" que aparece cuando el usuario pega texto de una cadena
// de correo respondida o reenviada (Outlook, Gmail, etc.) para que el parser
// solo vea las líneas PRDF e Item relevantes.
//
// Patrones descartados:
//   - Líneas con prefijo de cita  "> texto" o ">> texto"
//   - Cabeceras de correo:  From:/De: · Sent:/Enviado: · To:/Para: · Cc:
//                           Subject:/Asunto: · Date:/Fecha:
//   - Separadores de hilo:  ----- · _____ · =====  (≥5 caracteres)
//   - Línea introductoria de cita: "On [fecha] … wrote:" / "El … escribió:"
const PATRON_DESCARTAR = [
  /^>+/,                             // cita > ó > >
  /^-{5,}/,                          // -----Original Message-----
  /^_{5,}/,                          // ________________________
  /^={5,}/,                          // =========================
  /^From:\s/i,
  /^De:\s/i,
  /^Sent:\s/i,
  /^Enviado:\s/i,
  /^To:\s/i,
  /^Para:\s/i,
  /^Cc:\s/i,
  /^Subject:\s/i,
  /^Asunto:\s/i,
  /^Date:\s/i,
  /^Fecha:\s/i,
];
// "On Mon, Jul 28, 2025 at 10:00 AM Someone <…> wrote:"
// "El lun, 28 jul 2025 a las 10:00, Alguien <…> escribió:"
const PATRON_WROTE = /^(On|El)\s.+\s(wrote|escribió)\s*:$/i;

function limpiarTextoCorreo(texto) {
  return texto
    .split(/\r?\n/)
    .filter((linea) => {
      const t = linea.trim();
      if (!t) return true; // preservar blancos (el split posterior los filtra)
      if (PATRON_DESCARTAR.some((re) => re.test(t))) return false;
      if (PATRON_WROTE.test(t)) return false;
      return true;
    })
    .join('\n');
}

// Un renglón de artículo puede venir partido en dos líneas cuando la
// descripción es larga y el cliente de correo la envolvió:
//
//   Item [2000175922]    Qty [250]    Description [CORD:
//   STANDARD.INTERTWINED-DOUBLE.AMERICANA-RED/ROYAL BLUE/WHITE.]
//
// Buscando línea por línea, ninguna de las dos encaja con ITEM_REGEX y el
// artículo se pierde: no se evalúa contra inventario y solo aparece como
// "línea no reconocida". Por eso, antes de parsear, se vuelven a unir las
// líneas cuya descripción quedó abierta (sin su "]" de cierre).
function unirLineasDeItem(lineas) {
  const unidas = [];

  for (let i = 0; i < lineas.length; i++) {
    let linea = lineas[i];
    const inicioDesc = linea.search(/Description\s*\[/i);

    if (inicioDesc !== -1) {
      while (!linea.slice(inicioDesc).includes(']') && i + 1 < lineas.length) {
        i++;
        linea += ' ' + lineas[i].trim();
      }
    }

    unidas.push(linea);
  }

  return unidas;
}

const MESES = {
  ENE: 0, JAN: 0,
  FEB: 1,
  MAR: 2,
  ABR: 3, APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AGO: 7, AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DIC: 11, DEC: 11,
};

const HEADER_REGEX =
  /PRDF:\s*RDD\s*([^,]+),\s*Event Date\s*([^,]+),\s*(.+?),\s*Rep\s+(.+?),\s*BO#\s*(\S+)/i;

// Para detectar líneas que "parecen" encabezado (empiezan con PRDF) pero no
// encajaron del todo con HEADER_REGEX, y así avisar en vez de perderlas.
const PARECE_HEADER_REGEX = /^PRDF\s*:/i;

const ITEM_REGEX = /Item\s*\[([^\]]*)\]\s*Qty\s*\[([^\]]*)\]\s*Description\s*\[([^\]]*)\]/i;

export function parseRddDate(rddRaw) {
  const match = String(rddRaw).trim().match(/^(\d{1,2})-([A-Za-zÁ-Úá-ú]{3})-(\d{2,4})$/);
  if (!match) return null;
  const [, diaStr, mesStr, anioStr] = match;
  const mes = MESES[mesStr.toUpperCase()];
  if (mes === undefined) return null;
  const dia = Number(diaStr);
  let anio = Number(anioStr);
  if (anio < 100) anio += 2000;
  return new Date(Date.UTC(anio, mes, dia));
}

// Combina líneas de artículo con el mismo código de Item dentro de la misma
// solicitud, sumando la cantidad en vez de dejarlas como renglones separados
// (pasa seguido: el mismo Item aparece dos veces en un mismo correo pegado).
function combinarItemsDuplicados(items) {
  const porCodigo = new Map();
  for (const item of items) {
    const clave = item.itemCode.toUpperCase();
    const existente = porCodigo.get(clave);
    if (existente) {
      existente.qty += item.qty;
      existente.duplicados += 1;
    } else {
      porCodigo.set(clave, { ...item, duplicados: 1 });
    }
  }
  return [...porCodigo.values()];
}

// Divide el texto pegado en líneas y va agrupando cada encabezado "PRDF: ..."
// con los renglones de artículo que le siguen, hasta el próximo encabezado.
//
// También soporta pegar solo líneas de artículo SIN encabezado PRDF: en ese
// caso todos los items se agrupan en una solicitud sintética con
// sinEncabezado:true. La validación de RDD se omite automáticamente porque
// rdd queda como `undefined` (distinto de `null` que es "fecha ilegible").
export function parseRequestText(texto) {
  if (!texto || !texto.trim()) {
    return { solicitudes: [], lineasNoReconocidas: [] };
  }

  const lineas = unirLineasDeItem(limpiarTextoCorreo(texto).split(/\r?\n/));
  const solicitudesCrudas = [];
  const lineasNoReconocidas = [];
  const itemsHuerfanos = []; // items antes del primer encabezado PRDF
  let actual = null;

  for (const lineaOriginal of lineas) {
    const linea = lineaOriginal.trim();
    if (!linea) continue;

    const headerMatch = linea.match(HEADER_REGEX);
    if (headerMatch) {
      const [, rddRaw, eventDate, cliente, rep, bo] = headerMatch;
      actual = {
        bo: bo.trim(),
        rddRaw: rddRaw.trim(),
        rdd: parseRddDate(rddRaw),
        eventDate: eventDate.trim(),
        cliente: cliente.trim(),
        rep: rep.trim(),
        items: [],
        lineasNoReconocidas: [],
      };
      solicitudesCrudas.push(actual);
      continue;
    }

    if (PARECE_HEADER_REGEX.test(linea)) {
      // Empieza como un encabezado PRDF pero no completó el patrón esperado.
      lineasNoReconocidas.push(linea);
      actual = null;
      continue;
    }

    const itemMatch = linea.match(ITEM_REGEX);
    if (itemMatch) {
      const [, itemCode, qty, descripcion] = itemMatch;
      const item = {
        itemCode: itemCode.trim(),
        qty: Number(qty.trim()) || 0,
        descripcion: descripcion.trim(),
      };
      if (actual) {
        actual.items.push(item);
      } else {
        // Item sin encabezado PRDF precedente — se acumula aparte.
        itemsHuerfanos.push(item);
      }
    } else if (actual) {
      // Línea dentro de un bloque de solicitud que no es un encabezado ni
      // un renglón de artículo reconocible: se reporta en vez de ignorarla.
      actual.lineasNoReconocidas.push(linea);
    } else {
      lineasNoReconocidas.push(linea);
    }
  }

  // Solicitud sintética para items pegados sin encabezado PRDF.
  // rdd: undefined (no null) → evaluarItem omite la validación de RDD.
  const huerfanosCombinados = combinarItemsDuplicados(itemsHuerfanos);
  const solicitudHuerfana = huerfanosCombinados.length > 0
    ? [{
        bo: '(sin encabezado)',
        rddRaw: '',
        rdd: undefined,
        eventDate: '',
        cliente: '',
        rep: '',
        items: huerfanosCombinados,
        lineasNoReconocidas: [],
        sinEncabezado: true,
      }]
    : [];

  const solicitudes = [
    ...solicitudHuerfana,
    ...solicitudesCrudas.map((s) => ({
      ...s,
      items: combinarItemsDuplicados(s.items),
    })),
  ];

  return { solicitudes, lineasNoReconocidas };
}
