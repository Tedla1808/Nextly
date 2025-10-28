const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    date: { type: String, required: true, index: true },
    priority: { type: String, default: 'normal' },
    completed: { type: Boolean, default: false },
    username: { type: String, required: true, index: true } 
});

module.exports = mongoose.model('Task', taskSchema);