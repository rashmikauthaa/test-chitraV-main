/**
 * ChitraVithika — Backend Server (Production)
 * All data backed by MongoDB via Mongoose.
 *
 * Routes:
 *   GET  /                        → SPA shell (index.html)
 *   GET  /src/**                  → static JS/CSS source files
 *   GET  /public/**               → static assets
 *   GET  /api/catalog             → live photograph catalog from DB
 *   GET  /api/auction/stream      → SSE Dutch Auction state (DB-backed)
 *   GET  /api/image-preview/:id   → unencrypted image preview
 *   GET  /api/image/:id           → AES-256-GCM encrypted image stream
 *   POST /api/upload              → multipart upload + EXIF parse + DB insert
 *   POST /api/auth/login          → authenticate from DB
 *   POST /api/auth/register       → create user in DB
 *   GET  /api/auth/me             → current user info
 *   POST /api/bids/:id            → place bid, persist to DB
 *   GET  /*                       → SPA catch-all → index.html
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const events = require('events');
const store = require('./db/database.js');

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || `http://localhost:${PORT}`).replace(/\/$/, '');

const ROOT = __dirname;

/** 
 * Load photo file for an item - tries GridFS first, then falls back to filesystem.
 * This allows backward compatibility with existing filesystem-stored images.
 */
async function loadPhotoFileForItem(item) {
    if (!item) return null;
    
    // Try GridFS first (new storage method)
    if (item.gridfs_id) {
        try {
            const buffer = await store.downloadImageFromGridFS(item.gridfs_id);
            return { 
                buffer, 
                filename: item.filename || item.saved_as,
                mimeType: item.mimeType || 'image/jpeg'
            };
        } catch (err) {
            console.error(`[image] GridFS download failed for ${item.gridfs_id}:`, err.message);
        }
    }
    
    // Fallback to filesystem (legacy support)
    const names = [...new Set([item.saved_as, item.filename].filter((n) => n && String(n).trim()))];
    const subdirs = ['uploads', 'images'];
    for (const name of names) {
        for (const sub of subdirs) {
            const p = path.join(ROOT, 'public', sub, name);
            if (fs.existsSync(p)) {
                return { buffer: fs.readFileSync(p), filename: name };
            }
        }
    }
    return null;
}

function mimeFromFilename(filename) {
    const ext = path.extname(filename || '').toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    return 'image/jpeg';
}

// AES-256-GCM encryption shared secret
const MASTER_KEY = crypto.scryptSync('chitraVithika-secret-2026', 'cv-salt', 32);

// ─────────────────────────────────────────────────────────────
// SESSION TOKENS (in-memory — stateless, no persistence needed)
// ─────────────────────────────────────────────────────────────
const tokens = new Map(); // token → email

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function readJSON(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (e) { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

async function getUserFromRequest(req) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const email = tokens.get(token);
    if (!email) return null;
    const user = await store.getUserByEmail(email);
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };
}

// ─────────────────────────────────────────────────────────────
// MIME TYPE MAP
// ─────────────────────────────────────────────────────────────
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
    '.ttf': 'font/ttf', '.mp4': 'video/mp4',
};

// ─────────────────────────────────────────────────────────────
// ENSURE REQUIRED DIRECTORIES EXIST
// Note: public/uploads kept for backward compatibility with legacy filesystem images
// ─────────────────────────────────────────────────────────────
[
    path.join(ROOT, 'public'),
    path.join(ROOT, 'public', 'data'),
    path.join(ROOT, 'public', 'uploads'),
    path.join(ROOT, 'src'), path.join(ROOT, 'src', 'css'),
    path.join(ROOT, 'src', 'js'), path.join(ROOT, 'src', 'components'),
    path.join(ROOT, 'src', 'pages'), path.join(ROOT, 'src', 'workers'),
].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─────────────────────────────────────────────────────────────
// ENCRYPTION UTILITIES
// ─────────────────────────────────────────────────────────────
function encryptBuffer(plainBuffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
    return { iv, authTag: cipher.getAuthTag(), ciphertext };
}

