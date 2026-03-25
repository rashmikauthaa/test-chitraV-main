/**
 * ChitraVithika — Reactive State Store
 * localStorage-backed state with subscribe/notify pattern.
 * Slices: auth, collection, bids, cart, catalog (cache).
 */

const STORAGE_KEY = 'cv_state';
const listeners = new Map(); // key → Set<callback>

// ─── Default State ────────────────────────────────────────
const defaultState = {
    auth: {
        user: null,       // { id, email, name, role: 'buyer'|'photographer' }
        token: null,
        loggedIn: false,
    },
    collection: [],     // [{ itemId, title, artist, price, acquiredAt, license }]
    bids: {
        active: [],       // [{ itemId, amount, placedAt, type: 'open'|'silent' }]
        won: [],          // [{ itemId, title, artist, amount, wonAt }]
    },
    cart: null,         // { itemId, license, price } — single-item checkout
    catalog: [],        // cached catalog from API
};

// ─── State Initialization ────────────────────────────────
let _state;

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Merge with defaults to handle schema upgrades
            return { ...defaultState, ...parsed, auth: { ...defaultState.auth, ...parsed.auth }, bids: { ...defaultState.bids, ...parsed.bids } };
        }
    } catch (e) {
        console.warn('[state] Failed to load from localStorage:', e);
    }
    return { ...defaultState };
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
        console.warn('[state] Failed to save to localStorage:', e);
    }
}

_state = loadState();

// ─── Reactive API ─────────────────────────────────────────

/**
 * Get a state slice by key path, e.g. 'auth', 'auth.user', 'bids.active'
 */
export function getState(keyPath) {
    if (!keyPath) return _state;
    return keyPath.split('.').reduce((obj, key) => obj?.[key], _state);
}

/**
 * Set a state slice and notify subscribers.
 */
export function setState(keyPath, value) {
    const keys = keyPath.split('.');
    let target = _state;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]] || typeof target[keys[i]] !== 'object') {
            target[keys[i]] = {};
        }
        target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
    saveState();
    notify(keyPath);
}

/**
 * Subscribe to changes on a key path.
 * Returns an unsubscribe function.
 */
export function subscribe(keyPath, callback) {
    if (!listeners.has(keyPath)) listeners.set(keyPath, new Set());
    listeners.get(keyPath).add(callback);
    return () => listeners.get(keyPath)?.delete(callback);
}

function notify(keyPath) {
    // Notify exact match and parent paths
    listeners.forEach((cbs, key) => {
        if (keyPath.startsWith(key) || key.startsWith(keyPath)) {
            const val = getState(key);
            cbs.forEach(cb => {
                try { cb(val); } catch (e) { console.warn('[state] Subscriber error:', e); }
            });
        }
    });
}

// ─── Auth Actions ─────────────────────────────────────────

export async function login(email, password) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    setState('auth', {
        user: data.user,
        token: data.token,
        loggedIn: true,
    });

    // Claim any unclaimed photos for this user and refresh catalog
    try {
        await fetch('/api/claim-photos', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}` 
            },
            body: JSON.stringify({ userId: data.user.id, userName: data.user.name }),
        });
        const catalogRes = await fetch('/api/catalog');
        if (catalogRes.ok) {
            const freshCatalog = await catalogRes.json();
            setState('catalog', freshCatalog);
        }
    } catch (e) {
        console.warn('[login] Failed to claim photos:', e);
    }

    return data.user;
}

export async function register(userData) {
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(err.error || 'Registration failed');
    }

    const data = await res.json();
    setState('auth', {
        user: data.user,
        token: data.token,
        loggedIn: true,
    });
    return data.user;
}

export async function loginWithGoogle() {
    // Dynamically import Firebase module
    const { signInWithGoogle, signOut: firebaseSignOut } = await import('./firebase.js');
    
    try {
        const googleUser = await signInWithGoogle();
        
        // Send to our backend to create/link user
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: googleUser.uid,
                email: googleUser.email,
                name: googleUser.name,
                photoURL: googleUser.photoURL,
            }),
        });

        if (!res.ok) {
            await firebaseSignOut();
            const err = await res.json().catch(() => ({ error: 'Google login failed' }));
            throw new Error(err.error || 'Google login failed');
        }

        const data = await res.json();
        setState('auth', {
            user: data.user,
            token: data.token,
            loggedIn: true,
        });

        // Claim any unclaimed photos for this user and refresh catalog
        try {
            await fetch('/api/claim-photos', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.token}` 
                },
                body: JSON.stringify({ userId: data.user.id, userName: data.user.name }),
            });
            const catalogRes = await fetch('/api/catalog');
            if (catalogRes.ok) {
                const freshCatalog = await catalogRes.json();
                setState('catalog', freshCatalog);
            }
        } catch (e) {
            console.warn('[loginWithGoogle] Failed to claim photos:', e);
        }

        return data.user;
    } catch (error) {
        console.error('[state] Google login error:', error);
        throw error;
    }
}

