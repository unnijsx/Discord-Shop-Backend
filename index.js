// server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectDB from './config/db.js';
import rootRouter from './routes/index.js';

// --- Redis for Session Store (OPTIONAL but RECOMMENDED for persistent sessions on Vercel) ---
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
let redisClient;
let RedisStoreInstance;

if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch(console.error); // Connect to Redis
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    RedisStoreInstance = RedisStore(session); // Initialize RedisStore
}
// --- End Redis Setup ---

const app = express();
const PORT = process.env.PORT || 5000; // PORT might not be used by Vercel serverless functions directly

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure express-session
app.use(session({
  // Use RedisStore if configured, otherwise use default MemoryStore (not for production)
  store: RedisStoreInstance ? new RedisStoreInstance({ client: redisClient }) : undefined,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    httpOnly: true,
    // On Vercel, NODE_ENV is 'production' by default. 'secure: true' is required for HTTPS.
    // Ensure your deployed frontend is HTTPS. If running locally, this will be false.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax', // 'Lax' for dev, 'None' for cross-domain production (requires secure:true)
  },
}));

// CORS middleware - MUST COME AFTER session middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use('/', rootRouter);

app.get('/', (req, res) => {
  res.send('Discord Digital Goods Store Backend is running!');
});

// For Vercel, the `listen` call is typically not needed for serverless functions,
// as Vercel handles the server. However, it's fine to keep for local testing.
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // ... (existing console logs) ...
  if (process.env.REDIS_URL) {
    console.log(`Redis configured: ${process.env.REDIS_URL}`);
  } else {
    console.warn('Redis not configured. Sessions will be in-memory (not persistent on Vercel).');
  }
});