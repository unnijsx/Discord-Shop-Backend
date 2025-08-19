// server/routes/index.js
import express from 'express';
const router = express.Router();

import authRoutes from './authRoutes.js';
import apiRoutes from './apiRoutes.js'; // NEW: Import the API routes

// Mount specific routers
router.use('/auth', authRoutes); // Handles /auth/discord/callback, /auth/logout
router.use('/api', apiRoutes);   // Handles all /api/* endpoints

export default router;