// ─────────────────────────────────────────────────────────────
// DUTCH AUCTION ENGINE (DB-BACKED)
// ─────────────────────────────────────────────────────────────

const auctionBus = new events.EventEmitter();
auctionBus.setMaxListeners(1000);

/** In-memory auction states — synced FROM DB on boot, written TO DB on mutations */
const auctionStates = {};

async function initAuctions() {
    const auctions = await store.getAuctions();
    auctions.forEach(a => {
        auctionStates[a.photo_id] = {
            auctionId: a.id,
            itemId: a.photo_id,
            title: a.title,
            currentPrice: a.current_price,
            floor: a.floor_price,
            startPrice: a.start_price,
            decrement: a.decrement,
            startedAt: Date.now(),
            intervalMs: a.interval_ms,
            sold: !!a.sold,
        };
    });
    console.log(`[auction] Initialized ${auctions.length} auctions from DB`);
}

function tickAuctions() {
    const now = Date.now();
    Object.values(auctionStates).forEach(state => {
        if (state.sold) return;
        const elapsed = now - (state._lastTick || state.startedAt);
        if (elapsed >= state.intervalMs) {
            state.currentPrice = Math.max(state.floor, state.currentPrice - state.decrement);
            state._lastTick = now;

            // Persist price to DB (fire-and-forget async)
            store.updateAuctionPrice(state.auctionId, state.currentPrice, false).catch(e => console.error('[auction] price update error:', e.message));

            if (state.currentPrice <= state.floor) {
                state.sold = true;
                store.updateAuctionPrice(state.auctionId, state.currentPrice, true).catch(e => console.error('[auction] sold update error:', e.message));

                // Reset after 30s for demo
                setTimeout(() => {
                    state.currentPrice = state.startPrice;
                    state.sold = false;
                    state._lastTick = Date.now();
                    store.resetAuction(state.auctionId).catch(e => console.error('[auction] reset error:', e.message));
                }, 30_000);
            }
        }
    });

    const payload = {
        serverTimestamp: now,
        auctions: Object.values(auctionStates).map(s => ({
            itemId: s.itemId,
            title: s.title,
            currentPrice: s.currentPrice,
            floor: s.floor,
            sold: s.sold,
            intervalMs: s.intervalMs,
            nextDropIn: s._lastTick ? Math.max(0, s.intervalMs - (now - s._lastTick)) : s.intervalMs,
        })),
    };

    auctionBus.emit('tick', payload);
}

// Boot auctions from DB — called inside main()
// initAuctions(), setInterval, tickAuctions moved to main()

// ─────────────────────────────────────────────────────────────
// MULTIPART FORM-DATA PARSER
// ─────────────────────────────────────────────────────────────

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function parseMultipart(body, boundary) {
    const results = [];
    const delimiter = Buffer.from('--' + boundary);
    const parts = [];
    let start = 0;

    while (true) {
        const idx = body.indexOf(delimiter, start);
        if (idx === -1) break;
        if (start > 0) parts.push(body.slice(start, idx));
        start = idx + delimiter.length;
        // Skip \r\n after delimiter
        if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
        // Check for closing --
        if (body[start] === 0x2d && body[start + 1] === 0x2d) break;
    }

    for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const headerStr = part.slice(0, headerEnd).toString('utf8');
        const data = part.slice(headerEnd + 4);
        // Trim trailing \r\n
        const trimmed = (data.length >= 2 && data[data.length - 2] === 0x0d && data[data.length - 1] === 0x0a)
            ? data.slice(0, -2) : data;

        const headers = {};
        headerStr.split('\r\n').forEach(line => {
            const [key, ...vals] = line.split(':');
            if (key) headers[key.trim().toLowerCase()] = vals.join(':').trim();
        });

        const cd = headers['content-disposition'] || '';
        const nameMatch = cd.match(/name="([^"]+)"/);
        const fileMatch = cd.match(/filename="([^"]+)"/);

        results.push({
            headers,
            name: nameMatch ? nameMatch[1] : null,
            filename: fileMatch ? fileMatch[1] : null,
            data: trimmed,
        });
    }
    return results;
}

