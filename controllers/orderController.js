// server/controllers/orderController.js
import mongoose from 'mongoose'; // Import mongoose for ObjectId validation
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { updateCredits, getUserByReferralCode } from './userController.js'; // Import user functions for credits and referral
import { sendToWebhook, sendDmToUser } from './authController.js'; // Import webhook and DM helper functions

// Create a new order (from checkout/buypage)
export const createOrder = async (req, res) => {
  // Ensure user is authenticated (handled by protect middleware on the route)
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: 'Not authenticated to create an order.' });
  }

  const { items, referralCodeUsed } = req.body; // Expect items array and optional referralCodeUsed

  // Validate request body
  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Order must contain items.' });
  }

  try {
    let totalAmount = 0;
    const orderItems = [];

    // Validate and enrich order items with current product data from DB
    for (const item of items) {
      // Ensure productId is a valid MongoDB ObjectId
      if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ message: `Invalid product ID provided: ${item.productId}` });
      }
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
      }
      if (item.quantity <= 0) {
        return res.status(400).json({ message: `Quantity for ${product.name} must be positive.` });
      }

      const effectivePrice = product.discountPrice !== undefined ? product.discountPrice : product.price;
      totalAmount += effectivePrice * item.quantity;

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: effectivePrice, // Snapshot price at time of purchase
        quantity: item.quantity,
        image: product.image // Snapshot image URL
      });
    }

    // Validate and process referral code (if provided)
    let referrerDiscordId = null;
    if (referralCodeUsed) {
        const referrer = await getUserByReferralCode(referralCodeUsed);
        // Ensure referrer exists AND they are not the buyer (prevent self-referral)
        if (referrer && referrer.discordId !== req.session.user.discordId) {
            referrerDiscordId = referrer.discordId;
            console.log(`Referral code ${referralCodeUsed} used by ${req.session.user.username}, referred by ${referrer.username}`);
        } else if (referrer && referrer.discordId === req.session.user.discordId) {
            console.log(`Self-referral attempt detected for ${req.session.user.username}. Code: ${referralCodeUsed}. Referral will not be credited.`);
        } else {
            console.log(`Invalid or non-existent referral code used: ${referralCodeUsed}. Referral will not be credited.`);
        }
    }

    // Generate a simple unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create the new order document
    const newOrder = new Order({
      user: req.session.user.id, // Link order to the logged-in user's MongoDB _id
      orderNumber,
      items: orderItems,
      totalAmount: totalAmount,
      status: 'Pending', // Initial status for new orders
      referredBy: referrerDiscordId, // Store who referred this order's user (Discord ID)
    });

    const savedOrder = await newOrder.save(); // Save the order to MongoDB

    // --- Send Order Confirmation Webhook ---
    await sendToWebhook(process.env.ORDER_CONFIRMATION_WEBHOOK_URL, {
        username: "Order Bot",
        avatar_url: "https://via.placeholder.com/128/5D67E9/FFFFFF?text=🛍️", // Shopping bag emoji
        embeds: [
            {
                title: `🎉 New Order Placed! #${savedOrder.orderNumber}`,
                description: `A new order has been received from **${req.session.user.username}#${req.session.user.discriminator || ''}**!`,
                color: 6022839, // Blue color (decimal for #5BC0DE)
                fields: [
                    { name: "Order ID", value: savedOrder._id.toString(), inline: true },
                    { name: "Customer Discord ID", value: req.session.user.discordId, inline: true },
                    { name: "Total Amount", value: `$${savedOrder.totalAmount.toFixed(2)}`, inline: true },
                    { name: "Status", value: savedOrder.status, inline: true },
                    { name: "Items", value: savedOrder.items.map(item => `- ${item.name} (x${item.quantity})`).join('\n') }, // List all items
                    { name: "Referral Code Used By Buyer", value: referralCodeUsed || "None", inline: true },
                    { name: "Referred By (Discord ID)", value: referrerDiscordId || "None", inline: true },
                ],
                timestamp: new Date().toISOString()
            }
        ]
    });

    // --- Send DM to User for Order Confirmation ---
    const userDiscordId = req.session.user.discordId;
    if (userDiscordId) {
        const dmMessage = `Your order #${savedOrder.orderNumber} has been successfully placed! Total: $${savedOrder.totalAmount.toFixed(2)}. Current status: ${savedOrder.status}. Thank you for your purchase!`;
        const dmEmbeds = [{
            title: `Order #${savedOrder.orderNumber} Confirmed!`,
            description: `**Thank you for your purchase!**`,
            color: 3066993, // Green
            fields: [
                { name: "Order Total", value: `$${savedOrder.totalAmount.toFixed(2)}`, inline: true },
                { name: "Status", value: savedOrder.status, inline: true },
                { name: "Items", value: savedOrder.items.map(item => `${item.name} (x${item.quantity})`).join('\n') }
            ],
            timestamp: new Date().toISOString()
        }];
        await sendDmToUser(userDiscordId, dmMessage, dmEmbeds);
    } else {
        console.warn(`User ${req.session.user.username} has no Discord ID in session. Cannot send DM for order confirmation.`);
    }

    res.status(201).json({ message: 'Order placed successfully!', orderId: savedOrder._id, orderNumber: savedOrder.orderNumber });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error creating order.' });
  }
};

// Get all orders for the authenticated user (Client view)
export const getUserOrders = async (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: 'Not authenticated to view orders.' });
  }

  try {
    const orders = await Order.find({ user: req.session.user.id }).sort({ orderDate: -1 }); // Newest first
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Server error fetching user orders.' });
  }
};

// Get a single order by ID for the authenticated user (Client view)
export const getOrderById = async (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: 'Not authenticated to view order details.' });
  }

  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.session.user.id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or not authorized to view.' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ message: 'Server error fetching order details.' });
  }
};

