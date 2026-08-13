import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseInventoryArrayBuffer, combinarInventarios } from '../utils/parseInventoryFile.js';

// Replica la estructura real del "Reporte OH": columna "Item" duplicada
// (SheetJS la renombra a "Item_1"), varias filas por el mismo código de
// Item (distintos Locators) que hay que sumar, más una hoja "QC MEX" que
// NO debe contarse como disponible (según lo confirmado con el usuario).
function construirWorkbookDePrueba() {
  const datosOH = [
    ['Item', 'Item', 'Locator', 'Item Description', 'On-hand Qty'],
    [1000029486, 'CAP', 'WCO-STAGING---', 'CAP: FINE QUALITY', 1],
    [1000029486, 'CAP', 'WCO-122-0030-A-', 'CAP: FINE QUALITY', 5],
    [2000097477, 'SERVICE', 'WCO-DEFAULT---', 'SERVICE: RETURN.ALTERATION.', 300],
  ];
  const datosQC = [
    ['Item', 'Item', 'Locator', 'Item Description', 'On-hand Qty'],
    [2000097477, 'SERVICE', 'QC MEX-PE-JRM--', 'SERVICE: RETURN.ALTERATION.', 999],
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(datosOH), 'OH');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(datosQC), 'QC MEX');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return buffer;
}

describe('parseInventoryArrayBuffer con el formato real del Reporte OH', () => {
  const inventario = parseInventoryArrayBuffer(construirWorkbookDePrueba());

  it('usa la hoja "OH" en vez de otras hojas del archivo', () => {
    // Si hubiera tomado QC MEX, 2000097477 valdría 999 en vez de 300.
    expect(inventario.get('2000097477').disponible).toBe(300);
  });

  it('suma el disponible del mismo Item repetido en distintos Locators', () => {
    expect(inventario.get('1000029486').disponible).toBe(6);
  });

  it('no confunde la columna "Item" duplicada (Item_1) con la descripción', () => {
    const item = inventario.get('1000029486');
    expect(item.descripcion).toBe('CAP: FINE QUALITY');
  });
});

describe('combinarInventarios (varios archivos/días seleccionados a la vez)', () => {
  it('suma el disponible de un mismo Item entre varios archivos', () => {
    const dia1 = new Map([['1000029486', { itemCode: '1000029486', descripcion: 'CAP', disponible: 6, demanda: null }]]);
    const dia2 = new Map([['1000029486', { itemCode: '1000029486', descripcion: '', disponible: 4, demanda: null }]]);

    const combinado = combinarInventarios([dia1, dia2]);

    expect(combinado.get('1000029486').disponible).toBe(10);
  });

  it('conserva items que solo aparecen en uno de los archivos', () => {
    const dia1 = new Map([['A', { itemCode: 'A', descripcion: '', disponible: 1, demanda: null }]]);
    const dia2 = new Map([['B', { itemCode: 'B', descripcion: '', disponible: 2, demanda: null }]]);

    const combinado = combinarInventarios([dia1, dia2]);

    expect(combinado.get('A').disponible).toBe(1);
    expect(combinado.get('B').disponible).toBe(2);
  });

  it('suma demanda cuando está presente y conserva la descripción del primero que la tenga', () => {
    const dia1 = new Map([['A', { itemCode: 'A', descripcion: '', disponible: 1, demanda: 5 }]]);
    const dia2 = new Map([['A', { itemCode: 'A', descripcion: 'DESC REAL', disponible: 2, demanda: 3 }]]);

    const combinado = combinarInventarios([dia1, dia2]);

    expect(combinado.get('A').demanda).toBe(8);
    expect(combinado.get('A').descripcion).toBe('DESC REAL');
  });
});
