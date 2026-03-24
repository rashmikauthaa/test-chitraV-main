/**
 * ChitraVithika — Mongoose Models
 * Defines schemas for Users, Photographs, Auctions, and Bids.
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Counter Schema (for auto-incrementing integer IDs) ──────
const counterSchema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', counterSchema);

async function getNextSequence(name) {
    const counter = await Counter.findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}

// ─── User Schema ─────────────────────────────────────────────
const userSchema = new Schema({
    _id: { type: String },                                    // 'usr_xxx' format kept
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['buyer', 'photographer', 'admin'], default: 'buyer' },
    password_hash: { type: String, default: null },
    last_active: { type: Date, default: null },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

// email index created automatically by unique: true

// ─── Photograph Schema ───────────────────────────────────────
const photographSchema = new Schema({
    _id: { type: Number },                                     // auto-increment integer
    title: { type: String, required: true },
    description: { type: String, default: null },
    artist: { type: String, required: true },
    artist_id: { type: String, ref: 'User', default: null },
    category: { type: String, required: true, default: 'other' },
    tags: { type: [String], default: [] },                     // native array!
    price: { type: Number, required: true },
    auction_floor: { type: Number, default: 0 },
    editions: { type: Number, default: 1 },
    remaining: { type: Number, default: 1 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    color: { type: String, default: '#888888' },
    filename: { type: String, default: null },
    saved_as: { type: String, default: null },
    file_size: { type: Number, default: null },
    exif: {
        camera: { type: String, default: null },
        lens: { type: String, default: null },
        iso: { type: String, default: null },
        aperture: { type: String, default: null },
        shutter: { type: String, default: null },
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

photographSchema.index({ artist_id: 1 });
photographSchema.index({ category: 1 });

// ─── Auction Schema ──────────────────────────────────────────
const auctionSchema = new Schema({
    _id: { type: Number },                                     // auto-increment integer
    photo_id: { type: Number, ref: 'Photograph', required: true },
    type: { type: String, enum: ['dutch', 'english', 'silent'], default: 'dutch' },
    start_price: { type: Number, required: true },
    floor_price: { type: Number, required: true },
    current_price: { type: Number, required: true },
    decrement: { type: Number, default: 0 },
    interval_ms: { type: Number, default: 10000 },
    sold: { type: Boolean, default: false },
    sold_price: { type: Number, default: null },
    buyer_id: { type: String, ref: 'User', default: null },
    ended_at: { type: Date, default: null },
}, {
    timestamps: { createdAt: 'started_at', updatedAt: false },
});

auctionSchema.index({ photo_id: 1 });

// ─── Bid Schema ──────────────────────────────────────────────
const bidSchema = new Schema({
    _id: { type: Number },                                     // auto-increment integer
    auction_id: { type: Number, ref: 'Auction', required: true },
    user_id: { type: String, ref: 'User', default: null },
    user_name: { type: String, default: 'Anonymous' },
    amount: { type: Number, required: true },
    accepted: { type: Boolean, default: false },
}, {
    timestamps: { createdAt: 'placed_at', updatedAt: false },
});

bidSchema.index({ auction_id: 1 });

// ─── Models ──────────────────────────────────────────────────
const User = mongoose.model('User', userSchema);
const Photograph = mongoose.model('Photograph', photographSchema);
const Auction = mongoose.model('Auction', auctionSchema);
const Bid = mongoose.model('Bid', bidSchema);

module.exports = { User, Photograph, Auction, Bid, Counter, getNextSequence };
