// ============================================================================
//  Cotizador COP-VES compartido — backend propio para Railway. SIN dependencias.
//  Guarda el historial en un archivo JSON persistente (usa un Volume de Railway).
//  Sirve la página, expone API de cotizaciones y una clave opcional de acceso.
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '';          // opcional: protege la app
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data'); // en Railway: monta un Volume aquí
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function ensure() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {} }
function readJSON(f, fallback) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } }
function writeJSON(f, obj) { ensure(); fs.writeFileSync(f, JSON.stringify(obj, null, 2)); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

// Siembra inicial (las filas de la hoja) — solo si aún no hay datos.
const SEED = [
  { id: 'seed1', company: 'BUDA.COM',    rate: 3.536, fecha: '2026-09-23', hora: '10:31', ts: 1790177460000, refAmount: 1000000 },
  { id: 'seed2', company: 'GLOBAL 66',   rate: 3.87,  fecha: '2026-09-23', hora: '10:32', ts: 1790177520000, refAmount: 1000000 },
  { id: 'seed3', company: 'VITA WALLET', rate: 3.39,  fecha: '2026-09-23', hora: '10:32', ts: 1790177520000, refAmount: 1000000 },
  { id: 'seed4', company: 'RETORNA',     rate: 3.64,  fecha: '2026-09-23', hora: '10:35', ts: 1790177700000, refAmount: 1000000 },
  { id: 'seed5', company: 'ACCIVALORES', rate: 4.0,   fecha: '2026-09-23', hora: '10:35', ts: 1790177700000, refAmount: 1000000 },
];
ensure();
if (!fs.existsSync(QUOTES_FILE) || (Array.isArray(readJSON(QUOTES_FILE, [])) && readJSON(QUOTES_FILE, []).length === 0)) writeJSON(QUOTES_FILE, SEED);
if (!fs.existsSync(CONFIG_FILE)) writeJSON(CONFIG_FILE, { refAmount: 1000000 });

function authed(url, req) {
  if (!APP_PASSWORD) return true;
  const key = url.searchParams.get('key') || req.headers['x-app-key'] || '';
  return key === APP_PASSWORD;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json; charset=utf-8' };
function sendJSON(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => r(d)); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (p === '/health') return sendJSON(res, 200, { ok: true });

    // ¿La app requiere clave? (para que el front sepa si pedirla)
    if (p === '/api/needkey') return sendJSON(res, 200, { needKey: !!APP_PASSWORD });

    if (p === '/api/quotes' && req.method === 'GET') {
      if (!authed(url, req)) return sendJSON(res, 401, { error: 'clave requerida' });
      const quotes = readJSON(QUOTES_FILE, []);
      const config = readJSON(CONFIG_FILE, { refAmount: 1000000 });
      return sendJSON(res, 200, { quotes, config, generatedAt: Date.now() });
    }

    if (p === '/api/quotes' && req.method === 'POST') {
      if (!authed(url, req)) return sendJSON(res, 401, { error: 'clave requerida' });
      let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch { return sendJSON(res, 400, { error: 'JSON inválido' }); }
      const company = String(b.company || '').trim();
      const rate = num(b.rate);
      if (!company || !(rate > 0)) return sendJSON(res, 400, { error: 'compañía y tasa válida son obligatorias' });
      const fecha = b.fecha || null, hora = b.hora || null;
      const dt = new Date(`${fecha || ''}T${hora || '00:00'}:00`);
      const ts = isNaN(dt.getTime()) ? Date.now() : dt.getTime();
      const quotes = readJSON(QUOTES_FILE, []);
      const entry = { id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6), company, rate, fecha, hora, ts, refAmount: num(b.refAmount) || undefined };
      quotes.push(entry);
      writeJSON(QUOTES_FILE, quotes);
      return sendJSON(res, 200, { ok: true, entry });
    }

    if (p === '/api/config' && req.method === 'POST') {
      if (!authed(url, req)) return sendJSON(res, 401, { error: 'clave requerida' });
      let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch { return sendJSON(res, 400, { error: 'JSON inválido' }); }
      const refAmount = num(b.refAmount);
      if (!(refAmount > 0)) return sendJSON(res, 400, { error: 'refAmount inválido' });
      writeJSON(CONFIG_FILE, { refAmount });
      return sendJSON(res, 200, { ok: true });
    }

    // Cualquier otra ruta GET sirve la página (SPA). index.html está en la raíz, sin carpetas.
    if (req.method === 'GET') {
      let html = null; try { html = fs.readFileSync(path.join(__dirname, 'index.html')); } catch {}
      if (html) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html); }
      res.writeHead(404); return res.end('index.html no encontrado en el servidor');
    }
    res.writeHead(404); return res.end('No encontrado');
  } catch (err) { sendJSON(res, 502, { error: String(err && err.message || err) }); }
});
server.listen(PORT, () => console.log(`Cotizador COP-VES en :${PORT} — datos en ${DATA_DIR}${APP_PASSWORD ? ' — con clave' : ''}`));