export function logout() {
    // Also sign out from Firebase if applicable
    import('./firebase.js').then(({ signOut }) => signOut()).catch(() => {});
    setState('auth', { user: null, token: null, loggedIn: false });
}

export function isLoggedIn() {
    return _state.auth.loggedIn && _state.auth.user !== null;
}

export function currentUser() {
    return _state.auth.user;
}

export function getAuthToken() {
    return _state.auth.token;
}

export function requireAuth(role = null) {
    if (!isLoggedIn()) return false;
    if (role && _state.auth.user?.role !== role) return false;
    return true;
}

// ─── Collection Actions ──────────────────────────────────

export function addToCollection(item) {
    const existing = _state.collection.find(c => c.itemId === item.itemId);
    if (existing) return; // already in collection
    const entry = {
        itemId: item.itemId,
        title: item.title,
        artist: item.artist,
        price: item.price,
        license: item.license || 'personal',
        acquiredAt: Date.now(),
        color: item.color || '#888',
    };
    setState('collection', [..._state.collection, entry]);
}

export function removeFromCollection(itemId) {
    setState('collection', _state.collection.filter(c => c.itemId !== itemId));
}

// ─── Bid Actions ──────────────────────────────────────────

export function placeBid(itemId, amount, type = 'open') {
    const bid = { itemId, amount, placedAt: Date.now(), type };
    setState('bids.active', [..._state.bids.active, bid]);
    return bid;
}

export function winBid(itemId, title, artist, amount) {
    // Move from active to won
    setState('bids.active', _state.bids.active.filter(b => b.itemId !== itemId));
    setState('bids.won', [..._state.bids.won, { itemId, title, artist, amount, wonAt: Date.now() }]);
}

/** Merge server dashboard into local state (buyer). */
export function applyDashboardPayload(data) {
    if (!data) return;
    const local = _state.collection || [];
    const byId = new Map(local.map((c) => [c.itemId, c]));
    for (const c of data.collection || []) {
        const id = c.itemId;
        if (!byId.has(id)) {
            byId.set(id, {
                itemId: id,
                title: c.title,
                artist: c.artist,
                price: c.price,
                license: c.license || 'commercial',
                acquiredAt: c.acquiredAt || Date.now(),
                color: c.color || '#888',
            });
        }
    }
    setState('collection', [...byId.values()]);

    const active = (data.activeBids || []).map((r) => ({
        bidId: r.id,
        itemId: r.itemId,
        amount: r.amount,
        type: r.type || 'open',
        placedAt: r.placed_at ? new Date(r.placed_at).getTime() : Date.now(),
        bid_status: r.bid_status,
        title: r.title,
    }));
    setState('bids.active', active);

    const won = (data.wonAuctions || []).map((r) => ({
        itemId: r.itemId,
        title: r.title,
        artist: r.artist,
        amount: r.amount,
        wonAt: r.wonAt ? new Date(r.wonAt).getTime() : Date.now(),
    }));
    setState('bids.won', won);
}

export async function syncBuyerDashboardFromApi() {
    const token = _state.auth.token;
    if (!token) return null;
    const res = await fetch('/api/me/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    applyDashboardPayload(data);
    return data;
}

// ─── Cart Actions ─────────────────────────────────────────

export function setCart(item) {
    setState('cart', item);
}

export function clearCart() {
    setState('cart', null);
}

// ─── Catalog Cache ────────────────────────────────────────

export function setCatalog(catalog) {
    setState('catalog', catalog);
}

export function getCatalog() {
    return _state.catalog || [];
}

export function getCatalogItem(id) {
    return (_state.catalog || []).find(item => item.id === parseInt(id, 10));
}

// ─── Artist Helpers ────────────────────────────────────────

export function getArtists() {
    const map = new Map();
    for (const item of (_state.catalog || [])) {
        if (!map.has(item.artist)) {
            map.set(item.artist, { name: item.artist, works: [], color: item.color, id: slugify(item.artist) });
        }
        map.get(item.artist).works.push(item);
    }
    return [...map.values()];
}

export function getArtistById(slug) {
    return getArtists().find(a => a.id === slug);
}

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
