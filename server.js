const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const DIST = path.join(__dirname, 'dist');
const CACHE_FILE = path.join(__dirname, 'instagram-cache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  // Image proxy endpoint
  if (pathname === '/api/proxy') {
    const imgUrl = parsed.query ? new URLSearchParams(parsed.query).get('url') : null;
    if (!imgUrl || !imgUrl.startsWith('https://')) {
      res.writeHead(400); res.end('Bad request'); return;
    }
    try {
      const proxyReq = https.get(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://www.instagram.com/',
        }
      }, proxyRes => {
        res.writeHead(200, {
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => { res.writeHead(502); res.end(); });
    } catch (e) {
      res.writeHead(502); res.end();
    }
    return;
  }

  // API endpoint
  if (pathname === '/api/instagram') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const data = await getInstagramPosts();
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname);

  // SPA fallback — no extension = serve index.html
  if (!path.extname(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html as final fallback
      fs.readFile(path.join(DIST, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (ext !== '.html') res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Server on port ${PORT}`));

// ===== Instagram logic =====

async function getInstagramPosts() {
  // Check cache
  if (fs.existsSync(CACHE_FILE)) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Date.now() - cache.timestamp < CACHE_TTL && cache.posts?.length > 0) {
      return { posts: cache.posts, cached: true };
    }
  }

  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN not set');

  // Start Apify run
  const run = await apifyPost('/v2/acts/apify~instagram-scraper/runs', {
    directUrls: ['https://www.instagram.com/ekvity.ua/'],
    resultsType: 'posts',
    resultsLimit: 9,
    addParentData: false,
  });

  const runId = run.data.id;
  const datasetId = run.data.defaultDatasetId;

  // Wait for completion
  await waitForRun(runId, 90000);

  // Fetch items
  const items = await apifyGet(`/v2/datasets/${datasetId}/items?limit=9`);

  const posts = items
    .filter(i => i.displayUrl)
    .map(i => ({
      url: i.url,
      displayUrl: i.displayUrl,
      caption: i.caption ? i.caption.slice(0, 120) : '',
      timestamp: i.timestamp,
    }));

  fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), posts }));
  return { posts, cached: false };
}

// ===== Apify helpers (pure node:https) =====

function apifyRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const fullUrl = `https://api.apify.com${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${APIFY_TOKEN}`;
    const u = new url.URL(fullUrl);
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSON parse error: ' + raw.slice(0, 100))); }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function apifyPost(endpoint, body) {
  return apifyRequest('POST', endpoint, body);
}

async function apifyGet(endpoint) {
  const res = await apifyRequest('GET', endpoint);
  return Array.isArray(res) ? res : (res.data?.items || []);
}

async function waitForRun(runId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await apifyRequest('GET', `/v2/actor-runs/${runId}`);
    const s = r.data?.status;
    if (s === 'SUCCEEDED') return;
    if (s === 'FAILED' || s === 'ABORTED') throw new Error(`Run ${s}`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Apify timeout');
}
