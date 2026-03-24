-- ChitraVithika — Production Schema
-- SQLite (better-sqlite3)

CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'buyer' CHECK(role IN ('buyer','photographer','admin')),
    password_hash TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_active TEXT
);

CREATE TABLE IF NOT EXISTS photographs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    artist      TEXT NOT NULL,
    artist_id   TEXT REFERENCES users(id),
    category    TEXT NOT NULL DEFAULT 'other',
    tags        TEXT DEFAULT '[]',           -- JSON array
    price       REAL NOT NULL,
    auction_floor REAL NOT NULL DEFAULT 0,
    editions    INTEGER NOT NULL DEFAULT 1,
    remaining   INTEGER NOT NULL DEFAULT 1,
    width       INTEGER,
    height      INTEGER,
    color       TEXT DEFAULT '#888888',
    filename    TEXT,                        -- original upload name
    saved_as    TEXT,                        -- on-disk name in public/uploads/
    file_size   INTEGER,
    exif_camera TEXT,
    exif_lens   TEXT,
    exif_iso    TEXT,
    exif_aperture TEXT,
    exif_shutter  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auctions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id    INTEGER NOT NULL REFERENCES photographs(id),
    type        TEXT NOT NULL DEFAULT 'dutch' CHECK(type IN ('dutch','english','silent')),
    start_price REAL NOT NULL,
    floor_price REAL NOT NULL,
    current_price REAL NOT NULL,
    decrement   REAL NOT NULL DEFAULT 0,
    interval_ms INTEGER NOT NULL DEFAULT 10000,
    sold        INTEGER NOT NULL DEFAULT 0,
    sold_price  REAL,
    buyer_id    TEXT REFERENCES users(id),
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at    TEXT
);

CREATE TABLE IF NOT EXISTS bids (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    auction_id  INTEGER NOT NULL REFERENCES auctions(id),
    user_id     TEXT REFERENCES users(id),
    user_name   TEXT,
    amount      REAL NOT NULL,
    accepted    INTEGER NOT NULL DEFAULT 0,
    placed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_photos_artist ON photographs(artist_id);
CREATE INDEX IF NOT EXISTS idx_photos_category ON photographs(category);
CREATE INDEX IF NOT EXISTS idx_auctions_photo ON auctions(photo_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
