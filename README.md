# Cotizador COP-VES compartido (Railway)

Una sola URL pública que tus compañeros pueden ver y alimentar. Historial persistente,
tabla comparativa vs Buda, gráfico evolutivo y recordatorios en la propia página. Sin dependencias.

## Por qué Railway y no Netlify
Netlify solo sirve archivos estáticos: no guarda un historial compartido por sí solo. Railway corre
el servidor y, con un Volume, guarda los datos de forma persistente. Por eso va en Railway.

## Desplegar en Railway
1. Sube estos archivos a un repo NUEVO (server.js, package.json, .gitignore y la carpeta public/).
2. Railway → Deploy from GitHub repo → elige el repo.
3. **Persistencia (importante):** agrega un **Volume** al servicio y móntalo en `/data`.
   Luego en Variables pon `DATA_DIR=/data`. Así el historial sobrevive reinicios y despliegues.
   (Sin Volume funciona, pero los datos se reinician en cada despliegue.)
4. **Public Networking → Generate Domain** para obtener la URL pública que compartes.

## Variables (Railway → Variables)
- `DATA_DIR=/data`  (si montaste el Volume; recomendado)
- `APP_PASSWORD=...` (opcional) — si la pones, la app pide esa clave para ver/registrar.
  Compártela solo con tu equipo. Sin ella, cualquiera con el link entra.

## Uso
- Registra cotizaciones: Compañía, Tasa, Fecha, Hora. Aparecen en la tabla y el gráfico.
- La página se refresca sola cada 25s, así ves lo que registran tus compañeros.
- Botón "🔔 Activar recordatorios": mientras la página esté abierta, avisa a las 8/10/12/2pm
  (hora Colombia). Con la pestaña cerrada, una web no puede avisar (para eso está el bot de Telegram aparte).

## API
- GET  /api/quotes         → { quotes, config }
- POST /api/quotes         → { company, rate, fecha, hora }
- POST /api/config         → { refAmount }
(la clave, si existe, va como ?key= o cabecera x-app-key)
