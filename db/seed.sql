-- ChitraVithika — Seed Data
-- Run after schema.sql to populate initial demo data.

-- Demo users (passwords: sha256 of 'password123')
INSERT OR IGNORE INTO users (id, email, name, role, password_hash) VALUES
('usr_admin', 'admin@chitravithika.com', 'Admin Root', 'admin', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'),
('usr_irina', 'irina@chitravithika.com', 'Irina Volkova', 'photographer', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'),
('usr_bjorn', 'bjorn@chitravithika.com', 'Björn Sigurðsson', 'photographer', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'),
('usr_solene', 'solene@chitravithika.com', 'Solène Armand', 'photographer', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'),
('usr_buyer1', 'buyer@chitravithika.com', 'Demo Buyer', 'buyer', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f');

-- Original 6 catalog photographs
INSERT OR IGNORE INTO photographs (id, title, description, artist, artist_id, category, tags, price, auction_floor, editions, remaining, width, height, color, filename) VALUES
(1, 'Veiled Dusk Over the Moors', 'A haunting landscape captured during golden hour, fog rolling across the moors.', 'Irina Volkova', 'usr_irina', 'landscape', '["fog","golden hour","moor","atmospheric","wide angle"]', 2400, 800, 5, 3, 6720, 4480, '#4A148C', 'veiled-dusk.jpg'),
(2, 'Neon Monsoon, Shibuya', 'Neon reflections shattered across rain-slicked Shibuya streets at midnight.', 'Irina Volkova', 'usr_irina', 'street', '["neon","rain","japan","urban","night"]', 1800, 600, 10, 7, 5472, 3648, '#E040FB', 'neon-monsoon.jpg'),
(3, 'Glacial Cathedral, Vatnajökull', 'Deep inside an ice cave — crystalline blue formations arching overhead.', 'Björn Sigurðsson', 'usr_bjorn', 'abstract', '["ice","glacier","blue","iceland","macro","crystal"]', 3200, 1000, 3, 2, 7360, 4912, '#0D47A1', 'glacial-cathedral.jpg'),
(4, 'Dust & Light, Rajasthan', 'Shafts of light pierce through floating dust in a centuries-old haveli.', 'Björn Sigurðsson', 'usr_bjorn', 'documentary', '["india","light","dust","architecture","warm"]', 2100, 700, 7, 4, 5616, 3744, '#F9A825', 'dust-light.jpg'),
(5, 'Chromatic Tide Pool', 'A macro study of a Pacific coast tide pool bursting with color.', 'Solène Armand', 'usr_solene', 'macro', '["ocean","macro","tide","colorful","sea","abstract"]', 1500, 500, 8, 6, 4928, 3264, '#00BCD4', 'chromatic-tide.jpg'),
(6, 'Midnight Canopy, Amazon', 'Looking straight up through the rainforest canopy at the Milky Way.', 'Solène Armand', 'usr_solene', 'landscape', '["forest","night","stars","amazon","canopy","milky way"]', 2700, 900, 4, 2, 6720, 4480, '#1B5E20', 'midnight-canopy.jpg');

-- Live auctions for all 6 photographs
INSERT OR IGNORE INTO auctions (id, photo_id, type, start_price, floor_price, current_price, decrement, interval_ms) VALUES
(1, 1, 'dutch', 2400, 800, 2400, 80, 10000),
(2, 2, 'dutch', 1800, 600, 1800, 60, 10000),
(3, 3, 'dutch', 3200, 1000, 3200, 110, 10000),
(4, 4, 'dutch', 2100, 700, 2100, 70, 10000),
(5, 5, 'dutch', 1500, 500, 1500, 50, 10000),
(6, 6, 'dutch', 2700, 900, 2700, 90, 10000);
