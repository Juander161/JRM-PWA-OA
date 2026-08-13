// Contrato de intercambio con Power Automate.
//
// El flujo lee el correo del buzón compartido, saca el encabezado del ASUNTO
// y los items del CUERPO, y deja un .json en la carpeta sincronizada de
// OneDrive que esta app vigila.
//
// Formato esperado:
//
//   {
//     "bo": "95730751",
//     "rdd": "12-AUG-26",
//     "eventDate": "N/A",
//     "cliente": "JOSTENS COLLEGE PREPAID C&G",
//     "rep": "FLANAGAN GREG",
//     "de": "alguien@jostens.com",
//     "asunto": "PRDF: RDD 12-AUG-26, ...",
//     "recibidoEn": "2026-08-11T09:14:00Z",
//     "items": [
//       { "codigo": "1012010779", "qty": 1, "descripcion": "PRODUCT PACKAGE: ..." }
//     ]
//   }
//
// La comparación contra inventario NO la hace el flujo: la hace esta app.
// Así las reglas viven en un solo lugar y cambiar un umbral sigue siendo
// cuestión de minutos en vez de editar acciones en Power Automate.

/**
 * Reconstruye el texto en el formato del correo original a partir del JSON
 * del flujo. Devolver texto —en vez de solicitudes ya armadas— permite
 * reutilizar tal cual parseRequestText() y todo lo que viene después, sin
 * una segunda ruta de código que mantener en paralelo.
 */
export function convertirFlowJsonATexto(datos) {
  const lineas = [];

  if (datos.bo) {
    lineas.push(
      `PRDF: RDD ${datos.rdd || ''}, Event Date ${datos.eventDate || 'N/A'}, ` +
      `${datos.cliente || ''}, Rep ${datos.rep || ''}, BO# ${datos.bo}`
    );
  }

  for (const item of datos.items || []) {
    const codigo = item.codigo ?? item.itemCode ?? '';
    const qty    = item.qty ?? item.cantidad ?? 0;
    const desc   = String(item.descripcion ?? item.description ?? '')
      .replace(/[\r\n]+/g, ' ')
      .trim();
    lineas.push(`Item [${codigo}]    Qty [${qty}]    Description [${desc}]`);
  }

  return lineas.join('\n');
}

/** Lee el archivo .json del flujo y lo deja en la forma que espera el watcher. */
export function parseFlowJson(contenido) {
  const datos = JSON.parse(contenido);
  return {
    de:     datos.de     || '',
    asunto: datos.asunto || '',
    fecha:  datos.recibidoEn || datos.fecha || '',
    texto:  convertirFlowJsonATexto(datos),
  };
}
