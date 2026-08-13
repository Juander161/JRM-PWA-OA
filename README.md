# JRM · PWA de Order Approval

Aplicación instalable para revisar solicitudes de Order Approval contra el
reporte de inventario OH.

Sustituye el proceso de copiar cada correo y pegarlo a mano: las solicitudes
llegan solas, cada una en su pestaña, ya comparadas contra el inventario.

---

## Cómo llega la información

```
Buzón #DC-MMex Order Approval
   │
   ▼  Power Automate  (conector estándar de Outlook — sin registro en Azure)
   │  · saca RDD, BO#, cliente y rep del ASUNTO
   │  · saca los items del CUERPO
   │  · escribe un .json
   ▼
Carpeta de OneDrive  ──sincroniza──▶  C:\Users\...\OneDrive\Order_Approval\
   │
   ▼  la PWA vigila esa carpeta cada 10 segundos
   ▼
Pestaña evaluada contra el OH, lista para revisar
```

**El flujo no compara contra inventario.** Eso lo hace esta app. Las reglas
—umbral, margen de RDD, lista de exclusión, cantidades máxima y mínima, items
de servicio, aviso de RENTAL— viven en un solo lugar, y cambiar un umbral
sigue siendo cuestión de minutos.

Detalle completo del flujo en [`docs/PWA_Y_POWER_AUTOMATE.md`](docs/PWA_Y_POWER_AUTOMATE.md).

---

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5174
npm test         # 15 pruebas de reglas y parseo
npm run build    # genera dist/
```

## Publicar

Sube el contenido de `dist/` a cualquier servidor web o hosting estático.

**Tiene que servirse por HTTPS.** Sin eso el navegador no permite instalar la
PWA ni acceder a carpetas locales. `localhost` cuenta como seguro para pruebas.

El build usa rutas relativas, así que funciona igual en la raíz del dominio o
en un subdirectorio, sin recompilar.

## Instalar

1. Abrir la URL en **Chrome o Edge** (Firefox y Safari no soportan el acceso a
   carpetas locales que necesita el modo automático)
2. Icono de instalar en la barra de direcciones → **Instalar**

## Usar

1. **Cargar inventario OH** — botón arriba a la derecha, una vez al día
2. **📂 Auto** — seleccionar la carpeta de OneDrive, una vez por sesión

> En el explorador de Windows: clic derecho sobre la carpeta →
> **Conservar siempre en este dispositivo**. Por defecto OneDrive deja los
> archivos como marcadores y la app los encontraría vacíos.

---

## Formatos que acepta la carpeta

| Extensión | De dónde viene |
|---|---|
| `.json` | Power Automate — encabezado e items ya separados |
| `.txt` | Macro de Outlook — cuerpo del correo en texto plano |
| `.eml` | Correo guardado a mano desde Outlook |

Los tres conviven, así que se puede migrar de la macro al flujo sin apagar nada.

También se puede pegar texto a mano o arrastrar un archivo, como siempre.

---

## Relación con el repositorio de la suite

Este proyecto salió de [`Juander161/CS-JRM`](https://github.com/Juander161/CS-JRM),
donde Order Approval convive con Tracking, Reportes y Administración.

Los archivos se copiaron **sin modificar y conservando las mismas rutas**, para
que comparar entre repos sea un `diff` directo.

> ⚠️ **Mientras el módulo exista en los dos repos, las reglas de negocio están
> duplicadas y van a divergir.** Un arreglo aplicado aquí no llega allá.
>
> Conviene decidir cuál de los dos es el hogar de Order Approval y quitarlo del
> otro. Si este repo es el que se va a desplegar, lo natural es retirar el
> módulo de la suite y dejar allá solo Tracking, Reportes y Administración.

---

## Lo que falta decidir

**Dónde poner el corte de auto-aprobación.** Mientras no esté definido, toda
solicitud pasa por una persona. Es lo seguro, pero es también lo que no baja la
carga frente al plazo de 2 horas.

**Controles de falla.** Como no responder equivale a aprobar, una caída del
flujo aprueba todo en silencio. Antes de automatizar respuestas hacen falta
alerta de falla, vigilante de silencio y bitácora — ver
[`docs/PRUEBA_POWER_AUTOMATE.md`](docs/PRUEBA_POWER_AUTOMATE.md).
