// server/controllers/authController.js
import fetch from 'node-fetch'; // For making HTTP requests (e.g., to Discord API, bot API, webhooks)
import User from '../models/User.js'; // User model for database operations

// --- Webhook Helper Function ---
// Sends a JSON payload to a Discord webhook URL.
export const sendToWebhook = async (url, payload) => {
  // Check if the webhook URL is configured or is still a placeholder
  if (!url || url.includes('YOUR_')) {
    console.warn(`Webhook URL not configured or is a placeholder for "${url}". Skipping notification.`);
    return; // Exit if URL is invalid or placeholder
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Webhook failed (${url}): Status ${response.status} - ${errorText}`);
    } else {
      console.log(`Webhook notification successfully sent to ${url}`);
    }
  } catch (error) {
    console.error(`Error sending webhook to ${url}:`, error.message);
  }
};

// --- Send DM via Bot API Helper ---
// Sends a direct message to a Discord user by ID using your separate Discord bot API.
export const sendDmToUser = async (discordUserId, messageContent, embeds = []) => {
    // Check if the bot API URL and secret are configured
    if (!process.env.BOT_API_URL || process.env.BOT_API_URL.includes('YOUR_')) {
        console.warn("Bot API URL not configured or is a placeholder. Skipping DM notification.");
        return;
    }
    if (!process.env.API_SECRET || process.env.API_SECRET.includes('aVerySecureSecret')) {
        console.warn("API_SECRET not configured for bot communication. Skipping DM.");
        return;
    }

    try {
        const response = await fetch(process.env.BOT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-secret': process.env.API_SECRET // Authenticate request with the bot API
            },
            body: JSON.stringify({ discordUserId, messageContent, embeds })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Failed to send DM via bot API to ${discordUserId}: Status ${response.status} -`, errorData);
        } else {
            console.log(`DM request successfully sent to bot API for user ${discordUserId}.`);
        }
    } catch (error) {
        console.error(`Network error sending DM request to bot API for ${discordUserId}:`, error.message);
    }
};

// --- Discord OAuth Callback Logic ---
// This is the main callback endpoint after Discord user authorization.
export const discordAuthCallback = async (req, res) => {
  const { code, referral_code } = req.query; // Get authorization code and optional referral code from query params

  console.log('Backend: /auth/discord/callback endpoint hit.');

  // Validate presence of authorization code
  if (!code) {
    console.error('Backend Error: No authorization code received from Discord.');
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=discord_auth_denied`);
  }

  try {
    console.log('Backend: Authorization code received. Proceeding to token exchange...');

    // 1. Exchange the authorization code for an access token with Discord
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ // Formats the request body as URL-encoded
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI, // Must match Discord Dev Portal and frontend's request
        scope: 'identify email', // Must match the scopes requested
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Backend Error: Failed to exchange code for token:', tokenResponse.status, errorData);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_exchange_failed&details=${tokenResponse.status}&message=${encodeURIComponent(errorData.error_description || 'Unknown token exchange error')}`);
    }

    const { access_token, refresh_token } = await tokenResponse.json(); // Extract tokens
    console.log('Backend: Token exchange successful! Access token obtained.');

    console.log('Backend: Attempting to fetch user profile using the access token...');
    // 2. Use the access token to fetch the user's Discord profile
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error('Backend Error: Failed to fetch user profile:', userResponse.status, errorData);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=profile_fetch_failed&details=${userResponse.status}&message=${encodeURIComponent(errorData.message || 'Unknown profile fetch error')}`);
    }

    const discordUser = await userResponse.json(); // Parse Discord user data
    console.log('Backend: User profile fetched successfully:', discordUser.username, discordUser.id);

    // 3. Find or Create User in MongoDB
    console.log('Backend: Attempting to find or create user in MongoDB...');
    let user = await User.findOne({ discordId: discordUser.id });
    let isNewUser = !user;

    if (isNewUser) {
        // Create a new user document if not found
        user = new User({
            discordId: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator,
            avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
            email: discordUser.email,
            lastLogin: new Date(),
            // `credits` and `referralCode` will be set by schema default and pre('save') hook
            referredBy: referral_code || null // Store who referred this new user
        });
        await user.save(); // Save to trigger pre('save') hook for referralCode generation

        // Send New User Registration Webhook notification
        await sendToWebhook(process.env.NEW_REG_WEBHOOK_URL, {
            username: "New User Bot",
            avatar_url: "https://via.placeholder.com/128/00FF00/FFFFFF?text=NEW", // Green for new user
            embeds: [
                {
                    title: "🚀 New User Registered!",
                    description: `**${user.username}#${user.discriminator}** has joined the platform!`,
                    color: 3066993, // Green color (decimal for #2ECC71)
                    fields: [
                        { name: "Discord ID", value: user.discordId, inline: true },
                        { name: "Email", value: user.email, inline: true },
                        { name: "Referral Code Used", value: user.referredBy || "None", inline: true },
                        { name: "Initial Credits", value: user.credits.toString(), inline: true },
                        { name: "User Type", value: user.userType, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }
            ]
        });

    } else {
        // Existing user: just update login time and other Discord details
        user.username = discordUser.username;
        user.discriminator = discordUser.discriminator;
        user.avatar = discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null;
        user.email = discordUser.email;
        user.lastLogin = new Date();
        await user.save(); // Use save to trigger pre('save') hook for `updatedAt`
    }

    console.log('Backend: User found/created in MongoDB. User ID:', user._id);

    // 4. Store user info in session
    // This makes user data available via req.session.user for subsequent requests
    req.session.user = {
      id: user._id,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      credits: user.credits,
      userType: user.userType,
      referralCode: user.referralCode // Pass referralCode to session
    };
    console.log('Backend: User data stored in session. Session ID:', req.session.id);

    // 5. Redirect to the frontend's dashboard/success page
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?loggedIn=true`);

  } catch (error) {
    console.error('Backend Error: An unexpected error occurred during Discord OAuth flow:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=internal_server_error&message=${encodeURIComponent(error.message || 'An unknown internal server error occurred.')}`);
  }
};

// --- Logout Logic ---
export const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Backend Error: Error destroying session:', err);
      return res.status(500).json({ message: 'Could not log out due to server error.' });
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    console.log('Backend: User logged out. Session destroyed and cookie cleared.');
    res.json({ message: 'Logged out successfully!' });
  });
};