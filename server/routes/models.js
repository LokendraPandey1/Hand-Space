const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Model = require('../models/Model');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../models');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-originalname
        const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    // Only allow .glb and .gltf files
    const allowedExt = ['.glb', '.gltf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExt.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only .glb and .gltf files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Auth middleware
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'handspace_secret');
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Upload model
router.post('/upload', authMiddleware, upload.single('model'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { name, description, category } = req.body;

        if (!name || !category) {
            // Delete uploaded file if validation fails
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Name and category are required' });
        }

        const model = new Model({
            name,
            description: description || '',
            category,
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            uploadedBy: req.userId
        });

        await model.save();

        res.status(201).json({
            message: 'Model uploaded successfully',
            model: {
                id: model._id,
                name: model.name,
                category: model.category,
                filename: model.filename
            }
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Failed to upload model' });
    }
});

// Get all models (including user-uploaded)
router.get('/', async (req, res) => {
    try {
        const models = await Model.find({ isPublic: true })
            .select('name category filename description createdAt')
            .sort({ createdAt: -1 });

        res.json(models);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// Get user's uploaded models
router.get('/my-models', authMiddleware, async (req, res) => {
    try {
        const models = await Model.find({ uploadedBy: req.userId })
            .select('name category filename description createdAt isPublic')
            .sort({ createdAt: -1 });

        res.json(models);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// Delete model
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const model = await Model.findOne({
            _id: req.params.id,
            uploadedBy: req.userId
        });

        if (!model) {
            return res.status(404).json({ error: 'Model not found' });
        }

        // Delete file
        const filePath = path.join(uploadDir, model.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Model.deleteOne({ _id: model._id });

        res.json({ message: 'Model deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete model' });
    }
});

module.exports = router;
