# Plan de pruebas — Power Automate para Order Approval

Objetivo: comprobar por fases si Power Automate puede leer el buzón, interpretar
las solicitudes, compararlas contra el inventario y responder — **sin el registro
de aplicación en Azure que está bloqueado**.

Cada fase es una prueba independiente con un resultado claro. Si una falla, se
detiene ahí y no se invierte en las siguientes.

---

## Regla de seguridad para todas las pruebas

> **Nunca respondas al remitente real durante las pruebas.**
>
> En cualquier acción de envío, pon tu propio correo como destinatario hasta que
> el flujo esté validado. Un flujo a medias respondiendo a clientes reales es un
> problema difícil de deshacer.
>
> Trabaja siempre con el flujo **apagado** salvo durante la prueba, y usa correos
> de prueba que tú mismo envíes al buzón.

---

# Fase 0 — Preparación

Antes de construir nada, reunir tres cosas:

| Qué | Cómo se confirma |
|---|---|
| Acceso a Power Automate | Entrar a `make.powerautomate.com` — si abre, hay licencia |
| Acceso al buzón compartido | El buzón aparece en tu Outlook |
| Archivo OH en SharePoint/OneDrive | Subirlo y darle formato de tabla (ver abajo) |

## Preparar el archivo OH

Power Automate solo puede leer Excel si los datos están **formateados como tabla**.

1. Abre el OH en Excel
2. Selecciona el rango de datos (con encabezados)
3. **Insertar → Tabla** → marcar "La tabla tiene encabezados"
4. Con la tabla seleccionada: **Diseño de tabla → Nombre de la tabla** → escribir `Inventario`
5. Guardar el archivo en **OneDrive o SharePoint** (no en el disco local)

> Para las pruebas basta con un recorte de 200–300 filas que incluya algunos de
> los códigos que aparecen en los correos de ejemplo. Es más rápido y evita
> problemas de tamaño.

Anota el nombre exacto de las columnas de código y de disponible — se usan más
adelante.

---

# Fase 1 — ¿Funciona el disparador? ⭐

**Esta es la prueba que importa.** Si funciona, queda demostrado que no hace
falta el registro de aplicación en Azure. Si no funciona, no tiene sentido
continuar.

Tiempo: ~20 minutos.

## Construcción

1. En `make.powerautomate.com` → **Crear** → **Flujo de nube automatizado**
2. Nombre: `OA - Prueba 1 - Disparador`
3. Buscar el disparador: **"Cuando llega un mensaje nuevo a un buzón compartido (V2)"**
   (conector *Office 365 Outlook*)
4. Configurar:
   - **Dirección del buzón original**: la dirección del buzón compartido
   - **Carpeta**: `Inbox`
   - **Incluir datos adjuntos**: No
5. Agregar acción: **"Enviar un correo electrónico (V2)"**
   - **Para**: tu propio correo
   - **Asunto**: `PRUEBA OK - se leyó un correo`
   - **Cuerpo**: insertar los campos dinámicos `Asunto` y `De` del disparador
6. Guardar

## Prueba

Envía un correo cualquiera al buzón compartido y espera.

### Resultado esperado

Llega el correo `PRUEBA OK` a tu bandeja, con el asunto y remitente del correo
de prueba.

### Si funciona

**Ese es el hallazgo importante.** Documéntalo y compártelo con IT: demuestra
que el conector estándar de Outlook accede al buzón sin registrar una aplicación
en Azure AD. Es el argumento que puede destrabar la conversación.

### Si falla

Anota el mensaje de error exacto — dice si el problema es de licencia, de
permisos sobre el buzón, o de directiva. Cada uno tiene una salida distinta y
conviene saber cuál es antes de escalarlo.

---

# Fase 2 — Interpretar el correo

Comprobar que se pueden extraer RDD, BO# e items del cuerpo del mensaje.

Tiempo: ~45 minutos.

## Construcción

Duplica el flujo anterior y renómbralo `OA - Prueba 2 - Parseo`.

