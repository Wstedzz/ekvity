const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const DIST = path.join(__dirname, 'dist');
const PUBLIC = path.join(__dirname, 'public');
const CACHE_FILE = path.join(__dirname, 'instagram-cache.json');
const IMG_CACHE_DIR = path.join(__dirname, 'instagram-images');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Ensure image cache dir exists
if (!fs.existsSync(IMG_CACHE_DIR)) fs.mkdirSync(IMG_CACHE_DIR);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.xml':  'application/xml; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// Invalidate cache on startup (force fresh fetch after deploy)
if (fs.existsSync(CACHE_FILE)) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    c.timestamp = 0;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(c));
  } catch (_) {}
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  // Cached image endpoint
  if (pathname.startsWith('/api/ig-img/')) {
    const filename = path.basename(pathname);
    const filePath = path.join(IMG_CACHE_DIR, filename);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
      res.end(data);
    });
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

  // Google Reviews proxy endpoint
  if (pathname === '/api/google-reviews') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const qs = new URLSearchParams(parsed.query || '');
    const placeId = qs.get('placeId');
    if (!placeId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'placeId is required' }));
      return;
    }
    if (!GOOGLE_API_KEY) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'GOOGLE_API_KEY not configured on server' }));
      return;
    }
    try {
      const reviews = await fetchGoogleReviews(placeId);
      res.end(JSON.stringify({ reviews }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  const rewrites = {
    '/katalog': '/katalog.html',
    '/constructor': '/constructor.html',
    '/admin': '/admin.html',
    '/blog': '/blog.html',
  };

  // Special: serve style.css directly from root (blog pages need it)
  if (pathname === '/style.css') {
    fs.readFile(path.join(__dirname, 'style.css'), (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(data);
    });
    return;
  }

  const rewritten = rewrites[pathname] || pathname;
  let filePath = path.join(DIST, rewritten === '/' ? 'index.html' : rewritten);

  // Blog article fallback — /blog/<slug> → dist/blog/<slug>/index.html
  if (!path.extname(filePath)) {
    const maybeIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(maybeIndex)) {
      filePath = maybeIndex;
    } else {
      filePath = path.join(DIST, 'index.html');
    }
  }

  const serveFile = (fp, cb) => fs.readFile(fp, (err, data) => cb(err, data, fp));

  serveFile(filePath, (err, data, fp) => {
    if (err) {
      // Fallback 1: try same path in public/ (for style.css, blog files, images)
      const publicPath = path.join(PUBLIC, path.relative(DIST, fp));
      serveFile(publicPath, (err2, data2, fp2) => {
        if (err2) {
          // Fallback 2: SPA index.html
          fs.readFile(path.join(DIST, 'index.html'), (err3, data3) => {
            if (err3) { res.writeHead(404); res.end('Not found'); return; }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(data3);
          });
          return;
        }
        const ext = path.extname(fp2);
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        if (ext !== '.html') res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(fp);
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

  const sorted = items
    .filter(i => i.displayUrl)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Download images locally
  const posts = await Promise.all(sorted.map(async (i, idx) => {
    const filename = `ig_${idx}.jpg`;
    const filePath = path.join(IMG_CACHE_DIR, filename);
    try {
      await downloadImage(i.displayUrl, filePath);
    } catch (e) {
      console.error('Image download failed:', e.message);
    }
    return {
      url: i.url,
      localImg: `/api/ig-img/${filename}`,
      caption: i.caption ? i.caption.slice(0, 120) : '',
      timestamp: i.timestamp,
    };
  }));

  fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), posts }));
  return { posts, cached: false };
}

// ===== Image downloader =====

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.instagram.com/',
      }
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
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

// ===== Google Reviews logic =====

function fetchGoogleReviews(placeId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ languageCode: 'uk' });
    const options = {
      hostname: 'places.googleapis.com',
      path: `/v1/places/${encodeURIComponent(placeId)}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'displayName,rating,reviews'
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.error) {
            reject(new Error(`Google API error: ${data.error.message || JSON.stringify(data.error)}`));
            return;
          }
          const reviews = (data.reviews || []).map(r => ({
            author_name: r.authorAttribution?.displayName || '',
            rating: r.rating || 5,
            text: r.text?.text || r.originalText?.text || '',
            relative_time: r.relativePublishTimeDescription || '',
            profile_photo: r.authorAttribution?.photoUri || '',
            publish_time: r.publishTime || ''
          }));
          resolve(reviews);
        } catch (e) {
          reject(new Error('Failed to parse Google response: ' + raw.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
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
