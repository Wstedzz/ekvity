const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8080;
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const CACHE_FILE = path.join(__dirname, 'instagram-cache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Serve static files from dist/ (vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Instagram API endpoint
app.get('/api/instagram', async (req, res) => {
  try {
    // Check cache
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const age = Date.now() - cache.timestamp;
      if (age < CACHE_TTL && cache.posts && cache.posts.length > 0) {
        return res.json({ posts: cache.posts, cached: true, age: Math.round(age / 60000) + 'min' });
      }
    }

    if (!APIFY_TOKEN) {
      return res.status(500).json({ error: 'APIFY_TOKEN not set' });
    }

    // Run Apify scraper
    const runData = await apifyPost('/v2/acts/apify~instagram-scraper/runs', {
      directUrls: ['https://www.instagram.com/ekvity.ua/'],
      resultsType: 'posts',
      resultsLimit: 9,
      addParentData: false
    });

    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    // Wait for run to finish (max 60s)
    await waitForRun(runId, 60000);

    // Fetch results
    const items = await apifyGet(`/v2/datasets/${datasetId}/items?limit=9`);

    const posts = items
      .filter(item => item.displayUrl)
      .map(item => ({
        url: item.url,
        displayUrl: item.displayUrl,
        caption: item.caption ? item.caption.slice(0, 120) : '',
        likesCount: item.likesCount || 0,
        timestamp: item.timestamp
      }));

    // Save cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), posts }));

    res.json({ posts, cached: false });
  } catch (err) {
    console.error('Instagram API error:', err.message);

    // Return stale cache if available
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (cache.posts) {
        return res.json({ posts: cache.posts, cached: true, stale: true });
      }
    }

    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- Apify helpers ---

function apifyRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = `https://api.apify.com${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${APIFY_TOKEN}`;
    const parsed = new URL(url);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Invalid JSON: ' + raw.slice(0, 200))); }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function apifyPost(endpoint, body) {
  return apifyRequest('POST', endpoint, body);
}

function apifyGet(endpoint) {
  return apifyRequest('GET', endpoint).then(res => Array.isArray(res) ? res : (res.data?.items || []));
}

async function waitForRun(runId, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await apifyRequest('GET', `/v2/actor-runs/${runId}`);
    const status = run.data?.status;
    if (status === 'SUCCEEDED') return;
    if (status === 'FAILED' || status === 'ABORTED') throw new Error(`Run ${status}`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Apify run timeout');
}
