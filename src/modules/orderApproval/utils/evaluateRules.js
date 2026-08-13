// Reglas de negocio de Order Approval (ver documento "Order Approval —
// Estructura y Reglas"):
//
// 3.1 Regla de RDD: si la fecha RDD está a menos de N días (por defecto 3)
//     de la fecha actual, la solicitud se marca para rechazo automático.
//     Si el RDD no se pudo interpretar del texto pegado, NO se asume nada:
//     se marca "Revisar" para que alguien lo confirme a mano, en vez de
//     dejar pasar silenciosamente un caso que debería rechazarse.
// 3.2 Regla de comparación de inventario: % = cantidad solicitada / cantidad
//     disponible. Si el % es menor al umbral configurado -> Aprobado, si lo
//     supera -> Rechazado. El umbral es configurable (por defecto 30%).
//     Los casos que caen justo debajo del umbral (dentro del margen "ámbar"
//     configurable) se marcan "Revisar" en vez de Aprobado automático, para
//     que no pasen desapercibidos casos límite.
//
// ⚠ Pendiente de confirmar: si el margen de días RDD depende del destino, y
// si el umbral debe considerar también la demanda/consumo reciente (10%
// mencionado en el proceso manual) en vez de (o además de) el disponible
// total. Mientras se confirma, ambas quedan como parámetros configurables
// y el % sobre demanda se muestra solo como dato informativo adicional.

const MS_POR_DIA = 1000 * 60 * 60 * 24;

// Items de servicio/fulfilment (ej: "SERVICE: FULFILLMENT...", "FREIGHT:",
// "HANDLING:") no aparecen en el Excel OH porque no son material físico;
// en Oracle pueden tener cantidades negativas. Se marcan "N/A - Servicio"
// para distinguirlos de "Sin dato" (items físicos no encontrados) y que
// quede claro que se aprueban por criterio de negocio, no por inventario.
const SERVICIO_RE = /^(SERVICE|FREIGHT|HANDLING|SETUP|MISCELLANEOUS|PACKAGING|PRODUCT\s+PACKAGE)\s*[:\-]/i;
function esItemServicio(descripcion) {
  return SERVICIO_RE.test(String(descripcion || '').trim());
}

export function diasHastaRdd(rddDate, hoy = new Date()) {
  if (!rddDate) return null;
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((rddDate.getTime() - hoyUTC) / MS_POR_DIA);
}

export function evaluarItem(
  item,
  inventario,
  {
    umbralPorcentaje, margenDiasRdd, margenAmbarPorcentaje = 0, rdd, rddRaw, ahora,
    cantidadMaxima = 0, cantidadMinima = 0, codigosExcluidos = [],
  }
) {
  const codigoNorm = item.itemCode.toUpperCase();
  const dias = diasHastaRdd(rdd, ahora);
  const rddNoLegible = rdd === null;
  const rddEnRiesgo = dias !== null && dias < margenDiasRdd;

  const infoInventario = inventario.get(codigoNorm);
  const disponible = infoInventario ? infoInventario.disponible : null;
  const demanda = infoInventario ? infoInventario.demanda : null;

  let porcentajeConsumo = null;
  let porcentajeSobreDemanda = null;
  let estado;
  let motivo = '';

  if (codigosExcluidos.length && codigosExcluidos.includes(codigoNorm)) {
    estado = 'Rechazado';
    motivo = 'Item en lista de exclusión de reglas';
  } else if (cantidadMaxima > 0 && item.qty > cantidadMaxima) {
    estado = 'Rechazado';
    motivo = `Cantidad solicitada (${item.qty}) supera el máximo configurado (${cantidadMaxima})`;
  } else if (cantidadMinima > 0 && item.qty < cantidadMinima) {
    estado = 'Rechazado';
    motivo = `Cantidad solicitada (${item.qty}) está por debajo del mínimo configurado (${cantidadMinima})`;
  } else if (rddNoLegible) {
    estado = 'Revisar';
    motivo = `No se pudo interpretar la fecha RDD ("${rddRaw}"); confirma manualmente el margen de días antes de aprobar.`;
  } else if (rddEnRiesgo) {
    estado = 'Rechazado';
    motivo = `RDD a ${dias} día(s) (mínimo requerido: ${margenDiasRdd})`;
  } else if (disponible === null) {
    if (esItemServicio(item.descripcion)) {
      estado = 'N/A - Servicio';
      motivo = 'Item de servicio, paquete o fulfilment — no tiene entrada en el inventario OH; aprobar según criterio de negocio.';
    } else {
      estado = 'Sin dato';
      motivo = 'Item no encontrado en el Excel de disponibilidad';
    }
  } else if (disponible < 0) {
    // Un disponible negativo NUNCA es material que se pueda surtir. Se atrapa
    // antes del cálculo de porcentaje porque ahí daría un valor negativo, que
    // por ser menor al umbral pasaría como "Aprobado" — justo al revés.
    if (esItemServicio(item.descripcion)) {
      estado = 'N/A - Servicio';
      motivo = `Disponible negativo (${disponible}) — esperado en items de servicio o paquete, que no son material físico; aprobar según criterio de negocio.`;
    } else {
      estado = 'Rechazado';
      motivo = `Disponible negativo (${disponible}) en el reporte OH: no hay material y el dato indica un error de inventario que conviene reportar.`;
    }
  } else if (disponible === 0) {
    estado = 'Rechazado';
    motivo = 'Cantidad disponible es 0';
  } else {
    porcentajeConsumo = item.qty / disponible;
    if (demanda) porcentajeSobreDemanda = item.qty / demanda;
    const umbralAmbar = umbralPorcentaje - margenAmbarPorcentaje;

    if (porcentajeConsumo >= umbralPorcentaje) {
      estado = 'Rechazado';
      motivo = `Consumo ${(porcentajeConsumo * 100).toFixed(1)}% supera el umbral (${(umbralPorcentaje * 100).toFixed(0)}%)`;
    } else if (margenAmbarPorcentaje > 0 && porcentajeConsumo >= umbralAmbar) {
      estado = 'Revisar';
      motivo = `Consumo ${(porcentajeConsumo * 100).toFixed(1)}% está cerca del umbral (${(umbralPorcentaje * 100).toFixed(0)}%); revisar manualmente antes de aprobar.`;
    } else {
      estado = 'Aprobado';
    }
  }

  return {
    ...item,
    descripcionInventario: infoInventario?.descripcion || '',
    disponible,
    demanda,
    porcentajeConsumo,
    porcentajeSobreDemanda,
    estado,
    motivo,
    diasHastaRdd: dias,
  };
}

export function evaluarSolicitud(solicitud, inventario, opciones) {
  const items = solicitud.items.map((item) =>
    evaluarItem(item, inventario, { ...opciones, rdd: solicitud.rdd, rddRaw: solicitud.rddRaw })
  );
  return { ...solicitud, items };
}

export function evaluarSolicitudes(solicitudes, inventario, opciones) {
  return solicitudes.map((solicitud) => evaluarSolicitud(solicitud, inventario, opciones));
}
