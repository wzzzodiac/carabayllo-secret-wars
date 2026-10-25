# Flota peruana canónica
Aprobada el 24-10-2026: Mototaxi, Tico amarillo, Yaris, Patrullero PNP,
Helados D'Onofrio, Micro Lima, Triciclo frutero de toldo verde y Moto Rappi.

Los ocho PNG de esta carpeta son sprites originales generados con la herramienta
integrada image_gen. Las fotografías aprobadas se usaron como referencias de
carrocería y color; el atlas B anterior se usó como referencia de estilo.
Los prompts completos están en prompts.json. El panel de donofrio.png se dejó
sin letras mediante el prompt de donofrio-lettering-prompt.txt; mini-avatar.js
dibuja D'ONOFRIO con texto exacto para evitar errores en el nombre.
Los animales originales y el arte de Huancavelica no se modificaron.

Archivos: mototaxi.png, tico.png, yaris.png, pnp.png, donofrio.png,
microbus.png, triciclo.png y rappi.png. Todos son RGBA de 1254 x 1254.
vehicle-art.js contiene recortes, asientos y centros de rueda en coordenadas
de imagen, sin reescribir ni deformar los PNG. El render mantiene sombras,
inclinación, movimiento del animal, aterrizajes y partículas acotadas.
Las seis selecciones de carrito anteriores migran al nuevo catálogo.
El catálogo canónico se comparte con el servidor; hay 48 combinaciones.

Verificación: npm run check del frontend y 331/331 pruebas del backend.
Revisión local en navegador: Cuy y Conejo en los ocho vehículos, cambio PNP
a Rappi tras READY (reinicia READY), sincronización entre dos clientes y START.
No se cambió la gravedad, los colliders, el mapa ni las reglas de combate.
Implementación local; no se publicó ni desplegó.
