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
app.use('/api/user', require('./routes/user'));

// --- Scheduled Hourly Job for Notifications ---
// Runs at the top of every hour
cron.schedule('0 * * * *', async () => {
    console.log('Running hourly check for multi-stage user notifications...');
    const { sendNotificationToDevice } = require('./routes/notifications');

    // --- Define the fixed reminder schedules ---
    const criticalReminderDays = [15, 10, 5, 1];
const importantReminderDays = [7, 3, 1];

const getFutureDateString = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

const todayString = new Date().toISOString().split('T')[0];
const currentUTCHour = new Date().getUTCHours(); // Use UTC for server time

try {
    const usersToNotify = await User.find({ fcmToken: { $ne: null, $exists: true } });
    if (usersToNotify.length === 0) return;

    for (const user of usersToNotify) {
        // *** MASTER SWITCH: If notifications are disabled for this user, skip them entirely. ***
        if (!user.settings.notificationsEnabled) {
            console.log(`Skipping user ${user.username} (notifications disabled).`);
            continue;
        }

        const userBriefingHour = parseInt(user.settings.dailySummaryTime.split(':')[0], 10);
        const isBriefingHour = currentUTCHour === userBriefingHour;

        // --- 1. Morning Briefing ---
        // This runs only if enabled AND it's the correct hour for the user.
        if (user.settings.dailySummaryEnabled && isBriefingHour) {
            const todaysTasks = await Task.find({ username: user.username, date: todayString });
            if (todaysTasks.length > 0) {
                const completed = todaysTasks.filter(t => t.completed).length;
                const pending = todaysTasks.length - completed;
                const title = `Your Morning Briefing`;
                const body = `You have ${pending} task(s) pending and ${completed} completed for today.`;
                console.log(`Sending Morning Briefing to ${user.username}.`);
                sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
            }
        }

        // --- 2. Hourly Reminder for Today's Tasks ---
        // This runs if enabled, but NOT during the briefing hour (to avoid double notifications).
        if (user.settings.hourlyReminderEnabled && !isBriefingHour) {
            const uncompletedTasks = await Task.find({ username: user.username, date: todayString, completed: false });
            if (uncompletedTasks.length > 0) {
                const title = 'Hourly Reminder';
                const body = `You have ${uncompletedTasks.length} uncompleted task(s) for today.`;
                sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
            }
        }

        // --- 3. Advanced Reminders (Critical & Important) ---
        // These run independently of the hourly/daily settings.
        for (const days of criticalReminderDays) {
            const tasks = await Task.find({ username: user.username, date: getFutureDateString(days), priority: 'critical', completed: false });
            if (tasks.length > 0) {
                const title = `Critical Task Reminder`;
                const body = `You have ${tasks.length} critical task(s) due in ${days} day(s).`;
                sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
            }
        }

        for (const days of importantReminderDays) {
            const tasks = await Task.find({ username: user.username, date: getFutureDateString(days), priority: 'important', completed: false });
            if (tasks.length > 0) {
                const title = `Important Task Reminder`;
                const body = `You have ${tasks.length} important task(s) due in ${days} day(s).`;
                sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
            }
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