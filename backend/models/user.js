const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    fcmToken: { type: String },
    settings: {
        notificationsEnabled: { type: Boolean, default: true },
        hourlyReminderEnabled: { type: Boolean, default: false },
        dailySummaryEnabled: { type: Boolean, default: false },
        dailySummaryTime: { type: String, default: '08:00' },
        timezone: { type: String, default: 'UTC' },
        lastAdvancedReminderDate: { type: String, default: null }
        // The calendarType and hasChosenCalendar fields have been removed.
    }
});

module.exports = mongoose.model('User', userSchema);