import * as XLSX from 'xlsx';

// Nombres de columna reconocidos, incluyendo los del reporte real "Reporte
// OH" usado en la oficina (columnas "Item", "Item Description",
// "On-hand Qty", con un Locator por fila).
const CANDIDATOS_ITEM = ['ITEM', 'CODIGO DE ITEM', 'CÓDIGO DE ITEM', 'CODIGO', 'ITEM CODE'];
const CANDIDATOS_DESCRIPCION = ['DESCRIPCION', 'DESCRIPCIÓN', 'DESCRIPTION', 'ITEM DESCRIPTION'];
const CANDIDATOS_DISPONIBLE = [
  'CANTIDAD DISPONIBLE', 'DISPONIBLE', 'QTY DISPONIBLE', 'AVAILABLE',
  'ON-HAND QTY', 'ON HAND QTY', 'ONHAND QTY', 'OH QTY',
];
const CANDIDATOS_DEMANDA = ['DEMANDA', 'CONSUMO', 'DEMANDA/CONSUMO', 'DEMAND'];

// El reporte real trae el inventario "OH" (on-hand) como hoja principal,
// más hojas informativas derivadas de esa misma data (p. ej. una tabla que
// solo filtra los renglones con cantidad negativa) y, a veces, hojas de
// otras ubicaciones (p. ej. "QC MEX", stock en control de calidad) que NO
// se consideran disponible para enviar. Por eso se busca explícitamente
// una hoja llamada "OH"; si no existe (otros formatos de archivo), se usa
// la primera hoja como antes.
const NOMBRE_HOJA_PRINCIPAL = 'OH';

function normalizar(valor) {
  return String(valor).trim().toUpperCase();
}

function encontrarClave(claves, candidatos) {
  return claves.find((clave) => candidatos.includes(normalizar(clave)));
}

function elegirHoja(workbook) {
  const nombreExacto = workbook.SheetNames.find(
    (nombre) => normalizar(nombre) === NOMBRE_HOJA_PRINCIPAL
  );
  return workbook.Sheets[nombreExacto || workbook.SheetNames[0]];
}

// Lee la hoja de disponibilidad ("OH" si existe, si no la primera hoja) y
// devuelve un mapa por código de Item con la cantidad disponible TOTAL
// (sumando todas las filas de ese Item, ya que un mismo código puede
// repetirse en varias filas por estar en distintos Locators/ubicaciones).
export async function parseInventoryFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return parseInventoryArrayBuffer(arrayBuffer);
}

// Misma lógica que parseInventoryFile pero a partir de un ArrayBuffer ya
// en memoria (se usa al rehidratar el archivo guardado en sessionStorage,
// sin pedirle al usuario que lo vuelva a subir).
export function parseInventoryArrayBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const hoja = elegirHoja(workbook);
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

  const inventario = new Map();
  if (!filas.length) return inventario;

  const claves = Object.keys(filas[0]);
  const claveItem = encontrarClave(claves, CANDIDATOS_ITEM);
  const claveDescripcion = encontrarClave(claves, CANDIDATOS_DESCRIPCION);
  const claveDisponible = encontrarClave(claves, CANDIDATOS_DISPONIBLE);
  const claveDemanda = encontrarClave(claves, CANDIDATOS_DEMANDA);

  if (!claveItem || !claveDisponible) {
    throw new Error(
      'No se encontraron las columnas de Item y/o Cantidad Disponible en el Excel. ' +
        'Revisa que el archivo tenga columnas reconocibles (ver ayuda de la sección).'
    );
  }

  for (const fila of filas) {
    const codigo = normalizar(fila[claveItem]);
    if (!codigo) continue;

    const disponibleFila = Number(fila[claveDisponible]) || 0;
    const demandaFila = claveDemanda ? Number(fila[claveDemanda]) || 0 : null;
    const descripcionFila = claveDescripcion ? String(fila[claveDescripcion]).trim() : '';

    const existente = inventario.get(codigo);
    if (existente) {
      // Mismo código de Item en otra fila (otra ubicación/Locator): se suma
      // al disponible total en vez de quedarnos solo con la última fila.
      existente.disponible += disponibleFila;
      if (demandaFila !== null) existente.demanda = (existente.demanda || 0) + demandaFila;
      if (!existente.descripcion && descripcionFila) existente.descripcion = descripcionFila;
    } else {
      inventario.set(codigo, {
        itemCode: codigo,
        descripcion: descripcionFila,
        disponible: disponibleFila,
        demanda: demandaFila,
      });
    }
  }

  return inventario;
}

// Combina varios mapas de inventario (uno por archivo/día seleccionado) en
// uno solo. Si un mismo código de Item aparece en más de un archivo, se
// suman sus cantidades disponibles (mismo criterio que ya se usa dentro de
// un solo archivo para filas repetidas del mismo Item en distintos
// Locators): cada archivo representa material que se va sumando al
// disponible total, no una fotografía que reemplaza a la anterior.
export function combinarInventarios(mapas) {
  const combinado = new Map();

  for (const mapa of mapas) {
    for (const [codigo, item] of mapa) {
      const existente = combinado.get(codigo);
      if (existente) {
        existente.disponible += item.disponible;
        if (item.demanda !== null) {
          existente.demanda = (existente.demanda || 0) + item.demanda;
        }
        if (!existente.descripcion && item.descripcion) {
          existente.descripcion = item.descripcion;
        }
      } else {
        combinado.set(codigo, { ...item });
      }
    }
  }

  return combinado;
}
