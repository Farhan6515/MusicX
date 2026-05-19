const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is missing. Auth sessions will not persist in MongoDB.');
    return false;
  }

  try {
    await mongoose.connect(uri, { tls: true, tlsInsecure: true });
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    return false;
  }
}

module.exports = { connectDB, mongoose };
