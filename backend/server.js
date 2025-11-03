// Load environment variables
require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const Task = require('./models/task');
const User = require('./models/user'); // Ensure User model is required

// --- Firebase Admin SDK Initialization ---
const admin = require('firebase-admin');
try {
    const serviceAccount = require('./firebase-service-account-key.json'); 
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error.message);
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
const { router: notificationRoutes } = require('./routes/notifications');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', require('./routes/user'));

// ==============================================================================
// === THE DEFINITIVE, TIMEZONE-AWARE, MINUTELY CRON JOB FOR ALL NOTIFICATIONS ===
// ==============================================================================
cron.schedule('* * * * *', async () => { // Runs EVERY MINUTE
    const { sendNotificationToDevice } = require('./routes/notifications');

    try {
        const now = new Date();
        
        const eligibleUsers = await User.find({
            'settings.notificationsEnabled': true,
            fcmToken: { $ne: null, $exists: true }
        });

        if (eligibleUsers.length === 0) return;

        for (const user of eligibleUsers) {
            const userTimezone = user.settings.timezone || 'UTC';
            const formatter = new Intl.DateTimeFormat([], { timeZone: userTimezone, hour: 'numeric', minute: 'numeric', hour12: false });
            const [currentUserHour, currentUserMinute] = formatter.format(now).split(':').map(Number);
            const userBriefingHour = parseInt(user.settings.dailySummaryTime.split(':')[0], 10);
            
            // --- 1. TIME BRIEFING ---
            if (user.settings.dailySummaryEnabled) {
                const [briefingHour, briefingMinute] = user.settings.dailySummaryTime.split(':').map(Number);
                if (currentUserHour === briefingHour && currentUserMinute === briefingMinute) {
                    const todayString = now.toLocaleDateString('en-CA', { timeZone: userTimezone });
                    const todaysTasks = await Task.find({ username: user.username, date: todayString });
                    const pending = todaysTasks.filter(t => !t.completed).length;

                    if (pending > 0) {
                        const title = `Your Time Briefing ☕`;
                        const body = `Good day! You have ${pending} pending task(s) for today.`;
                        console.log(`SUCCESS: Sending Time Briefing to ${user.username}.`);
                        sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
                    }
                }
            }

            // --- 2. 3-HOURLY REMINDER ---
            // Runs if enabled, at the top of the hour, for hours divisible by 3,
            // and NOT during the user's briefing hour.
            if (user.settings.hourlyReminderEnabled && currentUserMinute === 0 && currentUserHour % 3 === 0 && currentUserHour !== userBriefingHour) {
                const todayString = now.toLocaleDateString('en-CA', { timeZone: userTimezone });
                const uncompletedTasks = await Task.find({ username: user.username, date: todayString, completed: false });

                if (uncompletedTasks.length > 0) {
                    const title = 'Task Reminder';
                    const body = `Just a reminder, you have ${uncompletedTasks.length} uncompleted task(s) for today.`;
                    console.log(`SUCCESS: Sending 3-Hourly Reminder to ${user.username}.`);
                    sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
                }
            }
        }
    } catch (error) {
        console.error('Error during the minutely notification job:', error);
    }
});
// ==============================================================================
// ============================ END OF CRON JOB =================================
// ==============================================================================


// Fallback: All other unhandled requests will serve the main frontend page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});