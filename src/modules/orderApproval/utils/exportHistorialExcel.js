import ExcelJS from 'exceljs';

const COLOR_HEADER     = 'FF2E75B6';
const COLOR_HEADER_TXT = 'FFFFFFFF';
const COLOR_POR_ESTADO = {
  Aprobado:         'FF2E7D32',
  Rechazado:        'FFC62828',
  Revisar:          'FF92400E',
  'Sin dato':       'FF475569',
  'N/A - Servicio': 'FF475569',
};

// Nombre seguro para una hoja de Excel (máx 31 chars, sin [ ] : * ? / \)
function nombreHoja(bo) {
  const limpio = bo.replace(/[[\]:*?/\\]/g, '-').slice(0, 28);
  return `BO# ${limpio}`;
}

function agregarHoja(workbook, bo, entradas) {
  const hoja = workbook.addWorksheet(nombreHoja(bo));

  // Título
  const titulo = bo === '(sin encabezado)'
    ? `Consulta rápida — ${new Date().toLocaleString('es-MX')}`
    : `BO# ${bo} — ${new Date().toLocaleString('es-MX')}`;
  hoja.addRow([titulo]);
  hoja.getRow(1).font = { bold: true, size: 13 };
  hoja.addRow([]);

  // Encabezados de columna
  const filaEnc = hoja.addRow([
    'Hora', 'BO#', 'Cliente', 'Rep', 'RDD',
    'Item', 'Descripción', 'Qty solicitada',
    'Disponible', '% consumo', 'Estado', 'Motivo',
  ]);
  filaEnc.eachCell((celda) => {
    celda.font      = { bold: true, color: { argb: COLOR_HEADER_TXT } };
    celda.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  entradas.forEach(({ hora, solicitud }) => {
    solicitud.items.forEach((item) => {
      const fila = hoja.addRow([
        hora,
        solicitud.bo,
        solicitud.cliente,
        solicitud.rep,
        solicitud.rddRaw,
        item.itemCode,
        item.descripcionInventario || item.descripcion,
        item.qty,
        item.disponible === null ? '' : item.disponible,
        item.porcentajeConsumo === null ? '' : item.porcentajeConsumo,
        item.estado,
        item.motivo,
      ]);
      fila.getCell(10).numFmt = '0.0%';
      const color = COLOR_POR_ESTADO[item.estado];
      if (color) fila.getCell(11).font = { color: { argb: color }, bold: true };
    });
  });

  hoja.columns = [
    { width: 10 }, { width: 14 }, { width: 26 }, { width: 18 }, { width: 12 },
    { width: 16 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 12 },
    { width: 14 }, { width: 40 },
  ];
}

export async function exportarHistorialExcel(historial) {
  const workbook = new ExcelJS.Workbook();

  // Agrupar entradas por BO# para crear una hoja por solicitud
  const porBo = new Map();
  for (const entrada of historial) {
    const bo = entrada.solicitud.bo;
    if (!porBo.has(bo)) porBo.set(bo, []);
    porBo.get(bo).push(entrada);
  }

  for (const [bo, entradas] of porBo) {
    agregarHoja(workbook, bo, entradas);
  }

  // Nombre del archivo: BO# si hay solo uno, fecha si hay varios o ninguno
  const boNums = [...porBo.keys()].filter((b) => b !== '(sin encabezado)');
  const hoy = new Date().toISOString().slice(0, 10);
  const nombreArchivo = boNums.length === 1
    ? `order-approval-BO${boNums[0]}-${hoy}.xlsx`
    : boNums.length > 1
    ? `order-approval-${hoy}-${boNums.length}BOs.xlsx`
    : `order-approval-consulta-${hoy}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url    = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href  = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
