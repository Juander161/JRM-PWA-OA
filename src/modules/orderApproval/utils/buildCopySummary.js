// ── Resumen en texto plano ────────────────────────────────────────────────────
// Texto corto para pegar en Oracle / notas internas.
export function construirResumenCopiable(solicitud) {
  const total = solicitud.items.length;
  const conteos = {};
  solicitud.items.forEach((item) => {
    conteos[item.estado] = (conteos[item.estado] || 0) + 1;
  });

  let estadoGeneral;
  if (conteos.Rechazado) estadoGeneral = 'Rechazado';
  else if (conteos.Revisar) estadoGeneral = 'Revisar manualmente';
  else if (conteos['Sin dato'] && !conteos.Aprobado) estadoGeneral = 'Sin dato';
  else estadoGeneral = 'Aprobado';

  const partes = [];
  if (conteos.Aprobado) partes.push(`${conteos.Aprobado} aprobado(s)`);
  if (conteos['N/A - Servicio']) partes.push(`${conteos['N/A - Servicio']} N/A (servicio)`);
  if (conteos.Rechazado) partes.push(`${conteos.Rechazado} rechazado(s)`);
  if (conteos.Revisar) partes.push(`${conteos.Revisar} a revisar`);
  if (conteos['Sin dato']) partes.push(`${conteos['Sin dato']} sin dato de inventario`);

  const encabezado = solicitud.sinEncabezado
    ? 'Consulta rápida (sin BO#)'
    : `BO# ${solicitud.bo} (${solicitud.cliente})`;
  let texto = `${encabezado} — ${estadoGeneral}. ${total} item(s): ${partes.join(', ')}.`;

  const conMotivo = solicitud.items.filter((item) => item.estado !== 'Aprobado' && item.motivo);
  if (conMotivo.length) {
    const detalle = conMotivo.map((item) => `${item.itemCode} [${item.estado}]: ${item.motivo}`).join(' | ');
    texto += ` Detalle: ${detalle}`;
  }

  return texto;
}

// ── Tabla HTML (para pegar en Outlook / Gmail) ────────────────────────────────
// Genera una tabla con estilos inline para que se vea bien al pegarla en
// un correo. Incluye encabezado de solicitud y todos los renglones de items.
const COLOR_ESTADO = {
  Aprobado:       '#2E7D32',
  Rechazado:      '#C62828',
  Revisar:        '#92400E',
  'Sin dato':     '#475569',
  'N/A - Servicio': '#475569',
};

export function construirTablaHtml(solicitud) {
  const th = 'background:#2E75B6;color:#fff;padding:6px 10px;border:1px solid #bcd;text-align:left;font-size:11px;white-space:nowrap;';
  const td = 'padding:5px 10px;border:1px solid #dde;font-size:11px;vertical-align:top;';

  const encabezado = solicitud.sinEncabezado
    ? 'Consulta rápida'
    : `BO# ${solicitud.bo} — ${solicitud.cliente}`;

  const metaHtml = solicitud.sinEncabezado ? '' : `
    <p style="font-size:11px;color:#555;margin:4px 0 10px;">
      RDD: ${solicitud.rddRaw} &nbsp;·&nbsp; Rep: ${solicitud.rep}
      ${solicitud.eventDate && solicitud.eventDate !== 'N/A' ? `&nbsp;·&nbsp; Evento: ${solicitud.eventDate}` : ''}
    </p>`;

  const filas = solicitud.items.map((item) => {
    const desc = item.descripcionInventario || item.descripcion || '—';
    const pct  = item.porcentajeConsumo !== null ? `${(item.porcentajeConsumo * 100).toFixed(1)}%` : '—';
    const disp = item.disponible !== null ? item.disponible.toLocaleString('es-MX') : '—';
    const color = COLOR_ESTADO[item.estado] || '#333';
    return `<tr>
      <td style="${td}">${item.itemCode}</td>
      <td style="${td}">${desc}</td>
      <td style="${td};text-align:center;">${item.qty}${item.duplicados > 1 ? ` (x${item.duplicados})` : ''}</td>
      <td style="${td};text-align:center;">${disp}</td>
      <td style="${td};text-align:center;">${pct}</td>
      <td style="${td};color:${color};font-weight:bold;">${item.estado}</td>
      <td style="${td};color:#666;font-size:10px;">${item.motivo || ''}</td>
    </tr>`;
  }).join('');

  return `<div style="font-family:Arial,sans-serif;">
    <strong style="font-size:13px;">${encabezado}</strong>
    ${metaHtml}
    <table style="border-collapse:collapse;width:100%;">
      <thead><tr>
        <th style="${th}">Item</th>
        <th style="${th}">Descripción</th>
        <th style="${th}">Qty</th>
        <th style="${th}">Disponible</th>
        <th style="${th}">% Consumo</th>
        <th style="${th}">Estado</th>
        <th style="${th}">Motivo</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;
}

// ── Texto tabulado (fallback de la tabla HTML para portapapeles) ──────────────
export function construirTablaTexto(solicitud) {
  const encabezado = solicitud.sinEncabezado
    ? 'Consulta rápida'
    : `BO# ${solicitud.bo} (${solicitud.cliente})`;
  const sep = '\t';
  const cols = ['Item', 'Descripción', 'Qty', 'Disponible', '% Consumo', 'Estado', 'Motivo'];
  const filas = solicitud.items.map((item) => [
    item.itemCode,
    item.descripcionInventario || item.descripcion || '',
    item.qty,
    item.disponible !== null ? item.disponible : '',
    item.porcentajeConsumo !== null ? `${(item.porcentajeConsumo * 100).toFixed(1)}%` : '',
    item.estado,
    item.motivo || '',
  ].join(sep));
  return `${encabezado}\n${cols.join(sep)}\n${filas.join('\n')}`;
}
