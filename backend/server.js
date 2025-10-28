// Load environment variables from .env file (for local development)
// On Render, these will be set in the Environment tab
require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const Task = require('./models/task');

// --- Firebase Admin SDK Initialization ---
const admin = require('firebase-admin');

try {
    // This will work on Render because we created a secret file
    // For local development, you must place your downloaded key file in the 'backend' root
    const serviceAccount = require('./firebase-service-account-key.json'); 
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error.message);
    console.log("Please ensure 'firebase-service-account-key.json' is in the root of your backend folder for local development.");
}
// --- END Firebase Initialization ---


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- API Routes ---
// We destructure the exports from notifications.js now
const { router: notificationRoutes } = require('./routes/notifications');
const User = require('./models/user'); // <-- Make sure User model is imported

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', notificationRoutes); // Use the router from the export

// --- Scheduled Hourly Job for Notifications ---
// Runs at the top of every hour
cron.schedule('0 * * * *', async () => {
    console.log('Running hourly check for user notifications...');
    const { sendNotificationToDevice } = require('./routes/notifications');

    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // 1. Find all users who have an FCM token saved
        const usersToNotify = await User.find({ fcmToken: { $ne: null } });

        if (usersToNotify.length === 0) {
            console.log('No users with registered devices to notify.');
            return;
        }

        console.log(`Found ${usersToNotify.length} user(s) with registered devices.`);

        // 2. Loop through each user
        for (const user of usersToNotify) {
            // 3. Find uncompleted tasks for THIS specific user
            const uncompletedTasks = await Task.find({
                username: user.username,
                date: todayString,
                completed: false
            });

            if (uncompletedTasks.length > 0) {
                console.log(`Found ${uncompletedTasks.length} tasks for ${user.username}. Sending reminder.`);

                // 4. Create a personalized message
                const message = {
                    notification: {
                        title: 'Task Reminder from Nextly',
                        body: `You have ${uncompletedTasks.length} uncompleted task(s) for today.`
                    }
                };

                // 5. Send the notification to the user's specific device token
                sendNotificationToDevice(user.fcmToken, message);
            } else {
                console.log(`No uncompleted tasks for ${user.username} today.`);
            }
        }
    } catch (error) {
        console.error('Error during hourly notification job:', error);
    }
});


// Fallback: All other unhandled requests will serve the main frontend page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});