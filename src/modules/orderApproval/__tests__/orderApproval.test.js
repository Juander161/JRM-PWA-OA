import { describe, it, expect } from 'vitest';
import { parseRequestText, parseRddDate } from '../utils/parseRequestText.js';
import { evaluarSolicitudes } from '../utils/evaluateRules.js';

const TEXTO_EJEMPLO = `
PRDF: RDD 24-JUL-26, Event Date N/A, SLADE JAN, Rep SLADE JAN, BO# 95637276
Item [2000097477]    Qty [1]    Description [SERVICE: RETURN.ALTERATION.]
PRDF: RDD 31-JUL-26, Event Date N/A, JOSTENS COLLEGE PREPAID C&G, Rep FLANAGAN GREG, BO# 95628302
Item [2000097477]    Qty [5]    Description [SERVICE: RETURN.ALTERATION.]
Item [9999999999]    Qty [2]    Description [ITEM SIN INVENTARIO]
`;

describe('parseRddDate', () => {
  it('interpreta día-mes-año de 2 dígitos', () => {
    const fecha = parseRddDate('24-JUL-26');
    expect(fecha.getUTCFullYear()).toBe(2026);
    expect(fecha.getUTCMonth()).toBe(6); // julio = índice 6
    expect(fecha.getUTCDate()).toBe(24);
  });

  it('devuelve null si el texto no encaja con el formato esperado', () => {
    expect(parseRddDate('TBD')).toBeNull();
  });
});

describe('parseRequestText', () => {
  it('agrupa cada encabezado PRDF con sus artículos', () => {
    const { solicitudes } = parseRequestText(TEXTO_EJEMPLO);
    expect(solicitudes).toHaveLength(2);
    expect(solicitudes[0].bo).toBe('95637276');
    expect(solicitudes[0].cliente).toBe('SLADE JAN');
    expect(solicitudes[0].items).toHaveLength(1);
    expect(solicitudes[1].bo).toBe('95628302');
    expect(solicitudes[1].items).toHaveLength(2);
    expect(solicitudes[1].items[0].qty).toBe(5);
  });

  it('combina items duplicados (mismo código) sumando la cantidad', () => {
    const texto = `
PRDF: RDD 31-JUL-26, Event Date N/A, JOSTENS COLLEGE, Rep FLANAGAN GREG, BO# 1
Item [2001037306]    Qty [1]    Description [GOWN CUSTOM MASTER]
Item [2001037306]    Qty [1]    Description [GOWN CUSTOM MASTER]
Item [2001037305]    Qty [3]    Description [GOWN CUSTOM GRADUATE]
`;
    const { solicitudes } = parseRequestText(texto);
    expect(solicitudes[0].items).toHaveLength(2);
    const combinado = solicitudes[0].items.find((i) => i.itemCode === '2001037306');
    expect(combinado.qty).toBe(2);
    expect(combinado.duplicados).toBe(2);
  });

  it('reporta líneas que no encajan como encabezado o artículo', () => {
    const texto = `
PRDF: formato raro sin los campos esperados
PRDF: RDD 31-JUL-26, Event Date N/A, CLIENTE, Rep REP, BO# 2
Item [123]    Qty [1]    Description [ALGO]
Nota suelta que no es un renglón de artículo
`;
    const { solicitudes, lineasNoReconocidas } = parseRequestText(texto);
    expect(lineasNoReconocidas).toHaveLength(1);
    expect(lineasNoReconocidas[0]).toMatch(/formato raro/);
    expect(solicitudes[0].lineasNoReconocidas).toHaveLength(1);
    expect(solicitudes[0].lineasNoReconocidas[0]).toMatch(/Nota suelta/);
  });
});

