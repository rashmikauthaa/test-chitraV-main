/**
 * Create Admin User in MongoDB
 * Run with: node db/create-admin.js
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chitravithika';

async function createAdmin() {
    await mongoose.connect(MONGO_URI);
    console.log('[db] Connected to MongoDB');

    const userSchema = new mongoose.Schema({
        _id: String,
        email: { type: String, required: true, unique: true, lowercase: true },
        name: { type: String, required: true },
        role: { type: String, enum: ['buyer', 'photographer', 'admin'], default: 'buyer' },
        password_hash: { type: String, default: null },
        last_active: { type: Date, default: null },
    }, { timestamps: { createdAt: 'created_at', updatedAt: false } });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Admin credentials
    const adminEmail = 'admin@chitravithika.com';
    const adminPassword = 'password123';
    const adminName = 'Admin Root';

    // Check if admin already exists
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
        console.log('[admin] Admin user already exists:', existing.email);
        await mongoose.connection.close();
        return;
    }

    // Create password hash (SHA-256)
    const passwordHash = crypto.createHash('sha256').update(adminPassword).digest('hex');

    // Create admin user
    await User.create({
        _id: 'usr_admin',
        email: adminEmail,
        name: adminName,
        role: 'admin',
        password_hash: passwordHash,
    });

    console.log('[admin] Admin user created successfully!');
    console.log('  Email:', adminEmail);
    console.log('  Password:', adminPassword);

    await mongoose.connection.close();
    console.log('[db] Connection closed');
}

createAdmin().catch(err => {
    console.error('[error]', err.message);
    process.exit(1);
});
