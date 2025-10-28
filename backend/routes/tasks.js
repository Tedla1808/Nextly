const express = require('express');
const router = express.Router();
const Task = require('../models/task');

// GET all tasks for a specific user
router.get('/:username', async (req, res) => {
    try {
        const tasks = await Task.find({ username: req.params.username });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching tasks.' });
    }
});

// POST a new task for a specific user
router.post('/:username', async (req, res) => {
    const task = new Task({
        title: req.body.title,
        description: req.body.description,
        date: req.body.date,
        priority: req.body.priority,
        completed: false,
        username: req.params.username
    });
    try {
        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(400).json({ message: 'Failed to create task.' });
    }
});

// UPDATE a task by its ID
router.put('/:username/:id', async (req, res) => {
    try {
        const updatedTask = await Task.findOneAndUpdate(
            { _id: req.params.id, username: req.params.username },
            req.body,
            { new: true }
        );
        if (!updatedTask) return res.status(404).json({ message: 'Task not found.' });
        res.json(updatedTask);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update task.' });
    }
});

// DELETE a task by its ID
router.delete('/:username/:id', async (req, res) => {
    try {
        const result = await Task.findOneAndDelete({ _id: req.params.id, username: req.params.username });
        if (!result) return res.status(404).json({ message: 'Task not found.' });
        res.json({ message: 'Deleted Task' });
    } catch (err) {
        res.status(500).json({ message: 'Server error while deleting task.' });
    }
});

module.exports = router;