// ─────────────────────────────────────────────────────────────
// EXIF PARSER
// ─────────────────────────────────────────────────────────────

function parseExifFromBuffer(buf) {
    const exif = { camera: null, lens: null, iso: null, aperture: null, shutter: null };
    try {
        const ExifReader = require('exif-reader');
        // Find EXIF APP1 marker in JPEG
        let offset = 2; // skip SOI
        while (offset < buf.length - 4) {
            if (buf[offset] !== 0xFF) break;
            const marker = buf[offset + 1];
            const len = buf.readUInt16BE(offset + 2);
            if (marker === 0xE1) { // APP1
                const exifData = buf.slice(offset + 4, offset + 2 + len);
                if (exifData.slice(0, 4).toString('ascii') === 'Exif') {
                    const tiffOffset = 6; // skip 'Exif\0\0'
                    const parsed = ExifReader(exifData.slice(tiffOffset));
                    if (parsed.image) {
                        exif.camera = parsed.image.Make && parsed.image.Model
                            ? `${parsed.image.Make} ${parsed.image.Model}`.trim() : null;
                    }
                    if (parsed.exif) {
                        exif.iso = parsed.exif.ISO ? String(parsed.exif.ISO) : null;
                        exif.aperture = parsed.exif.FNumber ? `f/${parsed.exif.FNumber}` : null;
                        exif.shutter = parsed.exif.ExposureTime
                            ? (parsed.exif.ExposureTime < 1 ? `1/${Math.round(1 / parsed.exif.ExposureTime)}` : `${parsed.exif.ExposureTime}s`)
                            : null;
                        exif.lens = parsed.exif.LensModel || null;
                    }
                }
                break;
            }
            offset += 2 + len;
        }
    } catch (e) {
        // EXIF parsing is best-effort — not critical
        console.log('[exif] Parse attempt:', e.message || 'no EXIF data');
    }
    return exif;
}

// ─────────────────────────────────────────────────────────────
// STATIC FILE SERVER
// ─────────────────────────────────────────────────────────────

function serveStatic(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }
        res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600',
        });
        fs.createReadStream(filePath).pipe(res);
    });
}

// ─────────────────────────────────────────────────────────────
// REQUEST ROUTER
// ─────────────────────────────────────────────────────────────

