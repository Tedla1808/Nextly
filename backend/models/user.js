const express = require('express');
const router = express.Router();
const User = require('../models/user');

// GET /api/user/:username/settings
// Fetches the settings for a specific user.
router.get('/:username/settings', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username: username.toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // Return only the settings object
        res.status(200).json(user.settings);

    } catch (err) {
        console.error('Get Settings Error:', err);
        res.status(500).json({ message: 'Server error while fetching settings.' });
    }
});


// POST /api/user/:username/settings
// Receives and updates settings for a specific user.
router.post('/:username/settings', async (req, res) => {
    try {
        const { username } = req.params;
        const settings = req.body;

        const updatedUser = await User.findOneAndUpdate(
            { username: username.toLowerCase() },
            { $set: { settings: settings } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'Settings updated successfully.' });
    } catch (err) {
        console.error('Settings Update Error:', err);
        res.status(500).json({ message: 'Server error during settings update.' });
    }
});

module.exports = router;