// --- Admin/Staff Order Management (Protected by authorize middleware) ---

// Get all orders (Admin/Staff access)
export const getAllOrders = async (req, res) => {
    try {
        const { userType } = req.session.user;
        let query = {};

        // If staff, only show orders not hidden by admin
        if (userType === 'Staff') {
            query.isHiddenFromStaff = { $ne: true };
        }
        // Admin sees all orders by default

        // Populate user details associated with the order for display in admin panel
        const orders = await Order.find(query)
                                  .populate('user', 'username email discordId userType discriminator') // Populate user fields
                                  .sort({ orderDate: -1 }); // Sort by newest first
        res.json(orders);
    } catch (error) {
        console.error('Error fetching all orders (Admin/Staff):', error);
        res.status(500).json({ message: 'Server error fetching orders.' });
    }
};

// Update order status (Admin/Staff access) - Includes webhook notification and DM
export const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status, adminRemarks } = req.body;

    // Validate new status against allowed enum values
    if (!['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid order status provided.' });
    }

    try {
        // Populate user details for both webhook and DM
        const order = await Order.findById(orderId).populate('user', 'username discriminator discordId');
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const oldStatus = order.status;
        order.status = status;
        if (adminRemarks !== undefined) { // Allow clearing remarks by sending empty string
            order.adminRemarks = adminRemarks;
        }

        const updatedOrder = await order.save();

        // Referral Credit Logic: Credit referrer if status changes to Delivered and a referrer is set
        if (oldStatus !== 'Delivered' && updatedOrder.status === 'Delivered' && updatedOrder.referredBy) {
            const referrer = await User.findOne({ discordId: updatedOrder.referredBy }); // Find referrer by Discord ID
            if (referrer) {
                const referralPercentage = process.env.REFERRAL_CREDIT_PERCENTAGE ? parseFloat(process.env.REFERRAL_CREDIT_PERCENTAGE) : 0;
                const creditsToAdd = updatedOrder.totalAmount * (referralPercentage / 100);
                if (creditsToAdd > 0) { // Only add positive credits
                    await updateCredits(referrer._id, creditsToAdd); // Update referrer's credits in DB
                    console.log(`Credited ${creditsToAdd.toFixed(2)} to referrer ${referrer.username} (Discord ID: ${referrer.discordId}) for order ${updatedOrder.orderNumber}`);
                }
            } else {
                console.warn(`Referrer with Discord ID ${updatedOrder.referredBy} not found for order ${updatedOrder.orderNumber}. Credits not added.`);
            }
        }

        // --- Send Order Status Change Webhook ---
        await sendToWebhook(process.env.ORDER_STATUS_CHANGE_WEBHOOK_URL, {
            username: "Order Status Bot",
            avatar_url: "https://via.placeholder.com/128/FF8A00/FFFFFF?text=🔔", // Bell emoji
            embeds: [
                {
                    title: `Order #${updatedOrder.orderNumber} Status Update!`,
                    description: `Order for **${order.user?.username || 'Unknown User'}#${order.user?.discriminator || 'N/A'}** has changed status.`,
                    color: status === 'Delivered' ? 3066993 : status === 'Cancelled' ? 15158332 : 16776960, // Green/Red/Yellow based on status
                    fields: [
                        { name: "Order ID", value: updatedOrder._id.toString(), inline: true },
                        { name: "Customer", value: `${order.user?.username || 'N/A'}#${order.user?.discriminator || 'N/A'}`, inline: true },
                        { name: "Previous Status", value: oldStatus, inline: true },
                        { name: "New Status", value: updatedOrder.status, inline: true },
                        { name: "Remarks", value: updatedOrder.adminRemarks || "None", inline: false },
                        { name: "Processed By", value: req.session.user.username || "Unknown Admin/Staff", inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }
            ]
        });

        // --- Send DM to User for Order Status Change ---
        if (order.user && order.user.discordId) {
            const dmMessage = `Your order #${order.orderNumber} has been updated! New status: ${order.status}. Total: $${order.totalAmount.toFixed(2)}. ${order.adminRemarks ? `Remarks: ${order.adminRemarks}` : ''}`;
            const dmEmbeds = [{
                title: `Order #${order.orderNumber} Status: ${order.status}`,
                description: `Your order has been updated by the store staff!`,
                color: status === 'Delivered' ? 3066993 : status === 'Cancelled' ? 15158332 : 16776960,
                fields: [
                    { name: "Order Total", value: `$${order.totalAmount.toFixed(2)}`, inline: true },
                    { name: "New Status", value: order.status, inline: true },
                    { name: "Remarks", value: order.adminRemarks || "None", inline: false }
                ],
                timestamp: new Date().toISOString()
            }];
            await sendDmToUser(order.user.discordId, dmMessage, dmEmbeds);
        } else {
            console.warn(`User for order ${order.orderNumber} has no Discord ID or user object. Cannot send DM for status update.`);
        }

        res.json({ message: 'Order status updated successfully!', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error updating order status.' });
    }
};

// Hide/Unhide order from Staff view (Admin only)
export const toggleHideOrder = async (req, res) => {
    const { orderId } = req.params;
    const { hide } = req.body;

    if (typeof hide !== 'boolean') {
        return res.status(400).json({ message: 'Invalid hide parameter. Must be true or false.' });
    }

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        order.isHiddenFromStaff = hide;
        await order.save();

        res.json({ message: `Order ${order.orderNumber} visibility updated successfully to ${hide ? 'hidden' : 'visible'}.` });
    } catch (error) {
        console.error('Error toggling order visibility:', error);
        res.status(500).json({ message: 'Server error toggling order visibility.' });
    }
};