### 2.1 Convertir el cuerpo a texto plano

Agregar acción **"Html a texto"** (conector *Conversión de contenido*):
- **Contenido**: campo dinámico `Cuerpo` del disparador

### 2.2 Guardar el texto en una variable

Acción **"Inicializar variable"**:
- Nombre: `varTexto`
- Tipo: `Cadena`
- Valor: la salida de *Html a texto*

### 2.3 Extraer el BO#

Acción **"Inicializar variable"**:
- Nombre: `varBO`
- Tipo: `Cadena`
- Valor (pestaña **Expresión**):

```
trim(first(split(last(split(variables('varTexto'), 'BO# ')), decodeUriComponent('%0A'))))
```

### 2.4 Extraer el RDD

Acción **"Inicializar variable"**:
- Nombre: `varRDD`
- Tipo: `Cadena`
- Valor (expresión):

```
trim(first(split(last(split(variables('varTexto'), 'RDD ')), ',')))
```

Resultado esperado: `24-JUL-26`

### 2.5 Convertir el RDD a fecha

Primero, una acción **"Redactar"** llamada `Meses`:

```
json('{"JAN":"01","FEB":"02","MAR":"03","APR":"04","MAY":"05","JUN":"06","JUL":"07","AUG":"08","SEP":"09","OCT":"10","NOV":"11","DEC":"12"}')
```

Luego **"Inicializar variable"** `varRDDiso`, tipo Cadena:

```
concat('20', last(split(variables('varRDD'), '-')), '-', outputs('Meses')[toUpper(split(variables('varRDD'), '-')[1])], '-', if(less(length(first(split(variables('varRDD'), '-'))), 2), concat('0', first(split(variables('varRDD'), '-'))), first(split(variables('varRDD'), '-'))))
```

Resultado esperado: `2026-07-24`

Y **"Inicializar variable"** `varDias`, tipo Entero:

```
div(sub(ticks(variables('varRDDiso')), ticks(formatDateTime(utcNow(), 'yyyy-MM-dd'))), 864000000000)
```

Resultado esperado: número de días entre hoy y el RDD.

### 2.6 Separar los items

Acción **"Inicializar variable"**:
- Nombre: `varItems`
- Tipo: `Matriz`
- Valor (expresión):

```
skip(split(variables('varTexto'), 'Item ['), 1)
```

Cada elemento queda como
`2000097477]    Qty [1]    Description [SERVICE: RETURN.ALTERATION.]`

### 2.7 Recorrer los items

Acción **"Aplicar a cada uno"** sobre `varItems`. Dentro, una acción
**"Redactar"** llamada `ItemParseado`:

```
json(concat('{"codigo":"', trim(first(split(item(), ']'))), '","qty":', trim(first(split(last(split(item(), 'Qty [')), ']'))), ',"descripcion":"', replace(trim(first(split(last(split(item(), 'Description [')), ']'))), '"', ''), '"}'))
```

Esto devuelve un objeto por item:

```json
{ "codigo": "2000097477", "qty": 1, "descripcion": "SERVICE: RETURN.ALTERATION." }
```

> El `replace` de comillas dobles evita que una descripción con `"` (las medidas
> como `6' 00"`) rompa el JSON. Sin eso el flujo falla con esos items.

### 2.8 Ver el resultado

Fuera del bucle, en la acción de enviar correo, incluir `varBO`, `varRDD`,
`varDias` y `varItems` en el cuerpo.

## Prueba

Envía al buzón un correo con el formato real:

```
PRDF: RDD 24-JUL-26, Event Date N/A, SLADE JAN, Rep SLADE JAN, BO# 95637276
Item [2000097477]    Qty [1]    Description [SERVICE: RETURN.ALTERATION.]
Item [1000164077]    Qty [13]   Description [CAP: ALMA MATER.STANDARD.HARD.]
```

### Resultado esperado

El correo de salida trae BO# `95637276`, RDD `24-JUL-26`, los días calculados y
los dos items separados.

