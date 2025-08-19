// server/controllers/rewardController.js
import Reward from '../models/Reward.js';
import User from '../models/User.js';
import Redemption from '../models/Redemption.js'; // Import Redemption model
import { updateCredits } from './userController.js'; // Re-use the updateCredits function
import { sendToWebhook, sendDmToUser } from './authController.js'; // Import webhook and DM helper functions

// --- Admin Reward Management ---

// Create a new reward (Admin only)
export const createReward = async (req, res) => {
  try {
    const newReward = new Reward(req.body);
    const savedReward = await newReward.save();
    res.status(201).json(savedReward);
  } catch (error) {
    console.error('Error creating reward:', error);
    res.status(500).json({ message: 'Server error creating reward.' });
  }
};

// Get all rewards (Admin access) - including inactive ones
export const getAllRewardsAdmin = async (req, res) => {
  try {
    const rewards = await Reward.find({});
    res.json(rewards);
  } catch (error) {
    console.error('Error fetching all rewards (Admin):', error);
    res.status(500).json({ message: 'Server error fetching rewards.' });
  }
};

// Get a single reward by ID (Admin access)
export const getRewardByIdAdmin = async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);
    if (!reward) {
      return res.status(404).json({ message: 'Reward not found.' });
    }
    res.json(reward);
  } catch (error) {
    console.error('Error fetching reward by ID (Admin):', error);
    res.status(500).json({ message: 'Server error fetching reward.' });
  }
};

// Update a reward by ID (Admin only)
export const updateReward = async (req, res) => {
  try {
    const updatedReward = await Reward.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedReward) {
      return res.status(404).json({ message: 'Reward not found.' });
    }
    res.json(updatedReward);
  } catch (error) {
    console.error('Error updating reward:', error);
    res.status(500).json({ message: 'Server error updating reward.' });
  }
};

// Delete a reward by ID (Admin only)
export const deleteReward = async (req, res) => {
  try {
    const deletedReward = await Reward.findByIdAndDelete(req.params.id);
    if (!deletedReward) {
      return res.status(404).json({ message: 'Reward not found.' });
    }
    res.json({ message: 'Reward deleted successfully.' });
  } catch (error) {
    console.error('Error deleting reward:', error);
    res.status(500).json({ message: 'Server error deleting reward.' });
  }
};

// --- User Reward Redemption ---

// Get all available rewards (User access - only active ones)
export const getAllAvailableRewards = async (req, res) => {
  try {
    const rewards = await Reward.find({ isAvailable: true });
    res.json(rewards);
  } catch (error) {
    console.error('Error fetching available rewards:', error);
    res.status(500).json({ message: 'Server error fetching available rewards.' });
  }
};

// Redeem a reward (Creates a PENDING Redemption request and sends webhook + DM)
export const redeemReward = async (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: 'Not authenticated to redeem rewards.' });
  }

  const { rewardId } = req.params;

  try {
    const reward = await Reward.findById(rewardId);
    if (!reward || !reward.isAvailable) {
      return res.status(404).json({ message: 'Reward not found or not currently available.' });
    }

    // Fetch user with Discord ID for DM
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.credits < reward.creditCost) {
      return res.status(400).json({ message: 'Insufficient credits to redeem this reward.' });
    }

    // Deduct credits immediately
    await updateCredits(user._id, -reward.creditCost);

    // Create a new PENDING redemption request
    const newRedemption = new Redemption({
      user: user._id,
      reward: reward._id,
      rewardName: reward.name, // Snapshot name
      creditCost: reward.creditCost, // Snapshot cost
      status: 'Pending',
      redeemedAt: new Date()
    });
    await newRedemption.save();

    // Update user session with new credits (reflect debited credits immediately)
    // Note: 'user' object in session is a copy, update it here.
    req.session.user.credits = user.credits - reward.creditCost;

    // --- Send Redeem Request Webhook ---
    await sendToWebhook(process.env.REDEEM_REQUEST_WEBHOOK_URL, {
        username: "Redemption Bot",
        avatar_url: "https://via.placeholder.com/128/99AAB5/FFFFFF?text=🎁", // Gift box emoji
        embeds: [
            {
                title: `🎁 New Redemption Request! #${newRedemption._id.toString().substring(0, 8)}`,
                description: `**${user.username}#${user.discriminator || ''}** has requested a reward!`,
                color: 10079487, // Discord blurple (decimal for #99AAB5)
                fields: [
                    { name: "User", value: `${user.username}#${user.discriminator || ''}`, inline: true },
                    { name: "Discord ID", value: user.discordId, inline: true },
                    { name: "Reward", value: newRedemption.rewardName, inline: true },
                    { name: "Cost", value: `${newRedemption.creditCost} Credits`, inline: true },
                    { name: "Status", value: newRedemption.status, inline: true },
                ],
                timestamp: new Date().toISOString()
            }
        ]
    });

    // --- Send DM to User for Redemption Request ---
    if (user.discordId) {
        const dmMessage = `Your redemption request for "${newRedemption.rewardName}" (${newRedemption.creditCost} credits) has been submitted! Status: ${newRedemption.status}. Please await admin approval.`;
        const dmEmbeds = [{
            title: `Redemption Request Submitted!`,
            description: `We've received your request for **${newRedemption.rewardName}**!`,
            color: 10079487, // Blurple
            fields: [
                { name: "Reward", value: newRedemption.rewardName, inline: true },
                { name: "Cost", value: `${newRedemption.creditCost} Credits`, inline: true },
                { name: "Status", value: newRedemption.status, inline: true }
            ],
            timestamp: new Date().toISOString()
        }];
        await sendDmToUser(user.discordId, dmMessage, dmEmbeds);
    } else {
        console.warn(`User ${user.username} has no Discord ID. Cannot send DM for redemption.`);
    }

    res.json({ message: `Redemption for "${reward.name}" submitted for approval!`, newCredits: user.credits });

  } catch (error) {
    console.error('Error submitting reward redemption:', error);
    res.status(500).json({ message: 'Server error submitting redemption.' });
  }
};