describe('evaluarSolicitudes', () => {
  const inventario = new Map([
    ['2000097477', { itemCode: '2000097477', descripcion: 'Alteración', disponible: 100, demanda: 50 }],
  ]);
  const ahora = new Date(2026, 6, 28); // 28-jul-2026, coincide con la fecha del contexto de la tarea

  it('rechaza automáticamente cuando el RDD está a menos del margen de días', () => {
    const { solicitudes } = parseRequestText(TEXTO_EJEMPLO);
    const [conRddVencido] = evaluarSolicitudes([solicitudes[0]], inventario, {
      umbralPorcentaje: 0.3,
      margenDiasRdd: 3,
      ahora,
    });
    expect(conRddVencido.items[0].estado).toBe('Rechazado');
    expect(conRddVencido.items[0].motivo).toMatch(/RDD/);
  });

  it('aprueba cuando el consumo está por debajo del umbral y el RDD tiene margen suficiente', () => {
    const { solicitudes } = parseRequestText(TEXTO_EJEMPLO);
    const [evaluada] = evaluarSolicitudes([solicitudes[1]], inventario, {
      umbralPorcentaje: 0.3,
      margenDiasRdd: 3,
      ahora,
    });
    // 5 / 100 = 5% < 30% => Aprobado
    expect(evaluada.items[0].estado).toBe('Aprobado');
    // item sin inventario => Sin dato
    expect(evaluada.items[1].estado).toBe('Sin dato');
  });

  it('marca "Revisar" cuando el consumo cae dentro de la zona ámbar bajo el umbral', () => {
    const { solicitudes } = parseRequestText(TEXTO_EJEMPLO);
    // item con qty=5 sobre disponible=100 => 5% ... probamos con un umbral bajo (6%)
    // y zona ámbar de 2 puntos: banda ámbar = [4%, 6%). 5% cae dentro.
    const [evaluada] = evaluarSolicitudes([solicitudes[1]], inventario, {
      umbralPorcentaje: 0.06,
      margenDiasRdd: 3,
      margenAmbarPorcentaje: 0.02,
      ahora,
    });
    expect(evaluada.items[0].estado).toBe('Revisar');
  });

  it('marca "Revisar" cuando el RDD no se pudo interpretar', () => {
    const texto = `
PRDF: RDD TBD, Event Date N/A, CLIENTE, Rep REP, BO# 3
Item [2000097477]    Qty [1]    Description [ALGO]
`;
    const { solicitudes } = parseRequestText(texto);
    const [evaluada] = evaluarSolicitudes(solicitudes, inventario, {
      umbralPorcentaje: 0.3,
      margenDiasRdd: 3,
      ahora,
    });
    expect(evaluada.items[0].estado).toBe('Revisar');
    expect(evaluada.items[0].motivo).toMatch(/RDD/i);
  });

  // Un disponible negativo daba un porcentaje negativo que, por ser menor al
  // umbral, se aprobaba: -3 de existencia devolvía "Aprobado".
  it('rechaza un item físico con disponible negativo, sin calcular porcentaje', () => {
    const inventarioNegativo = new Map([
      ['1000133809', { itemCode: '1000133809', descripcion: 'GOWN', disponible: -3, demanda: null }],
    ]);
    const texto = `
PRDF: RDD 31-JUL-26, Event Date N/A, CLIENTE, Rep REP, BO# 4
Item [1000133809]    Qty [2]    Description [GOWN: RENTAL ALMA MATER.DOCTOR.]
`;
    const { solicitudes } = parseRequestText(texto);
    const [evaluada] = evaluarSolicitudes(solicitudes, inventarioNegativo, {
      umbralPorcentaje: 0.3,
      margenDiasRdd: 3,
      ahora,
    });
    expect(evaluada.items[0].estado).toBe('Rechazado');
    expect(evaluada.items[0].motivo).toMatch(/negativo/i);
    expect(evaluada.items[0].porcentajeConsumo).toBeNull();
  });

  it('marca "N/A - Servicio" un paquete o servicio con disponible negativo', () => {
    const inventarioNegativo = new Map([
      ['1012010781', { itemCode: '1012010781', descripcion: 'PAQUETE', disponible: -3, demanda: null }],
    ]);
    const texto = `
PRDF: RDD 31-JUL-26, Event Date N/A, CLIENTE, Rep REP, BO# 5
Item [1012010781]    Qty [2]    Description [PRODUCT PACKAGE: GRADUATION REGALIA.RENTAL GRADUATION OUTFIT MASTER]
`;
    const { solicitudes } = parseRequestText(texto);
    const [evaluada] = evaluarSolicitudes(solicitudes, inventarioNegativo, {
      umbralPorcentaje: 0.3,
      margenDiasRdd: 3,
      ahora,
    });
    expect(evaluada.items[0].estado).toBe('N/A - Servicio');
    expect(evaluada.items[0].porcentajeConsumo).toBeNull();
  });
});