async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const method = req.method.toUpperCase();
    const pname = url.pathname;

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    try {
        // ── Root → index.html ──────────────────────────────────
        if (pname === '/' && method === 'GET') {
            return serveStatic(res, path.join(ROOT, 'index.html'));
        }

        // ── Static source files ────────────────────────────────
        if (pname.startsWith('/src/') && method === 'GET') {
            const safe = path.normalize(pname).replace(/^(\.\.(\/|\\|$))+/, '');
            return serveStatic(res, path.join(ROOT, safe));
        }

        // ── Public assets ──────────────────────────────────────
        if (pname.startsWith('/public/') && method === 'GET') {
            const safe = path.normalize(pname).replace(/^(\.\.(\/|\\|$))+/, '');
            return serveStatic(res, path.join(ROOT, safe));
        }

        // ── GET /api/catalog — LIVE FROM DB ────────────────────
        if (pname === '/api/catalog' && method === 'GET') {
            const photos = await store.getPhotographs();
            const data = JSON.stringify(photos);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Cache-Control': 'no-cache',
            });
            return res.end(data);
        }

        // ── GET /api/auction/stream — SSE ──────────────────────
        if (pname === '/api/auction/stream' && method === 'GET') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            });

            res.write(': connected\n\n');

            const sendTick = (data) => {
                if (res.writableEnded) return;
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            // Immediately emit current state
            const now = Date.now();
            sendTick({
                serverTimestamp: now,
                auctions: Object.values(auctionStates).map(s => ({
                    itemId: s.itemId,
                    title: s.title,
                    currentPrice: s.currentPrice,
                    floor: s.floor,
                    sold: s.sold,
                    intervalMs: s.intervalMs,
                    nextDropIn: s._lastTick ? Math.max(0, s.intervalMs - (now - s._lastTick)) : s.intervalMs,
                })),
            });

            auctionBus.on('tick', sendTick);

            const heartbeat = setInterval(() => {
                if (!res.writableEnded) res.write(': heartbeat\n\n');
            }, 25_000);

            req.on('close', () => {
                auctionBus.off('tick', sendTick);
                clearInterval(heartbeat);
            });

            return;
        }

        // ── GET /api/image-preview/:id — Unencrypted Preview ───
        const previewMatch = pname.match(/^\/api\/image-preview\/(\d+)$/);
        if (previewMatch && method === 'GET') {
            const itemId = parseInt(previewMatch[1], 10);
            const item = await store.getPhotograph(itemId);

            if (!item) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Item not found' }));
            }

            const loaded = await loadPhotoFileForItem(item);
            let imageBuffer;
            let contentType;
            if (loaded) {
                imageBuffer = loaded.buffer;
                contentType = loaded.mimeType || mimeFromFilename(loaded.filename);
            } else {
                imageBuffer = generatePlaceholderJPEG(item.color || '#888888', item.title);
                contentType = 'image/bmp';
            }

            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': imageBuffer.length,
                'Cache-Control': 'public, max-age=3600',
            });
            return res.end(imageBuffer);
        }

        // ── GET /api/image/:id — Encrypted Image Stream ────────
        const imageMatch = pname.match(/^\/api\/image\/(\d+)$/);
        if (imageMatch && method === 'GET') {
            const itemId = parseInt(imageMatch[1], 10);
            const item = await store.getPhotograph(itemId);

            if (!item) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Item not found' }));
            }

            const loaded = await loadPhotoFileForItem(item);
            let imageBuffer;
            if (loaded) {
                imageBuffer = loaded.buffer;
            } else {
                imageBuffer = generatePlaceholderJPEG(item.color || '#888888', item.title);
            }

            const { iv, authTag, ciphertext } = encryptBuffer(imageBuffer);

            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': ciphertext.length,
                'Cache-Control': 'private, no-store',
                'X-IV': iv.toString('hex'),
                'X-Auth-Tag': authTag.toString('hex'),
                'Access-Control-Expose-Headers': 'X-IV, X-Auth-Tag',
            });

            return res.end(ciphertext);
        }

        // ── POST /api/upload — Multipart Upload + GridFS Storage ────
        if (pname === '/api/upload' && method === 'POST') {
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);

            if (!boundaryMatch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Missing boundary in Content-Type' }));
            }

            const uploadUser = await getUserFromRequest(req);
            const boundary = boundaryMatch[1];
            const body = await readBody(req);
            const parts = parseMultipart(body, boundary);

            // Extract form fields
            const fields = {};
            const files = [];
            for (const part of parts) {
                if (part.filename) {
                    files.push(part);
                } else if (part.name) {
                    fields[part.name] = part.data.toString('utf8');
                }
            }

            const saved = [];
            for (const filePart of files) {
                const ext = path.extname(filePart.filename).toLowerCase();
                const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
                if (!allowed.includes(ext)) continue;

                // Determine MIME type
                const mimeType = mimeFromFilename(filePart.filename);
                
                // Generate a unique filename for GridFS
                const gridfsFilename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
                
                // Upload to GridFS (MongoDB) instead of filesystem
                const gridfsId = await store.uploadImageToGridFS(
                    filePart.data, 
                    gridfsFilename, 
                    mimeType
                );

                // Parse EXIF
                const exif = parseExifFromBuffer(filePart.data);

                // Insert into DB with GridFS reference
                const photoId = await store.insertPhotograph({
                    title: fields.title || filePart.filename.replace(ext, ''),
                    description: fields.description || null,
                    artist: uploadUser?.name || fields.artist || 'Unknown',
                    artist_id: uploadUser?.id || null,
                    category: fields.category || 'other',
                    tags: fields.tags ? fields.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
                    price: parseFloat(fields.price) || 1500,
                    auction_floor: parseFloat(fields.floor) || 500,
                    editions: parseInt(fields.editions) || 5,
                    remaining: parseInt(fields.editions) || 5,
                    color: fields.color || '#888888',
                    filename: filePart.filename,
                    saved_as: gridfsFilename,
                    gridfs_id: gridfsId,
                    file_size: filePart.data.length,
                    mime_type: mimeType,
                    exif_camera: exif.camera,
                    exif_lens: exif.lens,
                    exif_iso: exif.iso,
                    exif_aperture: exif.aperture,
                    exif_shutter: exif.shutter,
                });

                // Create auction for this photograph
                const auctionId = await store.createAuction({
                    photo_id: photoId,
                    type: 'dutch',
                    start_price: parseFloat(fields.price) || 1500,
                    floor_price: parseFloat(fields.floor) || 500,
                });

                // Add to in-memory auction engine
                const price = parseFloat(fields.price) || 1500;
                const floor = parseFloat(fields.floor) || 500;
                auctionStates[photoId] = {
                    auctionId,
                    itemId: photoId,
                    title: fields.title || filePart.filename,
                    currentPrice: price,
                    floor: floor,
                    startPrice: price,
                    decrement: Math.round((price - floor) / 20),
                    startedAt: Date.now(),
                    intervalMs: 10_000,
                    sold: false,
                };

                saved.push({
                    id: photoId,
                    filename: filePart.filename,
                    savedAs: gridfsFilename,
                    gridfsId: gridfsId.toString(),
                    size: filePart.data.length,
                    artist: uploadUser?.name || 'Unknown',
                    artistId: uploadUser?.id || null,
                    exif,
                });

                console.log(`[upload] ${filePart.filename} → GridFS:${gridfsId} (${filePart.data.length}b) → photo#${photoId} auction#${auctionId}`);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ uploaded: saved }));
        }

        // ── POST /api/auth/login — DB-BACKED ───────────────────
        if (pname === '/api/auth/login' && method === 'POST') {
            const body = await readJSON(req);
            const { email, password } = body;
            if (!email || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Email and password are required' }));
            }
            const user = await store.getUserByEmail(email.toLowerCase());
            const hash = crypto.createHash('sha256').update(password).digest('hex');
            if (!user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid email or password' }));
            }
            if (!user.password_hash) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid email or password' }));
            }
            if (user.password_hash !== hash) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid email or password' }));
            }
            const token = generateToken();
            tokens.set(token, user.email);
            await store.touchUser(user.id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                user: { id: user.id, email: user.email, name: user.name, role: user.role },
                token,
            }));
        }

        // ── POST /api/auth/register — DB-BACKED ────────────────
        if (pname === '/api/auth/register' && method === 'POST') {
            const body = await readJSON(req);
            const { email, password, name, role } = body;
            if (!email || !password || !name) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Email, password, and name are required' }));
            }
            const existing = await store.getUserByEmail(email.toLowerCase());
            if (existing) {
                const msg = 'An account with this email already exists';
                res.writeHead(409, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: msg }));
            }
            const userRole = (role === 'photographer') ? 'photographer' : 'buyer';
            const hash = crypto.createHash('sha256').update(password).digest('hex');
            const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
            await store.createUser({ id, email, name, role: userRole, password_hash: hash });
            const token = generateToken();
            tokens.set(token, email.toLowerCase());
            console.log(`[auth] Registered: ${email} as ${userRole} → DB`);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                user: { id, email: email.toLowerCase(), name, role: userRole },
                token,
            }));
        }

        // ── GET /api/auth/me ───────────────────────────────────
        if (pname === '/api/auth/me' && method === 'GET') {
            const user = await getUserFromRequest(req);
            if (!user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ user }));
        }

        // ── POST /api/bids/:id — DB-BACKED ─────────────────────
        const bidMatch = pname.match(/^\/api\/bids\/(\d+)$/);
        if (bidMatch && method === 'POST') {
            const itemId = parseInt(bidMatch[1], 10);
            const auction = auctionStates[itemId];
            if (!auction) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Auction not found' }));
            }
            const body = await readJSON(req);
            const amount = parseFloat(body.amount);
            if (isNaN(amount) || amount <= 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid bid amount' }));
            }
            if (auction.sold) {
                res.writeHead(410, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Auction has already ended' }));
            }

            const bidUser = await getUserFromRequest(req);
            const accepted = amount >= auction.currentPrice;

            // Persist bid to DB
            await store.placeBid({
                auction_id: auction.auctionId,
                user_id: bidUser?.id || null,
                user_name: bidUser?.name || 'Anonymous',
                amount,
                accepted,
            });

            if (accepted) {
                auction.sold = true;
                auction.soldPrice = amount;
                await store.sellAuction(auction.auctionId, amount, bidUser?.id || null);
                console.log(`[bid] Item ${itemId} SOLD for $${amount} → DB`);

                // Reset after 30s for demo
                setTimeout(() => {
                    auction.currentPrice = auction.startPrice;
                    auction.sold = false;
                    auction._lastTick = Date.now();
                    store.resetAuction(auction.auctionId).catch(e => console.error('[bid] reset error:', e.message));
                }, 30_000);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                accepted,
                currentPrice: auction.currentPrice,
                sold: auction.sold,
            }));
        }

        // ── GET /api/users — All users (admin) ─────────────────
        if (pname === '/api/users' && method === 'GET') {
            const users = await store.getUsers();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(users));
        }

        // ── GET /api/auctions — All auctions ───────────────────
        if (pname === '/api/auctions' && method === 'GET') {
            const auctions = await store.getAuctions();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(auctions));
        }

        // ── GET /api/bids/:id — Bids for auction (id = photograph / catalog item id, same as POST) ──
        const bidsGetMatch = pname.match(/^\/api\/bids\/(\d+)$/);
        if (bidsGetMatch && method === 'GET') {
            const photoId = parseInt(bidsGetMatch[1], 10);
            const auction = await store.getAuctionByPhotoId(photoId);
            if (!auction) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Auction not found' }));
            }
            const bids = await store.getBidsForAuction(auction.id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(bids));
        }

        // ── POST /api/purchase/:id — Purchase an edition ─────────
        const purchaseMatch = pname.match(/^\/api\/purchase\/(\d+)$/);
        if (purchaseMatch && method === 'POST') {
            const photoId = parseInt(purchaseMatch[1], 10);
            const buyer = await getUserFromRequest(req);
            
            // For demo: allow purchase even without valid server token
            // In production, you'd want proper session management
            const buyerId = buyer?.id || null;
            
            const result = await store.purchaseEdition(photoId, buyerId);
            
            if (!result.success) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: result.error }));
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: true,
                remaining: result.remaining,
                soldOut: result.soldOut,
            }));
        }

        // ── POST /api/claim-photos — Claim all unclaimed photos for current user ─────────
        if (pname === '/api/claim-photos' && method === 'POST') {
            const user = await getUserFromRequest(req);
            
            // Try to get user info from request body if not authenticated
            let userId = user?.id;
            let userName = user?.name;
            
            if (!userId) {
                try {
                    const body = await readBody(req);
                    const data = JSON.parse(body.toString());
                    userId = data.userId;
                    userName = data.userName;
                } catch (e) {
                    // Ignore parse errors
                }
            }
            
            if (!userId || !userName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'User info required' }));
            }
            
            const result = await store.claimUnclaimedPhotos(userId, userName);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: true,
                claimed: result.modified,
            }));
        }

        // ── SPA Catch-All ──────────────────────────────────────
        if (method === 'GET' && !pname.startsWith('/api/')) {
            return serveStatic(res, path.join(ROOT, 'index.html'));
        }

        // ── 404 ────────────────────────────────────────────────
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `No route matched: ${method} ${pname}` }));

    } catch (err) {
        console.error('[server error]', err);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error', message: err.message }));
        }
    }
}

