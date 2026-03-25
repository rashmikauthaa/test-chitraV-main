/**
 * ChitraVithika — Database Module (MongoDB / Mongoose)
 * Exposes a stable store API used by server.js.
 *
 * IMPORTANT: call  await store.connect()  before using any other method.
 * 
 * Images are stored in MongoDB using GridFS (no filesystem storage).
 */

'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { Readable } = require('stream');
const { User, Photograph, Auction, Bid, getNextSequence } = require('./models');

let gridFSBucket = null;

// ─── Config ──────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chitravithika';

const CONNECT_OPTS = {
    serverSelectionTimeoutMS: 10_000,
};

// ─── Connect ─────────────────────────────────────────────────

async function connect() {
    await mongoose.connect(MONGO_URI, CONNECT_OPTS);
    
    // Initialize GridFS bucket for image storage
    gridFSBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'images'
    });
    
    console.log(`[db] Connected to MongoDB: ${MONGO_URI.replace(/\/\/([^:@]+):([^@]+)@/, '//***:***@')}`);
    console.log('[db] GridFS bucket initialized for image storage');
}

// ─── Helpers ─────────────────────────────────────────────────

function formatPhoto(doc) {
    if (!doc) return null;
    const d = doc.toObject ? doc.toObject() : doc;
    return {
        id: d._id,
        title: d.title,
        description: d.description,
        artist: d._artist_name || d.artist || 'Anonymous',
        artistId: d.artist_id,
        category: d.category,
        tags: d.tags || [],
        price: d.price,
        auctionFloor: d.auction_floor,
        editions: d.editions,
        remaining: d.remaining,
        width: d.width,
        height: d.height,
        color: d.color,
        filename: d.saved_as || d.filename,
        saved_as: d.saved_as || null,
        gridfs_id: d.gridfs_id || null,
        fileSize: d.file_size,
        mimeType: d.mime_type || 'image/jpeg',
        exif: d.exif || { camera: null, lens: null, iso: null, aperture: null, shutter: null },
        createdAt: d.created_at,
    };
}

function formatAuction(doc) {
    if (!doc) return null;
    const d = doc.toObject ? doc.toObject() : doc;
    return {
        id: d._id,
        photo_id: d.photo_id,
        type: d.type,
        start_price: d.start_price,
        floor_price: d.floor_price,
        current_price: d.current_price,
        decrement: d.decrement,
        interval_ms: d.interval_ms,
        sold: d.sold ? 1 : 0,
        sold_price: d.sold_price,
        buyer_id: d.buyer_id,
        started_at: d.started_at,
        ended_at: d.ended_at,
        // Populated photo fields (from aggregate/populate)
        title: d._photo?.title || d.title,
        artist: d._photo?.artist || d.artist,
        color: d._photo?.color || d.color,
        category: d._photo?.category || d.category,
        filename: d._photo?.filename || d.filename,
        saved_as: d._photo?.saved_as || d.saved_as,
        original_price: d._photo?.price || d.original_price,
    };
}

// ─── Public API (same signatures as SQLite version) ──────────

