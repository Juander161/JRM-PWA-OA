# PWA de Order Approval + Power Automate

Cómo queda el circuito completo sin SharePoint, sin Graph API y sin macros.

---

## La arquitectura

```
Buzón #DC-MMex Order Approval
   │
   ▼  Power Automate  (conector estándar de Outlook, sin registro en Azure)
   │  · lee el correo
   │  · saca RDD/BO#/cliente/rep del ASUNTO
   │  · saca los items del CUERPO
   │  · escribe un .json
   ▼
Carpeta de OneDrive  ──sincroniza──▶  C:\Users\...\OneDrive\Order_Approval\
   │
   ▼  La PWA vigila esa carpeta local cada 10 s
   │
   ▼
Pestaña evaluada contra el inventario OH, lista para revisar
```

**El flujo NO compara contra inventario.** Eso lo hace la PWA. Las reglas —umbral,
margen de RDD, exclusiones, items de servicio, RENTAL— viven en un solo lugar y
cambiarlas sigue siendo cuestión de minutos, en vez de editar acciones dentro de
Power Automate.

Esto también significa que **la Fase 3 del plan de pruebas ya no hace falta**: el
flujo termina cuando escribe el archivo.

---

## Parte 1 — La PWA

### Qué es

El mismo módulo de Order Approval que ya existe, montado en un cascarón ligero:
sin barra lateral, sin Tracking, sin Reportes, sin Admin. Se instala como
aplicación y arranca sin red.

No es una copia del código — es el mismo componente. Un arreglo en las reglas
beneficia a las dos versiones.

### Publicarla

```bash
npm run build
```

Genera dos páginas en `dist/`:

| Archivo | Qué es |
|---|---|
| `index.html` | La suite completa |
| `pwa.html` | Solo Order Approval, instalable |

Sube el contenido de `dist/` a cualquier servidor web interno o servicio de
hosting estático. **Tiene que servirse por HTTPS**: sin eso el navegador no
permite instalar la PWA ni acceder a carpetas locales.

### Instalarla

1. Abrir `https://tu-servidor/pwa.html` en Chrome o Edge
2. Icono de instalar en la barra de direcciones → **Instalar**
3. Queda como aplicación con su propio icono, sin barra del navegador

### Usarla

1. **Cargar inventario OH** — botón arriba a la derecha, una vez al día
2. **📂 Auto** — seleccionar la carpeta de OneDrive, una vez por sesión

De ahí en adelante las solicitudes aparecen solas.

---

## Parte 2 — El flujo de Power Automate

Continúa desde la Fase 2 del plan de pruebas, que ya tienes funcionando: `varBO`,
`varRDD` y `varResultados` con los items.

### Paso A — Variables de cliente y rep

Dos `Inicializar variable` más, tipo Cadena, leyendo del asunto:

**varCliente**
```
trim(split(outputs('Asunto'), ',')[2])
```

**varRep**
```
if(contains(outputs('Asunto'), 'Rep '), trim(first(split(split(outputs('Asunto'), 'Rep ')[1], ','))), '')
```

### Paso B — Armar el JSON

Después del bucle, una acción **Redactar** renombrada `Documento`:

```
json(concat('{"bo":"', variables('varBO'), '","rdd":"', variables('varRDD'), '","eventDate":"N/A","cliente":"', variables('varCliente'), '","rep":"', variables('varRep'), '","de":"', triggerOutputs()?['body/from'], '","asunto":"', replace(outputs('Asunto'), '"', ''), '","recibidoEn":"', utcNow(), '","items":', string(variables('varResultados')), '}'))
```

### Paso C — Escribir el archivo

Acción **OneDrive para la Empresa → Crear archivo**:

| Campo | Valor |
|---|---|
| Ruta de carpeta | `/Order_Approval` |
| Nombre de archivo | ver abajo |
| Contenido del archivo | la salida de `Documento` |

Nombre de archivo (expresión):

```
concat(formatDateTime(utcNow(), 'yyyyMMdd_HHmmss'), '_', variables('varBO'), '.json')
```

La fecha adelante mantiene los archivos en orden, y el BO# permite identificarlos
de un vistazo.

---

## Parte 3 — Conectar las dos partes

1. En OneDrive, crear la carpeta **Order_Approval**
2. En el explorador de Windows, clic derecho sobre ella →
   **Conservar siempre en este dispositivo**
3. En la PWA: **📂 Auto** → seleccionar esa carpeta

> El paso 2 no es opcional. Por defecto OneDrive deja los archivos como
> marcadores y solo baja el contenido al abrirlos; la PWA los encontraría
> vacíos.

Si varias personas sincronizan la misma carpeta compartida, todas ven la misma
cola. La marca de visto/sin ver sigue siendo individual.

---

## Formatos que acepta la carpeta

| Extensión | De dónde viene |
|---|---|
| `.json` | Power Automate — encabezado e items ya separados |
| `.txt` | La macro de Outlook — cuerpo del correo en texto |
| `.eml` | Correo guardado a mano desde Outlook |

Los tres conviven. Se puede migrar de la macro al flujo sin apagar nada.

---

## Contrato del archivo .json

```json
{
  "bo": "95730751",
  "rdd": "12-AUG-26",
  "eventDate": "N/A",
  "cliente": "JOSTENS COLLEGE PREPAID C&G",
  "rep": "FLANAGAN GREG",
  "de": "alguien@jostens.com",
  "asunto": "PRDF: RDD 12-AUG-26, ...",
  "recibidoEn": "2026-08-11T09:14:00Z",
  "items": [
    { "codigo": "1012010779", "qty": 1, "descripcion": "PRODUCT PACKAGE: ..." },
    { "codigo": "1000164077", "qty": 1, "descripcion": "CAP: ALMA MATER..." }
  ]
}
```

Solo `items` es obligatorio. Sin `bo` la solicitud entra como consulta sin
encabezado y se omite la validación de RDD, igual que hoy.

Si OneDrive entrega un archivo a medio sincronizar, la PWA lo descarta y lo
reintenta en la siguiente revisión en vez de perderlo.

---

## Lo que falta decidir

**Dónde poner el corte de auto-aprobación.** Mientras no esté definido, el flujo
solo entrega solicitudes y toda decisión pasa por una persona. Es la opción
segura, y con el plazo de 2 horas es también la que hay que resolver primero para
bajar la carga.

**Controles de falla.** Como no responder equivale a aprobar, una caída del flujo
aprueba todo en silencio. Antes de automatizar respuestas hacen falta alerta de
falla, vigilante de silencio y bitácora — ver el plan de pruebas.
