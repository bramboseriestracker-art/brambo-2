import mongoose from 'mongoose';

/* Connection cache shared across warm serverless invocations. */
const cache = globalThis.__bramboMongo || (globalThis.__bramboMongo = { conn: null, promise: null });

export async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 8000,
        // Indexes are created explicitly by `npm run db:setup` in production.
        autoIndex: process.env.NODE_ENV !== 'production'
      })
      .catch((e) => {
        cache.promise = null;
        throw e;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
