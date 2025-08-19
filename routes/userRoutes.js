import express from 'express'; // Change require to import
const router = express.Router();
// Import named exports from userController.js, include .js extension
import { protect, getMe, updateCredits } from '../controllers/userController.js'; 

// Apply protection middleware to user routes that require login
router.get('/profile', protect, getMe); // Use named export directly

router.post('/add-credits', protect, updateCredits); // Use named export directly

export default router; // Change module.exports to export default