// ─────────────────────────────────────────────────────────────
// PLACEHOLDER JPEG GENERATOR
// ─────────────────────────────────────────────────────────────

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function generatePlaceholderJPEG(hexColor, label = '') {
    const [r, g, b] = hexToRgb(hexColor);
    const W = 800, H = 600;
    const pixels = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
        const x = (i % W) / W;
        const y = Math.floor(i / W) / H;
        const vignette = 1 - 0.5 * (Math.pow(x - 0.5, 2) + Math.pow(y - 0.5, 2)) * 4;
        pixels[i * 3] = Math.max(0, Math.min(255, Math.round(r * vignette)));
        pixels[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(g * vignette)));
        pixels[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(b * vignette)));
    }
    const fileSize = 54 + pixels.length;
    const bmp = Buffer.alloc(54);
    bmp.write('BM', 0, 'ascii');
    bmp.writeUInt32LE(fileSize, 2);
    bmp.writeUInt32LE(0, 6);
    bmp.writeUInt32LE(54, 10);
    bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(W, 18);
    bmp.writeInt32LE(-H, 22);
    bmp.writeUInt16LE(1, 26);
    bmp.writeUInt16LE(24, 28);
    bmp.writeUInt32LE(0, 30);
    bmp.writeUInt32LE(pixels.length, 34);
    bmp.writeInt32LE(2835, 38);
    bmp.writeInt32LE(2835, 42);
    bmp.writeUInt32LE(0, 46);
    bmp.writeUInt32LE(0, 50);
    return Buffer.concat([bmp, pixels]);
}

