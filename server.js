const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SAVES_DIR = path.join(ROOT, 'saves');
const DATA_DIR = path.join(ROOT, 'data');

if (!fs.existsSync(SAVES_DIR)) {
  fs.mkdirSync(SAVES_DIR, { recursive: true });
}

// Generate experience table (L2-style exponential curve)
function generateExpTable(maxLevel) {
  const exp = [0];
  const sp = [0];
  for (let lv = 1; lv <= maxLevel; lv++) {
    exp[lv] = Math.floor(100 * Math.pow(lv, 2.2) + lv * 50);
    sp[lv] = Math.floor(10 * Math.pow(lv, 1.8) + lv * 5);
  }
  return { exp, sp };
}

const expTable = generateExpTable(80);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Get all game data
  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const files = ['classes', 'skills', 'items', 'monsters', 'zones'];
      const data = {};
      for (const f of files) {
        data[f] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${f}.json`), 'utf8'));
      }
      data.experience = { maxLevel: 80, expTable: expTable.exp, spTable: expTable.sp };
      sendJson(res, 200, data);
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // API: List saves
  if (pathname === '/api/saves' && req.method === 'GET') {
    const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
    const saves = files.map(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, f), 'utf8'));
        return { id: f.replace('.json', ''), name: d.name, level: d.level, class: d.className, race: d.raceName, zone: d.zone, updatedAt: d.updatedAt };
      } catch {
        return { id: f.replace('.json', ''), name: 'Unknown' };
      }
    });
    sendJson(res, 200, saves);
    return;
  }

  // API: Load save
  if (pathname.startsWith('/api/saves/') && req.method === 'GET') {
    const id = pathname.split('/').pop();
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(SAVES_DIR, `${safeId}.json`);
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: 'Save not found' });
      return;
    }
    sendJson(res, 200, JSON.parse(fs.readFileSync(filePath, 'utf8')));
    return;
  }

  // API: Save game
  if (pathname === '/api/saves' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const id = (body.saveId || body.name || 'char').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      body.saveId = id;
      body.updatedAt = new Date().toISOString();
      fs.writeFileSync(path.join(SAVES_DIR, `${id}.json`), JSON.stringify(body, null, 2));
      sendJson(res, 200, { ok: true, saveId: id });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
    return;
  }

  // API: Delete save
  if (pathname.startsWith('/api/saves/') && req.method === 'DELETE') {
    const id = pathname.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(SAVES_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    sendJson(res, 200, { ok: true });
    return;
  }

  // Static files
  let staticPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, 'public', staticPath);

  if (filePath.startsWith(ROOT) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStatic(req, res, filePath);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n  ⚔️  Lineage II: Reborn`);
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  📁  Data: ${DATA_DIR}`);
  console.log(`  💾  Saves: ${SAVES_DIR}\n`);
});