// --- Admin Redemption Management ---

// Get all redemption requests (Admin only)
export const getAllRedemptionsAdmin = async (req, res) => {
  try {
    // Populate user and reward details for comprehensive display in admin panel
    const redemptions = await Redemption.find({})
      .populate('user', 'username email discordId userType avatar') // Populate user details including avatar
      .populate('reward', 'name description image') // Populate reward details for context
      .sort({ redeemedAt: -1 }); // Sort by newest first
    res.json(redemptions);
  } catch (error) {
    console.error('Error fetching all redemptions (Admin):', error);
    res.status(500).json({ message: 'Server error fetching redemptions.' });
  }
};

// Update Redemption Status (Admin only: Approve/Reject)
export const updateRedemptionStatus = async (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  // This route is protected by `authorize(['Admin'])` so we know user is Admin.

  const { redemptionId } = req.params;
  const { status, adminRemarks } = req.body; // status: 'Approved' or 'Rejected'

  // Basic validation for status
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid redemption status provided.' });
  }

  try {
    const redemption = await Redemption.findById(redemptionId);
    if (!redemption) {
      return res.status(404).json({ message: 'Redemption request not found.' });
    }
    // Prevent re-processing already processed redemptions
    if (redemption.status !== 'Pending') {
      return res.status(400).json({ message: `Redemption is already ${redemption.status}. Cannot re-process.` });
    }

    redemption.status = status;
    redemption.adminRemarks = adminRemarks;
    redemption.processedBy = req.session.user.id; // Log which admin processed it
    redemption.processedAt = new Date();

    // If rejected, refund credits (IMPORTANT!)
    if (status === 'Rejected') {
      // Find the user whose redemption was rejected and update their credits
      await updateCredits(redemption.user, redemption.creditCost); // Refund credits to user
      console.log(`Refunded ${redemption.creditCost} credits to user ${redemption.user} for rejected redemption ID: ${redemption._id}`);
      // If the refunded user is the currently logged-in admin/staff, update their session credits too
      if (req.session.user.id === redemption.user.toString()) {
        req.session.user.credits += redemption.creditCost; // Update local session copy
      }
    }

    await redemption.save(); // Save the updated redemption status
    res.json({ message: `Redemption ${status.toLowerCase()} successfully!`, redemption });

  } catch (error) {
    console.error('Error updating redemption status:', error);
    res.status(500).json({ message: 'Server error updating redemption status.' });
  }
};

// Get a user's own redemption history (Client/User access)
export const getUserRedemptionHistory = async (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: 'Not authenticated to view redemption history.' });
  }

  try {
    // Find redemptions for the current logged-in user
    const redemptions = await Redemption.find({ user: req.session.user.id })
      .populate('reward', 'name image') // Populate minimal reward data for display
      .sort({ redeemedAt: -1 }); // Newest first
    res.json(redemptions);
  } catch (error) {
    console.error('Error fetching user redemption history:', error);
    res.status(500).json({ message: 'Server error fetching history.' });
  }
};