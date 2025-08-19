// server/routes/authRoutes.js
import express from 'express';
const router = express.Router();
import { discordAuthCallback, logout } from '../controllers/authController.js'; // <--- CHANGE THIS LINE (named exports, add .js)

router.get('/discord/callback', discordAuthCallback); // Use named export directly
router.post('/logout', logout); // Use named export directly

export default router; // <--- CHANGE to default export