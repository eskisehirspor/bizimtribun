// Plesk Node.js (Passenger) başlangıç dosyası: "next start" komutunu çalıştırır.
// Passenger portu kendisi verir; elle bir şey ayarlamaya gerek yok.
const next = require.resolve("next/dist/bin/next");
process.argv = [process.argv[0], next, "start"];
require(next);
