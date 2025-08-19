// server/index.js
import 'dotenv/config'; // Modern way to load dotenv with ES Modules
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectDB from './config/db.js'; // MUST include .js extension
import rootRouter from './routes/index.js'; // MUST include .js extension

// No need for `const testFetch = require('node-fetch');` here now,
// as fetch is globally available in Node.js 18+ for ES Modules, or
// if you still use node-fetch, you import it where needed (e.g., authController).

const app = express();
const PORT = process.env.PORT || 5000;

// --- Connect to Database ---
connectDB();

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// --- Mount Root Router ---
app.use('/', rootRouter);

// --- Basic Route (Optional) ---
app.get('/', (req, res) => {
  res.send('Discord OAuth Backend is running!');
});

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`Discord Redirect URI: ${process.env.DISCORD_REDIRECT_URI}`);
  console.log(`MongoDB URI: ${process.env.MONGO_URI ? 'Configured' : 'NOT CONFIGURED'}`);
});