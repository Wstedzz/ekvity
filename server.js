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

// Supabase config (for persistent IG cache)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ighzhuqolvwjmlzrxqzj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnaHpodXFvbHZ3am1senJ4cXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjcxNTcsImV4cCI6MjA4NzM0MzE1N30.sSITN_jroTKIzy15tr6_BfSHnZi7XVFtqB7_95k4xzM';

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

// Local file cache is ephemeral on Railway — Supabase is the persistent store.
// On startup, try to warm local cache from Supabase so first request is fast.
(async () => {
  try {
    const remote = await supabaseGetIgCache();
    if (remote && remote.posts?.length > 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(remote));
      console.log(`[IG] Warmed local cache from Supabase (${remote.posts.length} posts, age: ${Math.round((Date.now() - remote.timestamp) / 3600000)}h)`);
    }
  } catch (e) {
    console.warn('[IG] Could not warm cache from Supabase:', e.message);
  }
})();

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

  // Google Place Search endpoint
  if (pathname === '/api/google-place-search') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const qs = new URLSearchParams(parsed.query || '');
    const query = qs.get('q');
    if (!query) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'q (search query) is required' }));
      return;
    }
    if (!GOOGLE_API_KEY) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'GOOGLE_API_KEY not configured on server' }));
      return;
    }
    try {
      const places = await searchGooglePlaces(query);
      res.end(JSON.stringify({ places }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Product page /p/:id
  if (pathname.startsWith('/p/')) {
    const productId = decodeURIComponent(pathname.slice(3));
    if (!productId) {
      res.writeHead(302, { Location: '/katalog' });
      res.end();
      return;
    }
    try {
      const product = await supabaseFetchProduct(productId);
      if (!product) {
        res.writeHead(302, { Location: '/katalog' });
        res.end();
        return;
      }
      const html = generateProductPage(product);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } catch (e) {
      res.writeHead(302, { Location: '/katalog' });
      res.end();
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

  // Serve sitemap.xml, robots.txt and favicons from public/
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt' ||
      pathname === '/favicon.ico' || pathname === '/favicon.png' ||
      pathname === '/favicon-32.png' || pathname === '/favicon-192.png' || pathname === '/favicon-512.png') {
    const pubFile = path.join(PUBLIC, pathname);
    fs.readFile(pubFile, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(pathname);
      const ct = pathname.endsWith('.ico') ? 'image/x-icon' : (MIME[ext] || 'text/plain');
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=86400');
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

// ===== Supabase helpers =====

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : '',
      }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(body ? JSON.parse(body) : null); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function supabaseGetIgCache() {
  try {
    const rows = await supabaseRequest('GET', '/rest/v1/instagram_cache?select=*&limit=1');
    if (rows && rows[0]) return rows[0].data;
    return null;
  } catch { return null; }
}

async function supabaseSetIgCache(cacheObj) {
  try {
    await supabaseRequest('POST', '/rest/v1/instagram_cache', { id: 1, data: cacheObj });
  } catch (e) {
    console.warn('[IG] Supabase write failed:', e.message);
  }
}

// ===== Instagram logic =====

async function getInstagramPosts() {
  // 1. Check local file cache (fast, in-memory equivalent)
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (Date.now() - cache.timestamp < CACHE_TTL && cache.posts?.length > 0) {
        return { posts: cache.posts, cached: true };
      }
    } catch (_) {}
  }

  // 2. Check Supabase (survives deploys)
  const remote = await supabaseGetIgCache();
  if (remote && Date.now() - remote.timestamp < CACHE_TTL && remote.posts?.length > 0) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(remote));
    console.log('[IG] Served from Supabase cache');
    return { posts: remote.posts, cached: true };
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

  const cacheObj = { timestamp: Date.now(), posts };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObj));
  await supabaseSetIgCache(cacheObj);
  console.log('[IG] Cache saved to file + Supabase');
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

function searchGooglePlaces(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ textQuery: query });
    const options = {
      hostname: 'places.googleapis.com',
      path: '/v1/places:searchText',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount'
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
          const places = (data.places || []).map(p => ({
            placeId: p.id || '',
            name: p.displayName?.text || '',
            address: p.formattedAddress || '',
            rating: p.rating || 0,
            totalReviews: p.userRatingCount || 0
          }));
          resolve(places);
        } catch (e) {
          reject(new Error('Failed to parse Google response: ' + raw.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
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

async function supabaseFetchProduct(id) {
  try {
    const rows = await supabaseRequest('GET', `/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

function generateProductPage(p) {
  const mainImg = (p.images && p.images.length) ? p.images[0] : (p.image || '');
  const allImgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  const price = p.price ? `${p.price} UAH` : '';
  const desc = p.desc ? p.desc.replace(/<[^>]*>/g, '').slice(0, 160) : `${p.name} — ${price}. Замовлення через Telegram або Viber.`;
  const orderMsg = encodeURIComponent(`Вітаю! Хочу замовити:\n${p.name} (ID: ${p.id})\nЦіна: ${p.price} грн`);
  const tgLink = `https://t.me/ekvityua?text=${orderMsg}`;
  const waLink = `https://wa.me/380980488437?text=${orderMsg}`;
  const vbLink = `viber://chat?number=%2B380980488437&text=${orderMsg}`;

  const imagesHtml = allImgs.length > 1 ? `
    <div class="prod-thumbs">
      ${allImgs.map((src, i) => `<img src="${escHtml(src)}" class="thumb${i === 0 ? ' active' : ''}" onclick="setMainImg('${escHtml(src)}')" alt="${escHtml(p.name)}">`).join('')}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-BB1GT325B9"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-BB1GT325B9');</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(p.name)} — ЄКвіти Львів</title>
<meta name="description" content="${escHtml(desc)}">
<meta property="og:title" content="${escHtml(p.name)} — ЄКвіти Львів">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:image" content="${escHtml(mainImg)}">
<meta property="og:url" content="https://ekvity.co.ua/p/${escHtml(p.id)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="ЄКвіти">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Montserrat:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050505;color:#e0e0e0;font-family:'Montserrat',sans-serif;font-weight:300;min-height:100vh;display:flex;flex-direction:column}
a{color:inherit;text-decoration:none}
.top-bar{padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:16px}
.top-bar a{font-size:0.7rem;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase}
.top-bar a:hover{color:rgba(255,255,255,0.7)}
.back-arrow{font-size:1.1rem;color:rgba(255,255,255,0.3)}
.prod-wrap{flex:1;display:flex;flex-direction:column;align-items:center;padding:32px 20px 48px;max-width:520px;margin:0 auto;width:100%}
.prod-img-wrap{width:100%;position:relative;aspect-ratio:4/5;background:#0a0a0a;overflow:hidden;margin-bottom:20px}
.prod-img-wrap img#mainImg{width:100%;height:100%;object-fit:cover}
.prod-thumbs{display:flex;gap:8px;margin-bottom:20px;width:100%}
.prod-thumbs img{width:56px;height:56px;object-fit:cover;cursor:pointer;opacity:0.5;transition:opacity 0.2s;border:1px solid transparent}
.prod-thumbs img.active,.prod-thumbs img:hover{opacity:1;border-color:rgba(255,255,255,0.3)}
.prod-cat{font-size:0.6rem;letter-spacing:3px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:10px;border-left:1px solid rgba(255,255,255,0.15);padding-left:10px}
.prod-name{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:400;color:#fff;line-height:1.15;margin-bottom:12px}
.prod-price{font-family:'Playfair Display',serif;font-style:italic;color:#d4a373;font-size:1.2rem;margin-bottom:8px}
.prod-id{font-size:0.65rem;color:#333;font-family:monospace;margin-bottom:20px}
.prod-desc{font-size:0.85rem;color:rgba(255,255,255,0.5);line-height:1.7;margin-bottom:28px}
.prod-actions{display:flex;flex-direction:column;gap:10px;width:100%}
.btn-tg,.btn-vb,.btn-wa{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 20px;border-radius:0;font-size:0.75rem;letter-spacing:2px;text-transform:uppercase;font-family:'Montserrat',sans-serif;font-weight:500;cursor:pointer;border:1px solid;transition:opacity 0.2s}
.btn-tg{background:rgba(0,136,204,0.1);border-color:rgba(0,136,204,0.4);color:#e0e0e0}
.btn-tg:hover{background:rgba(0,136,204,0.2);border-color:rgba(0,136,204,0.7)}
.btn-vb{background:rgba(115,96,242,0.1);border-color:rgba(115,96,242,0.4);color:#e0e0e0}
.btn-vb:hover{background:rgba(115,96,242,0.2);border-color:rgba(115,96,242,0.7)}
.btn-wa{background:rgba(37,211,102,0.08);border-color:rgba(37,211,102,0.3);color:#e0e0e0}
.btn-wa:hover{background:rgba(37,211,102,0.15);border-color:rgba(37,211,102,0.6)}
.footer-bar{padding:14px;text-align:center;border-top:1px solid rgba(255,255,255,0.04)}
.footer-bar a{font-size:0.6rem;letter-spacing:3px;color:rgba(255,255,255,0.15);text-transform:uppercase}
.footer-bar a:hover{color:rgba(255,255,255,0.4)}
@media(max-width:480px){.prod-wrap{padding:20px 16px 40px}.prod-name{font-size:1.4rem}.prod-price{font-size:1rem}.btn-tg,.btn-vb,.btn-wa{padding:12px 16px;font-size:0.65rem}.top-bar{padding:14px 16px}}
</style>
</head>
<body>
<div class="top-bar">
  <span class="back-arrow">←</span>
  <a href="/katalog">Каталог</a>
  <span style="color:rgba(255,255,255,0.15)">·</span>
  <a href="/">ЄКвіти</a>
</div>
<div class="prod-wrap">
  <div class="prod-img-wrap">
    <img id="mainImg" src="${escHtml(mainImg)}" alt="${escHtml(p.name)}">
  </div>
  ${imagesHtml}
  ${p.category ? `<div class="prod-cat">${escHtml(p.category)}</div>` : ''}
  <h1 class="prod-name">${escHtml(p.name)}</h1>
  ${price ? `<div class="prod-price">${escHtml(price)}</div>` : ''}
  <div class="prod-id">ID: ${escHtml(p.id)}</div>
  ${p.desc ? `<div class="prod-desc">${p.desc.replace(/<[^>]*>/g, '')}</div>` : ''}
  <div class="prod-actions">
    <a class="btn-tg" href="${tgLink}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.117 13.5l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.83.959z"/></svg>
      Замовити в Telegram
    </a>
    <a class="btn-vb" href="${vbLink}">
      <svg width="18" height="18" viewBox="0 0 632 666" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M560.65 65C544.09 49.72 477.17 1.14 328.11.48c0 0-175.78-10.6-261.47 68C18.94 116.19 2.16 186 .39 272.55S-3.67 521.3 152.68 565.28l.15.02-.1 67.11s-1 27.17 16.89 32.71c21.64 6.72 34.34-13.93 55-36.19 11.34-12.22 27-30.17 38.8-43.89 106.93 9 189.17-11.57 198.51-14.61 21.59-7 143.76-22.65 163.63-184.84C646.07 218.4 615.64 112.66 560.65 65zm18.12 308.58C562 509 462.91 517.51 444.64 523.37c-7.77 2.5-80 20.47-170.83 14.54 0 0-67.68 81.65-88.82 102.88-3.3 3.32-7.18 4.66-9.77 4-3.64-.89-4.64-5.2-4.6-11.5.06-9 .58-111.52.58-111.52C38.94 485.05 46.65 347 48.15 274.71S63.23 143.2 103.57 103.37c72.48-65.65 221.79-55.84 221.79-55.84 126.09.55 186.51 38.52 200.52 51.24C572.4 138.6 596.1 233.91 578.77 373.54zM340.76 381.68s11.85 1 18.23-6.86l12.44-15.65c6-7.76 20.48-12.71 34.66-4.81A366.67 366.67 0 0 1 437 374.1c9.41 6.92 28.68 23 28.74 23 9.18 7.75 11.3 19.13 5.05 31.13 0 .07-.05.19-.05.25a129.81 129.81 0 0 1-25.89 31.88c-.12.06-.12.12-.23.18q-13.38 11.18-26.29 12.71a17.39 17.39 0 0 1-3.84.24 35 35 0 0 1-11.18-1.72l-.28-.41c-13.26-3.74-35.4-13.1-72.27-33.44a430.39 430.39 0 0 1-60.72-40.11 318.31 318.31 0 0 1-27.31-24.22l-.92-.92-.92-.92-.92-.93-.92-.92a318.31 318.31 0 0 1-24.22-27.31 430.83 430.83 0 0 1-40.11-60.71c-20.34-36.88-29.7-59-33.44-72.28l-.41-.28a35 35 0 0 1-1.71-11.18 16.87 16.87 0 0 1 .23-3.84Q141 181.42 152.12 168c.06-.11.12-.11.18-.23a129.53 129.53 0 0 1 31.88-25.88c.06 0 .18-.06.25-.06 12-6.25 23.38-4.13 31.12 5 .06.06 16.11 19.33 23 28.74a366.67 366.67 0 0 1 19.74 30.94c7.9 14.17 2.95 28.68-4.81 34.66l-15.65 12.44c-7.9 6.38-6.86 18.23-6.86 18.23S254.15 359.57 340.76 381.68z"/></svg>
      Замовити у Viber
    </a>
    <a class="btn-wa" href="${waLink}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
      Замовити в WhatsApp
    </a>
  </div>
</div>
<div class="footer-bar"><a href="mailto:hello@avern.studio">POWERED BY AVERN.STUDIO</a></div>
<script>
function setMainImg(src) {
  document.getElementById('mainImg').src = src;
  document.querySelectorAll('.prod-thumbs img').forEach(i => i.classList.toggle('active', i.src.endsWith(src.split('/').pop())));
}
</script>
</body>
</html>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
