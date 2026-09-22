// Genera la clave de esta PC para el sincronizador y muestra su huella.
// La clave queda SOLO en config.json de esta PC. La huella (sha256) no es secreta:
// es lo que se registra en la base para reconocer a esta PC.
// Si la clave ya existe, no la cambia: solo vuelve a mostrar la huella.
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ruta = path.join(__dirname, 'config.json');
var config = {};
try { config = JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch (e) { /* primera vez */ }

if (!config.clave_sync) {
  config.clave_sync = crypto.randomBytes(32).toString('hex');
  config.carpetas = config.carpetas || ['G:\\', '\\\\SRVFEM\\Aplicaciones\\'];
  fs.writeFileSync(ruta, JSON.stringify(config, null, 2));
  console.log('Se genero una clave nueva para esta PC.');
} else {
  console.log('Esta PC ya tenia clave; no se cambio.');
}

var huella = crypto.createHash('sha256').update(config.clave_sync).digest('hex');
fs.writeFileSync(path.join(__dirname, 'huella.txt'), huella + '\r\n');
console.log('');
console.log('HUELLA (mandasela a Claude, no es secreta):');
console.log('');
console.log('   ' + huella.slice(0, 32));
console.log('   ' + huella.slice(32));
console.log('');
console.log('Tambien quedo guardada en huella.txt');
