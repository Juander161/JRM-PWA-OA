# Order Approval en Excel + VBA

Versión del evaluador dentro de un libro de Excel, para el caso en que no se
autorice publicar una aplicación.

Cada BO# se escribe en su propia hoja: **las pestañas de Excel hacen el papel
de las pestañas de la aplicación**.

```
[ Config ] [ Pegar ] [ OH ] [ Historial ] [ 95730751 ] [ 95764648 ] [ 95621602 ]
```

---

## Instalación

Toma unos 10 minutos y se hace una sola vez.

### 1 · Crear el libro

Abre Excel → **Libro en blanco** → **Archivo → Guardar como** →
tipo **Libro de Excel habilitado para macros (\*.xlsm)**.

> Si lo guardas como `.xlsx` normal, el código se pierde al cerrar.

### 2 · Importar el código

1. **Alt + F11** para abrir el editor
2. Menú **Archivo → Importar archivo…**
3. Selecciona `modOrderApproval.bas`
4. **Ctrl + S**

Si prefieres no importar: **Insertar → Módulo**, y pega el contenido del `.bas`
completo (sin la primera línea, la que dice `Attribute VB_Name`).

### 3 · Crear las hojas

Con el cursor dentro del bloque `ConfigurarLibro`, presiona **F5**.

Se crean cuatro hojas con sus encabezados:

| Hoja | Para qué |
|---|---|
| `Config` | Umbral, margen de RDD, zona ámbar, cantidades, exclusiones |
| `Pegar` | Donde se pega el correo |
| `OH` | Donde se pega el reporte de inventario |
| `Historial` | Registro acumulado de todo lo evaluado |

### 4 · Botones *(opcional pero recomendable)*

En la hoja `Pegar`: **Insertar → Formas → Rectángulo**, clic derecho →
**Asignar macro** → `EvaluarSolicitudes`. Escríbele "Evaluar" encima.

Otro igual para `LimpiarResultados`.

Así nadie tiene que entrar al editor de macros.

---

## Uso diario

1. **Hoja `OH`** — pega el reporte de inventario. Los encabezados deben decir
   `Item` y `On-hand Qty` en la fila 1.
2. **Hoja `Pegar`** — pega el asunto y el cuerpo del correo, desde la fila 2.
3. **Botón Evaluar** (o F5 sobre `EvaluarSolicitudes`).

Cada BO# aparece en su propia pestaña, con los items, el disponible, el
porcentaje de consumo, el estado y el motivo. La celda de estado va coloreada
igual que en la aplicación.

**Limpiar resultados** borra las pestañas de BO# generadas. `Config`, `Pegar`,
`OH` e `Historial` no se tocan.

---

## Configuración

En la hoja `Config`:

| Celda | Parámetro | Por defecto |
|---|---|---|
| B2 | Umbral (%) | 30 |
| B3 | Margen RDD (días) | 3 |
| B4 | Zona ámbar (%) | 7 |
| B5 | Cantidad máxima | 0 = sin límite |
| B6 | Cantidad mínima | 0 = sin límite |

Desde **A9 hacia abajo**, un código por fila: items que se rechazan siempre,
aunque haya inventario.

---

## Reglas aplicadas

Mismo orden de prioridad que la aplicación:

1. Item en lista de exclusión → **Rechazado**
2. Cantidad fuera de los límites configurados → **Rechazado**
3. RDD ilegible → **Revisar**
4. RDD más corto que el margen → **Rechazado**
5. No está en el OH y es servicio o paquete → **N/A - Servicio**
6. No está en el OH → **Sin dato**
7. Disponible **negativo** → **Rechazado** *(servicio o paquete: N/A)*
8. Disponible en 0 → **Rechazado**
9. Consumo ≥ umbral → **Rechazado**
10. Consumo dentro de la zona ámbar → **Revisar**
11. Resto → **Aprobado**

También reproduce tres comportamientos que costaron encontrar:

- **Suma los locators.** Un item repetido en varias filas del OH suma sus
  cantidades; quedarse con la primera daría un disponible menor al real.
- **Une descripciones partidas.** Cuando el correo envuelve una descripción
  larga en dos renglones, el artículo se reconstruye en vez de perderse.
- **Atrapa el disponible negativo antes del porcentaje.** Dividir entre un
  negativo da un porcentaje negativo que, por ser menor al umbral, pasaría
  como Aprobado — justo al revés de la realidad.

---

## Limitaciones frente a la aplicación

Esto no es una lista de defectos por corregir: son consecuencias de la
herramienta, y conviene tenerlas a la vista al comparar.

| | Excel + VBA | PWA |
|---|---|---|
| Lectura de correos | Pegar a mano | Automática, cada 10 s |
| Actualizar a todos | Reenviar el archivo | Automático al abrir |
| Trabajo en paralelo | Un archivo por persona | Todos ven la misma carpeta |
| Pruebas automáticas | No hay | 17, en cada publicación |
| Historial de cambios | No hay | Cada cambio queda registrado |
| Estado visto / sin ver | No | Sí |
| Aviso de RENTAL | No | Sí |
| Copiar tabla para responder | Copiar del rango | Un botón, con formato |

### Y una que pesa más que todas

**Es la tercera copia de las reglas de negocio.** Ya están en la PWA y en la
suite. Cada corrección hay que aplicarla en tres lugares — y aquí no hay
pruebas que avisen si se olvidó una.

El error del disponible negativo se encontró con datos reales después de
semanas funcionando. En la PWA se corrigió en minutos y quedó cubierto por una
prueba que impide que vuelva. En VBA, la única forma de saber que sigue bien es
que alguien lo note.