module.exports = {
    connect,

    // Photographs
    async getPhotographs() {
        const photos = await Photograph.find().sort({ created_at: -1 }).lean();
        // Resolve artist names
        const artistIds = [...new Set(photos.map(p => p.artist_id).filter(Boolean))];
        const artists = await User.find({ _id: { $in: artistIds } }).lean();
        const artistMap = {};
        artists.forEach(a => { artistMap[a._id] = a.name; });

        return photos.map(p => {
            p._artist_name = artistMap[p.artist_id] || null;
            return formatPhoto(p);
        });
    },

    async getPhotograph(id) {
        const photo = await Photograph.findById(id).lean();
        if (!photo) return null;
        if (photo.artist_id) {
            const user = await User.findById(photo.artist_id).lean();
            if (user) photo._artist_name = user.name;
        }
        return formatPhoto(photo);
    },

    async insertPhotograph(data) {
        const id = await getNextSequence('photograph_id');
        const doc = await Photograph.create({
            _id: id,
            title: data.title,
            description: data.description || null,
            artist: data.artist,
            artist_id: data.artist_id || null,
            category: data.category || 'other',
            tags: data.tags || [],
            price: data.price,
            auction_floor: data.auction_floor || Math.round(data.price / 3),
            editions: data.editions || 1,
            remaining: data.remaining || data.editions || 1,
            width: data.width || null,
            height: data.height || null,
            color: data.color || '#888888',
            filename: data.filename || null,
            saved_as: data.saved_as || null,
            gridfs_id: data.gridfs_id || null,
            file_size: data.file_size || null,
            mime_type: data.mime_type || 'image/jpeg',
            exif: {
                camera: data.exif_camera || null,
                lens: data.exif_lens || null,
                iso: data.exif_iso || null,
                aperture: data.exif_aperture || null,
                shutter: data.exif_shutter || null,
            },
        });
        return doc._id;
    },

    // Users
    async getUserByEmail(email) {
        const user = await User.findOne({ email: email.toLowerCase() }).lean();
        if (!user) return null;
        return {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            password_hash: user.password_hash,
            created_at: user.created_at,
            last_active: user.last_active,
        };
    },

    async getUserById(id) {
        const user = await User.findById(id, 'email name role created_at last_active').lean();
        if (!user) return null;
        return { id: user._id, email: user.email, name: user.name, role: user.role, created_at: user.created_at, last_active: user.last_active };
    },

    async getUsers() {
        const users = await User.find({}, 'email name role created_at last_active').sort({ created_at: -1 }).lean();
        return users.map(u => ({ id: u._id, email: u.email, name: u.name, role: u.role, created_at: u.created_at, last_active: u.last_active }));
    },

    async createUser(data) {
        return User.create({
            _id: data.id,
            email: data.email.toLowerCase(),
            name: data.name,
            role: data.role || 'buyer',
            password_hash: data.password_hash,
        });
    },

    async touchUser(id) {
        await User.findByIdAndUpdate(id, { last_active: new Date() });
    },

    // Auctions
    async getAuctions() {
        const auctions = await Auction.find().sort({ started_at: -1 }).lean();
        const photoIds = [...new Set(auctions.map(a => a.photo_id))];
        const photos = await Photograph.find({ _id: { $in: photoIds } }).lean();
        const photoMap = {};
        photos.forEach(p => { photoMap[p._id] = p; });

        return auctions.map(a => {
            a._photo = photoMap[a.photo_id] || {};
            return formatAuction(a);
        });
    },

    async getAuctionByPhotoId(photoId) {
        const auction = await Auction.findOne({ photo_id: photoId }).lean();
        if (!auction) return null;
        const photo = await Photograph.findById(photoId).lean();
        auction._photo = photo || {};
        return formatAuction(auction);
    },

    async getAuctionById(id) {
        const auction = await Auction.findById(id).lean();
        if (!auction) return null;
        return { id: auction._id, photo_id: auction.photo_id, type: auction.type, start_price: auction.start_price, floor_price: auction.floor_price, current_price: auction.current_price, decrement: auction.decrement, interval_ms: auction.interval_ms, sold: auction.sold ? 1 : 0, sold_price: auction.sold_price, buyer_id: auction.buyer_id, started_at: auction.started_at, ended_at: auction.ended_at };
    },

    async updateAuctionPrice(id, price, sold) {
        await Auction.findByIdAndUpdate(id, { current_price: price, sold: !!sold });
    },

    async resetAuction(id) {
        const auction = await Auction.findById(id);
        if (auction) {
            auction.current_price = auction.start_price;
            auction.sold = false;
            await auction.save();
        }
    },

    async sellAuction(id, price, buyerId) {
        await Auction.findByIdAndUpdate(id, { sold: true, sold_price: price, buyer_id: buyerId, ended_at: new Date() });
    },

    async createAuction(data) {
        const id = await getNextSequence('auction_id');
        const doc = await Auction.create({
            _id: id,
            photo_id: data.photo_id,
            type: data.type || 'dutch',
            start_price: data.start_price,
            floor_price: data.floor_price,
            current_price: data.start_price,
            decrement: data.decrement || Math.round((data.start_price - data.floor_price) / 20),
            interval_ms: data.interval_ms || 10000,
        });
        return doc._id;
    },

    // Bids
    async getBidsForAuction(auctionId) {
        const bids = await Bid.find({ auction_id: auctionId }).sort({ placed_at: -1 }).lean();
        return bids.map(b => ({ id: b._id, auction_id: b.auction_id, user_id: b.user_id, user_name: b.user_name, amount: b.amount, accepted: b.accepted ? 1 : 0, placed_at: b.placed_at }));
    },

    async placeBid(data) {
        const id = await getNextSequence('bid_id');
        const doc = await Bid.create({
            _id: id,
            auction_id: data.auction_id,
            user_id: data.user_id || null,
            user_name: data.user_name || 'Anonymous',
            amount: data.amount,
            accepted: !!data.accepted,
        });
        return doc._id;
    },

    // Purchase - decrement remaining editions
    async purchaseEdition(photoId, buyerId) {
        const photo = await Photograph.findById(photoId);
        if (!photo) return { success: false, error: 'Photo not found' };
        if (photo.remaining <= 0) return { success: false, error: 'Sold out' };
        
        photo.remaining = photo.remaining - 1;
        await photo.save();
        
        return { 
            success: true, 
            remaining: photo.remaining, 
            soldOut: photo.remaining === 0 
        };
    },

    // Claim unclaimed photos for a user
    async claimUnclaimedPhotos(userId, userName) {
        const result = await Photograph.updateMany(
            { artist_id: null },
            { $set: { artist_id: userId, artist: userName } }
        );
        return { modified: result.modifiedCount };
    },

    // ─── GridFS Image Storage ─────────────────────────────────────

    // Upload image buffer to GridFS, returns the GridFS file ID
    async uploadImageToGridFS(buffer, filename, mimeType = 'image/jpeg') {
        if (!gridFSBucket) {
            throw new Error('GridFS bucket not initialized. Call connect() first.');
        }

        return new Promise((resolve, reject) => {
            const uploadStream = gridFSBucket.openUploadStream(filename, {
                contentType: mimeType,
                metadata: {
                    uploadedAt: new Date(),
                    originalName: filename,
                }
            });

            const readableStream = Readable.from(buffer);
            
            readableStream.pipe(uploadStream)
                .on('error', reject)
                .on('finish', () => {
                    console.log(`[gridfs] Uploaded: ${filename} → ${uploadStream.id}`);
                    resolve(uploadStream.id);
                });
        });
    },

    // Download image from GridFS by file ID, returns Buffer
    async downloadImageFromGridFS(fileId) {
        if (!gridFSBucket) {
            throw new Error('GridFS bucket not initialized. Call connect() first.');
        }

        const { ObjectId } = require('mongodb');
        const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;

        return new Promise((resolve, reject) => {
            const chunks = [];
            const downloadStream = gridFSBucket.openDownloadStream(objectId);

            downloadStream
                .on('data', chunk => chunks.push(chunk))
                .on('error', reject)
                .on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
        });
    },

    // Get GridFS file info by ID
    async getGridFSFileInfo(fileId) {
        if (!gridFSBucket) {
            throw new Error('GridFS bucket not initialized. Call connect() first.');
        }

        const { ObjectId } = require('mongodb');
        const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;

        const files = await gridFSBucket.find({ _id: objectId }).toArray();
        return files.length > 0 ? files[0] : null;
    },

    // Delete image from GridFS by file ID
    async deleteImageFromGridFS(fileId) {
        if (!gridFSBucket) {
            throw new Error('GridFS bucket not initialized. Call connect() first.');
        }

        const { ObjectId } = require('mongodb');
        const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;

        await gridFSBucket.delete(objectId);
        console.log(`[gridfs] Deleted: ${fileId}`);
    },

    // Close
    async close() {
        await mongoose.connection.close();
        console.log('[db] MongoDB connection closed');
    },
};
