const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Helper: fetch URL and return buffer (works even when global fetch has issues)
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const makeRequest = (reqUrl, redirects = 0) => {
            if (redirects > 5) return reject(new Error('Too many redirects'));
            https.get(reqUrl, { headers: { 'User-Agent': 'HandSpace/1.0 (Educational App)' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return makeRequest(res.headers.location, redirects + 1);
                }
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, buffer, contentType: res.headers['content-type'] || '' });
                });
                res.on('error', reject);
            }).on('error', reject);
        };
        makeRequest(url);
    });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Serve Static Files (Frontend)
const clientPath = path.join(__dirname, '../'); // Root is one level up
app.use(express.static(clientPath));

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/handspace';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/models', require('./routes/models'));
app.use('/api/quiz', require('./routes/quiz'));

// Config endpoint to serve API keys to frontend
app.get('/api/config', (req, res) => {
    res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        GEMINI_IMAGE_API_KEY: process.env.GEMINI_IMAGE_API_KEY || ''
    });
});

// Model name to Wikipedia search term mapping for better image results
const WIKI_SEARCH_MAP = {
    'human heart': 'Heart',
    'beating heart': 'Heart',
    'human lungs': 'Lung',
    'human kidney': 'Kidney',
    'colored brain': 'Human brain',
    'detailed brain': 'Human brain',
    'human skeleton': 'Human skeleton',
    'cross section eye': 'Human eye',
    'anatomical scan': 'Human anatomy',
    'full anatomy model': 'Human body',
    'benzene molecule': 'Benzene',
    'h2o molecule': 'Water molecule',
    'h2o detailed': 'Water molecule',
    'glucose molecule': 'Glucose',
    'co2 molecule': 'Carbon dioxide',
    'p orbitals': 'Atomic orbital',
    'earth core': 'Earth internal structure',
    'volcano': 'Volcano',
    'mars rover perseverance': 'Perseverance rover',
    'hubble telescope': 'Hubble Space Telescope',
    'james webb telescope': 'James Webb Space Telescope',
    'rocket ship': 'Rocket',
    'car engine': 'Internal combustion engine',
    'jet engine': 'Jet engine',
    'animal cell': 'Animal cell',
    'plant cell': 'Plant cell',
    'nucleus': 'Cell nucleus',
    'mitochondria': 'Mitochondrion',
    'chloroplast': 'Chloroplast',
};

function getWikiSearchTerm(subject) {
    const lower = subject.toLowerCase();
    // Check exact match first
    if (WIKI_SEARCH_MAP[lower]) return WIKI_SEARCH_MAP[lower];
    // Check partial match
    for (const [key, value] of Object.entries(WIKI_SEARCH_MAP)) {
        if (lower.includes(key) || key.includes(lower)) return value;
    }
    return subject;
}

// Cache of collected image URLs per subject to avoid re-fetching on regenerate
const imageCache = {};

// Image endpoint - fetches educational images from Wikipedia/Wikimedia Commons
app.get('/api/generate-image', async (req, res) => {
    const prompt = req.query.prompt;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    const variation = parseInt(req.query.variation) || 1;

    // Extract the model/subject name from the prompt
    const subjectMatch = prompt.match(/illustration of (.+?)(?:,|$)/i) || prompt.match(/of (.+?)(?:,|$)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : prompt.split(',')[0].trim();
    const wikiTerm = getWikiSearchTerm(subject);
    const cacheKey = wikiTerm.toLowerCase();

    console.log(`🎨 Fetching image for: "${subject}" → wiki: "${wikiTerm}" (variation ${variation})`);

    // If we already have cached URLs for this subject, pick a different one
    if (imageCache[cacheKey] && imageCache[cacheKey].length > 0) {
        const urls = imageCache[cacheKey];
        const idx = (variation - 1) % urls.length;
        console.log(`📦 Using cached image ${idx + 1}/${urls.length}`);
        try {
            const imgRes = await httpsGet(urls[idx]);
            if (imgRes.ok) {
                res.setHeader('Content-Type', imgRes.contentType || 'image/jpeg');
                return res.send(imgRes.buffer);
            }
        } catch (err) {
            console.warn('Cached image fetch failed, re-collecting...');
        }
    }

    // Collect all available image URLs from multiple sources
    const imageUrls = [];

    // Source 1: Wikipedia page summary
    try {
        const wikiTitle = wikiTerm.replace(/\s+/g, '_');
        const wikiRes = await httpsGet(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`);
        if (wikiRes.ok) {
            const data = JSON.parse(wikiRes.buffer.toString());
            if (data.originalimage?.source) imageUrls.push(data.originalimage.source);
        }
    } catch (err) {
        console.warn('Wikipedia summary failed:', err.message);
    }

    // Source 2: Wikipedia search (multiple related articles)
    try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(wikiTerm)}&gsrlimit=5&prop=pageimages&piprop=original|thumbnail&pithumbsize=768&format=json`;
        const searchRes = await httpsGet(searchUrl);
        if (searchRes.ok) {
            const data = JSON.parse(searchRes.buffer.toString());
            const pages = data.query?.pages ? Object.values(data.query.pages) : [];
            for (const page of pages) {
                const url = page.original?.source || page.thumbnail?.source;
                if (url && !imageUrls.includes(url)) imageUrls.push(url);
            }
        }
    } catch (err) {
        console.warn('Wikipedia search failed:', err.message);
    }

    // Source 3: Wikimedia Commons (diagrams, illustrations)
    try {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(wikiTerm + ' diagram')}&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=768&format=json`;
        const searchRes = await httpsGet(commonsUrl);
        if (searchRes.ok) {
            const data = JSON.parse(searchRes.buffer.toString());
            const pages = data.query?.pages ? Object.values(data.query.pages) : [];
            for (const page of pages) {
                const info = page.imageinfo?.[0];
                if (info && info.mime?.startsWith('image/')) {
                    const url = info.thumburl || info.url;
                    if (url && !imageUrls.includes(url)) imageUrls.push(url);
                }
            }
        }
    } catch (err) {
        console.warn('Wikimedia search failed:', err.message);
    }

    if (imageUrls.length === 0) {
        return res.status(503).json({ error: 'Could not find an image. Please try again later.' });
    }

    // Cache the collected URLs
    imageCache[cacheKey] = imageUrls;
    console.log(`📸 Found ${imageUrls.length} images for "${wikiTerm}"`);

    // Pick image based on variation
    const idx = (variation - 1) % imageUrls.length;
    try {
        const imgRes = await httpsGet(imageUrls[idx]);
        if (imgRes.ok) {
            res.setHeader('Content-Type', imgRes.contentType || 'image/jpeg');
            return res.send(imgRes.buffer);
        }
    } catch (err) {
        console.warn('Image download failed:', err.message);
    }

    // If selected image failed, try the first one that works
    for (const url of imageUrls) {
        try {
            const imgRes = await httpsGet(url);
            if (imgRes.ok) {
                res.setHeader('Content-Type', imgRes.contentType || 'image/jpeg');
                return res.send(imgRes.buffer);
            }
        } catch (e) { /* try next */ }
    }

    res.status(503).json({ error: 'Could not download any image.' });
});

// Fallback for SPA (Single Page App) behavior if needed,
// though we mostly have distinct html pages.
app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
