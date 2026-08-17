// Genera dist/order-approval.html: la aplicación completa en UN SOLO archivo,
// con el JavaScript, el CSS y el icono incrustados.
//
// Para qué sirve: se copia a una carpeta compartida o se manda por correo, y
// quien lo recibe le da doble clic. No necesita servidor, ni instalación, ni
// permisos de TI, ni conexión. Es el plan B si no se autoriza publicar la PWA.
//
// Qué se pierde respecto a la versión instalada: abierto desde el disco, el
// navegador no permite vigilar una carpeta. Los archivos de solicitud hay que
// seleccionarlos a mano — se pueden marcar todos de una vez, pero es un paso
// manual por tanda.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

const html = await readFile(join(dist, 'index.html'), 'utf8');
const js   = await readFile(join(dist, 'assets/app.js'), 'utf8');
const css  = await readFile(join(dist, 'assets/index.css'), 'utf8');
const svg  = await readFile(join(dist, 'icono.svg'), 'utf8');

// Una cadena "</script>" dentro del código cerraría la etiqueta antes de
// tiempo y rompería la página. Se parte para que el navegador no la vea.
const jsSeguro = js.replace(/<\/script/gi, '<\\/script');

const iconoDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

// Las sustituciones usan FUNCIÓN y no cadena a propósito: con una cadena,
// replace() interpreta $&, $' y $` como patrones especiales, y el JavaScript
// minificado los contiene. Eso reinsertaba trozos del propio archivo por todas
// partes y dejaba la página inservible.
const unico = html
  // El manifiesto solo tiene sentido si la página se sirve por HTTPS.
  .replace(/\s*<link rel="manifest"[^>]*>/i, () => '')
  .replace(/href="\.\/icono\.svg"/g, () => `href="${iconoDataUri}"`)
  .replace(/\s*<link rel="stylesheet"[^>]*href="[^"]*\.css"[^>]*>/i,
           () => `\n    <style>\n${css}\n    </style>`)
  .replace(/\s*<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/i,
           () => `\n    <script type="module">\n${jsSeguro}\n    </script>`);

const salida = join(dist, 'order-approval.html');
await writeFile(salida, unico, 'utf8');

const mb = (Buffer.byteLength(unico) / 1024 / 1024).toFixed(2);
console.log(`✓ dist/order-approval.html generado (${mb} MB)`);
