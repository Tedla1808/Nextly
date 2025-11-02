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
    console.log('Running refined hourly check for notifications...');
    const { sendNotificationToDevice } = require('./routes/notifications');

    try {
        const usersToNotify = await User.find({
            'settings.notificationsEnabled': true,
            fcmToken: { $ne: null, $exists: true }
        });

        if (usersToNotify.length === 0) return;

        const now = new Date();
        const criticalReminderDays = [15, 10, 5, 1];
        const importantReminderDays = [7, 3, 1];

        for (const user of usersToNotify) {
            // --- TIMEZONE & DATE CALCULATIONS ---
            const userTimezone = user.settings.timezone || 'UTC';
            const formatter = new Intl.DateTimeFormat([], { timeZone: userTimezone, hour: 'numeric', hour12: false });
            const currentUserHour = parseInt(formatter.format(now), 10);
            const userBriefingHour = parseInt(user.settings.dailySummaryTime.split(':')[0], 10);
            const todayInUserTimezone = now.toLocaleDateString('en-CA', { timeZone: userTimezone });

            // --- 1. Morning Briefing (No change to this logic) ---
            if (user.settings.dailySummaryEnabled && currentUserHour === userBrief_model_silently_updated_user_js_file_in_previous_turn_to_add_lastAdvancedReminderDate_field_to_user_model_in_databaseingHour) {
                const todaysTasks = await Task.find({ username: user.username, date: todayInUserTimezone });
                if (todaysTasks.length > 0) {
                    const pending = todaysTasks.filter(t => !t.completed).length;
                    if (pending > 0) {
                        const title = `Your Morning Briefing ☕`;
                        const body = `Good morning! You have ${pending} pending task(s) for today.`;
                        console.log(`Sending Morning Briefing to ${user.username}.`);
                        sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
                    }
                }
            }

            // --- 2. HOURLY REMINDER (EVERY 3 HOURS) ---
            // Only runs if enabled, it's a multiple of 3, and it's not briefing hour.
            if (user.settings.hourlyReminderEnabled && currentUserHour % 3 === 0 && currentUserHour !== userBriefingHour) {
                const uncompletedTasks = await Task.find({ username: user.username, date: todayInUserTimezone, completed: false });
                if (uncompletedTasks.length > 0) {
                    const title = 'Task Reminder';
                    const body = `Just a reminder, you have ${uncompletedTasks.length} uncompleted task(s) for today.`;
                    console.log(`Sending 3-Hourly Reminder to ${user.username}.`);
                    sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
                }
            }
            
            // --- 3. ADVANCED REMINDERS (ONCE PER DAY) ---
            // Check if we've already sent one today.
            if (user.settings.lastAdvancedReminderDate !== todayInUserTimezone) {
                let reminderSent = false;
                
                // Helper function to find tasks and send notifications
                const checkAndSend = async (days, priority) => {
                    const targetDate = new Date(now);
                    targetDate.setDate(targetDate.getDate() + days);
                    const targetDateString = targetDate.toLocaleDateString('en-CA', { timeZone: userTimezone });
                    
                    const tasks = await Task.find({ username: user.username, date: targetDateString, priority: priority, completed: false });
                    
                    if (tasks.length > 0) {
                        const title = `${priority.charAt(0).toUpperCase() + priority.slice(1)} Task Reminder`;
                        const body = `You have ${tasks.length} ${priority} task(s) due in ${days} day(s).`;
                        console.log(`Sending ONCE-A-DAY ${priority} reminder to ${user.username}.`);
                        sendNotificationToDevice(user.fcmToken, { notification: { title, body } });
                        return true; // Indicate that a reminder was sent
                    }
                    return false;
                };

                // Check Critical Tasks
                for (const days of criticalReminderDays) {
                    if (await checkAndSend(days, 'critical')) {
                        reminderSent = true;
                        break; // Stop after finding the first relevant reminder for the day
                    }
                }
                
                // If no critical reminder was sent, check for important tasks
                if (!reminderSent) {
                    for (const days of importantReminderDays) {
                        if (await checkAndSend(days, 'important')) {
                            reminderSent = true;
                            break;
                        }
                    }
                }

                // If any advanced reminder was sent, update the date in the database
                if (reminderSent) {
                    await User.updateOne({ _id: user._id }, { 'settings.lastAdvancedReminderDate': todayInUserTimezone });
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