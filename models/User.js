// server/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  discriminator: { type: String, required: true },
  avatar: { type: String },
  email: { type: String, required: true, unique: true, match: [/.+@.+\..+/, 'Please fill a valid email address'] },
  credits: { type: Number, default: process.env.DEFAULT_STARTING_CREDITS ? parseInt(process.env.DEFAULT_STARTING_CREDITS) : 0 },
  referralCode: { // Unique code for this user to share
    type: String,
    unique: true,
    sparse: true // Allows null values, so users without a code don't violate unique constraint
  },
  referredBy: { // Discord ID of the user who referred this user
    type: String,
    default: null
  },
  userType: { // Role-based access control
    type: String,
    enum: ['Client', 'Staff', 'Admin'],
    default: 'Client'
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: { // <-- THIS FIELD IS CRUCIAL FOR THE PRE-SAVE HOOK TO WORK RELIABLY
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to generate referral code only on first save
userSchema.pre('save', async function(next) {
    // Check if it's a new document AND if referralCode is not already set
    if (this.isNew && !this.referralCode) {
        let uniqueCodeFound = false;
        let code;
        while (!uniqueCodeFound) {
            // Generate a random 8-character alphanumeric code
            code = Math.random().toString(36).substring(2, 10).toUpperCase();
            // Check if this code already exists in the database
            const ExistingUser = this.constructor; // Correct way to reference the model inside a pre-save hook
            const existingUser = await ExistingUser.findOne({ referralCode: code });
            if (!existingUser) {
                uniqueCodeFound = true;
            }
        }
        this.referralCode = code; // Assign the unique code
        console.log(`Generated referral code for new user: ${this.referralCode}`); // Debugging line
    }

    // Update `updatedAt` field on every save operation
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('User', userSchema);