### Qué comprobar aquí

- **¿Cada correo trae un solo BO#?** Si un correo puede traer varios bloques
  `PRDF:`, este parseo solo toma el último y hay que rediseñarlo. Confírmalo con
  correos reales antes de seguir.
- **¿Las descripciones con comillas pasan bien?** Prueba con un item tipo
  `GOWN: ... 6' 00"`.

---

# Fase 3 — Comparar contra el inventario

Tiempo: ~45 minutos.

Dentro del bucle **"Aplicar a cada uno"**, después de `ItemParseado`:

### 3.1 Buscar el item

Acción **"Enumerar filas presentes en una tabla"** (conector *Excel Online (Business)*):
- **Ubicación / Biblioteca / Archivo**: el OH preparado en la Fase 0
- **Tabla**: `Inventario`
- **Consulta de filtro** (ajustar `Codigo` al nombre real de la columna):

```
Codigo eq '@{outputs('ItemParseado')['codigo']}'
```

> Se usa *Enumerar filas* con filtro y no *Obtener una fila* porque cuando el
> item no existe devuelve una lista vacía en lugar de fallar. Un item que no
> está en el OH es un caso normal, no un error.

### 3.2 Decidir el estado

Acción **"Condición"**: `length(body('Enumerar_filas')?['value'])` **es igual a** `0`

- **Si sí** → estado `Sin dato`
- **Si no** → calcular el porcentaje y aplicar el umbral:

```
div(mul(outputs('ItemParseado')['qty'], 1.0), float(first(body('Enumerar_filas')?['value'])['Disponible']))
```

Comparar contra `0.30` para decidir `Aprobado` / `Rechazado`.

### Resultado esperado

Por cada item, un estado calculado que coincide con lo que daría la revisión
manual. **Contrasta 10 correos reales contra lo que decidiría una persona antes
de confiar en el resultado.**

---

# Fase 4 — Salida

Tiempo: ~30 minutos.

Tres destinos, en este orden de prioridad:

1. **Tabla de resultados** — una fila por item evaluado (BO#, código, qty,
   disponible, %, estado, fecha). Es la fuente de las métricas y la bitácora de
   auditoría. Esto va primero: sin bitácora no se debe automatizar nada.
2. **Lista de SharePoint** — solo los casos que necesitan decisión humana, con
   hora límite para el SLA de 2 horas.
3. **Respuesta al correo** — únicamente para los casos dentro de la banda de
   auto-aprobación que defina el equipo.

> El punto 3 no se activa hasta que estén definidos los criterios de
> clasificación y los controles de falla. Mientras tanto, el flujo prepara la
> respuesta pero la envía a una bandeja de prueba.

---

# Controles obligatorios antes de producción

Como no responder equivale a aprobar, una falla del flujo aprueba todo en
silencio. Antes de activarlo de verdad:

- **Alerta de falla** — configurar el flujo para notificar a una persona real
  cuando una ejecución falle (Configuración del flujo → notificaciones)
- **Vigilante de silencio** — un segundo flujo programado que revise cada hora si
  hay correos sin procesar y avise si el principal dejó de correr
- **Bitácora completa** — la tabla de resultados de la Fase 4, para poder auditar
  después qué se aprobó automáticamente y con qué datos

---

# Registro de resultados

| Fase | Estado | Fecha | Notas |
|---|---|---|---|
| 0 — Preparación | | | |
| 1 — Disparador | | | |
| 2 — Parseo | | | |
| 3 — Inventario | | | |
| 4 — Salida | | | |

Preguntas que estas pruebas deben responder:

1. ¿El disparador funciona sin registro de aplicación en Azure? *(Fase 1)*
2. ¿Cada correo trae un solo BO#? *(Fase 2)*
3. ¿Cuánto tarda una ejecución completa? *(Fase 3 — revisar el historial de ejecuciones)*
4. ¿El resultado coincide con la decisión manual en 10 casos reales? *(Fase 3)*
