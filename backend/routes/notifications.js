const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const User = require('../models/user'); // Import the User model

// Route for the Android app to send its FCM token
router.post('/register-token', async (req, res) => {
    const { token, username } = req.body; // Expect both token and username

    if (!token || !username) {
        return res.status(400).send({ message: "Token and username are required." });
    }

    try {
        // Find the user and save their token in the database
        const user = await User.findOneAndUpdate(
            { username: username.toLowerCase() },
            { fcmToken: token },
            { new: true }
        );

        if (!user) {
            return res.status(404).send({ message: "User not found." });
        }

        console.log(`Device FCM token registered for user: ${username}`);
        res.status(200).send({ message: "Token registered successfully." });

    } catch (error) {
        console.error("Error saving FCM token:", error);
        res.status(500).send({ message: "Server error while saving token." });
    }
});

// Function to send a notification using the V1 API
// This function doesn't need to change.
function sendNotificationToDevice(deviceToken, message) {
    if (!deviceToken) {
        console.log("No device token provided. Skipping notification.");
        return;
    }

    const payload = {
        ...message,
        token: deviceToken
    };

    admin.messaging().send(payload)
        .then(response => {
            console.log('Successfully sent message:', response);
        })
        .catch(error => {
            // If the token is invalid, we should remove it from our database
            if (error.code === 'messaging/registration-token-not-registered') {
                console.log('Invalid token, should be removed:', deviceToken);
                User.findOneAndUpdate({ fcmToken: deviceToken }, { fcmToken: null }).exec();
            } else {
                console.error('Error sending message:', error);
            }
        });
}

// Export the router and the function for the cron job
module.exports = { router, sendNotificationToDevice };