// ─────────────────────────────────────────────────────────────
// START SERVER (async boot for MongoDB)
// ─────────────────────────────────────────────────────────────

async function main() {
    // 1. Connect to MongoDB
    await store.connect();

    // 2. Initialize auctions from DB
    await initAuctions();
    setInterval(tickAuctions, 2_000);
    tickAuctions();

    // 3. Start HTTP server
    const server = http.createServer(handleRequest);

    server.listen(PORT, () => {
        console.log('');
        console.log('  ██████╗██╗  ██╗██╗████████╗██████╗  █████╗ ');
        console.log('  ██╔════╝██║  ██║██║╚══██╔══╝██╔══██╗██╔══██╗');
        console.log('  ██║     ███████║██║   ██║   ██████╔╝███████║');
        console.log('  ██║     ██╔══██║██║   ██║   ██╔══██╗██╔══██║');
        console.log('  ╚██████╗██║  ██║██║   ██║   ██║  ██║██║  ██║');
        console.log('   ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝');
        console.log('');
        console.log('  ██╗   ██╗██╗████████╗██╗  ██╗██╗██╗  ██╗ █████╗ ');
        console.log('  ██║   ██║██║╚══██╔══╝██║  ██║██║██║ ██╔╝██╔══██╗');
        console.log('  ██║   ██║██║   ██║   ███████║██║█████╔╝ ███████║');
        console.log('  ╚██╗ ██╔╝██║   ██║   ██╔══██║██║██╔═██╗ ██╔══██║');
        console.log('   ╚████╔╝ ██║   ██║   ██║  ██║██║██║  ██╗██║  ██║');
        console.log('    ╚═══╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝');
        console.log('');
        console.log(`  🌐  Server:  http://localhost:${PORT}`);
        console.log(`  📡  SSE:     http://localhost:${PORT}/api/auction/stream`);
        console.log(`  📷  Catalog: http://localhost:${PORT}/api/catalog`);
        console.log(`  🍃  Database: MongoDB (${process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chitravithika'})`);
        console.log('');
        console.log('  Production mode. All data persisted to MongoDB.');
        console.log('');
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[error] Port ${PORT} is already in use.`);
        } else {
            console.error('[server error]', err);
        }
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n[shutdown] Closing MongoDB connection...');
        await store.close();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await store.close();
        process.exit(0);
    });
}

// Crash protection — log but don't exit
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err.message);
    console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION]', reason);
});

// Boot!
main().catch(err => {
    console.error('[FATAL] Failed to start server:', err.message);
    process.exit(1);
});
