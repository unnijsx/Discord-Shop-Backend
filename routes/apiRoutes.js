import express from 'express';
const router = express.Router();

// Import controllers and middleware
import { protect, authorize, getMe, getAllUsers, updateUserType, updateCredits } from '../controllers/userController.js';
import { getAllProducts, getProductById, getFeaturedProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController.js';
import { createOrder, getUserOrders, getOrderById, getAllOrders, updateOrderStatus, toggleHideOrder } from '../controllers/orderController.js';
import { createReward, getAllAvailableRewards, redeemReward, getAllRewardsAdmin, updateReward, deleteReward, getAllRedemptionsAdmin, updateRedemptionStatus, getUserRedemptionHistory } from '../controllers/rewardController.js'; // UPDATED rewardController imports
import { createAnnouncement, getAllActiveAnnouncements, getAllAnnouncementsAdmin, updateAnnouncement, deleteAnnouncement } from '../controllers/announcementController.js';


// --- Public API Routes (no authentication required) ---
router.get('/products', getAllProducts);
router.get('/products/featured', getFeaturedProducts);
router.get('/products/:id', getProductById);
router.get('/announcements', getAllActiveAnnouncements);
router.get('/rewards', getAllAvailableRewards); // Get available rewards for users


// --- Authenticated User API Routes (Client, Staff, Admin) ---
router.get('/profile', protect, getMe);
router.post('/orders', protect, createOrder);
router.get('/orders', protect, getUserOrders);
router.get('/orders/:id', protect, getOrderById);
router.post('/rewards/:rewardId/redeem', protect, redeemReward); // User redeems a reward
router.get('/redemption-history', protect, getUserRedemptionHistory); // User's own redemption history


// --- Staff/Admin API Routes (Staff, Admin) ---
router.get('/admin/orders', protect, authorize(['Staff', 'Admin']), getAllOrders);
router.patch('/admin/orders/:orderId/status', protect, authorize(['Staff', 'Admin']), updateOrderStatus);


// --- Admin Only API Routes (Admin) ---
router.post('/admin/products', protect, authorize(['Admin']), createProduct);
router.put('/admin/products/:id', protect, authorize(['Admin']), updateProduct);
router.delete('/admin/products/:id', protect, authorize(['Admin']), deleteProduct);

router.get('/admin/users', protect, authorize(['Admin']), getAllUsers);
router.patch('/admin/users/:userId/type', protect, authorize(['Admin']), updateUserType);

router.post('/admin/rewards', protect, authorize(['Admin']), createReward);
router.get('/admin/rewards/all', protect, authorize(['Admin']), getAllRewardsAdmin); // Get all rewards (including inactive)
router.put('/admin/rewards/:id', protect, authorize(['Admin']), updateReward);
router.delete('/admin/rewards/:id', protect, authorize(['Admin']), deleteReward);

router.post('/admin/announcements', protect, authorize(['Admin']), createAnnouncement);
router.get('/admin/announcements/all', protect, authorize(['Admin']), getAllAnnouncementsAdmin); // Get all announcements (including inactive)
router.put('/admin/announcements/:id', protect, authorize(['Admin']), updateAnnouncement);
router.delete('/admin/announcements/:id', protect, authorize(['Admin']), deleteAnnouncement);

router.patch('/admin/orders/:orderId/hide', protect, authorize(['Admin']), toggleHideOrder);

router.get('/admin/redemptions', protect, authorize(['Admin']), getAllRedemptionsAdmin); // Get all redemption requests
router.patch('/admin/redemptions/:redemptionId/status', protect, authorize(['Admin']), updateRedemptionStatus); // Approve/Reject redemption


export default router;