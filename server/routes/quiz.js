const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Quiz, QuizAttempt } = require('../models/Quiz');

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

// Get all quizzes
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        const filter = category ? { category } : {};

        console.log('Fetching quizzes with filter:', filter);

        const quizzes = await Quiz.find(filter)
            .select('title description category difficulty timeLimit questions')
            .lean();

        console.log('Found quizzes:', quizzes.length);

        // Add question count
        const result = quizzes.map(q => ({
            ...q,
            questionCount: q.questions?.length || 0,
            questions: undefined
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching quizzes:', err);
        res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
});

// Get user's quiz history
router.get('/history/me', authMiddleware, async (req, res) => {
    try {
        const attempts = await QuizAttempt.find({ user: req.userId })
            .populate('quiz', 'title category')
            .sort({ completedAt: -1 })
            .limit(20);

        res.json(attempts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get quiz by ID (for taking the quiz)
router.get('/:id', async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .select('title description category difficulty timeLimit questions modelFile');

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // Remove correct answers for quiz-taking
        const sanitizedQuiz = {
            ...quiz.toObject(),
            questions: quiz.questions.map(q => ({
                question: q.question,
                options: q.options,
                _id: q._id
            }))
        };

        res.json(sanitizedQuiz);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
});

// Submit quiz answers
router.post('/:id/submit', authMiddleware, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const { answers, timeTaken } = req.body;

        // Grade the quiz
        let score = 0;
        const gradedAnswers = quiz.questions.map((q, idx) => {
            const userAnswer = answers[idx];
            const isCorrect = userAnswer === q.correctAnswer;
            if (isCorrect) score++;

            return {
                questionIndex: idx,
                selectedAnswer: userAnswer,
                isCorrect,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation
            };
        });

        const totalQuestions = quiz.questions.length;
        const percentage = Math.round((score / totalQuestions) * 100);

        // Save attempt
        const attempt = new QuizAttempt({
            user: req.userId,
            quiz: quiz._id,
            answers: gradedAnswers,
            score,
            totalQuestions,
            percentage,
            timeTaken
        });
        await attempt.save();

        res.json({
            score,
            totalQuestions,
            percentage,
            answers: gradedAnswers,
            passed: percentage >= 70
        });
    } catch (err) {
        console.error('Submit error:', err);
        res.status(500).json({ error: 'Failed to submit quiz' });
    }
});



// Create quiz (for teachers/admins)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, description, category, modelFile, questions, difficulty, timeLimit } = req.body;

        if (!title || !category || !questions || questions.length === 0) {
            return res.status(400).json({ error: 'Title, category, and questions are required' });
        }

        const quiz = new Quiz({
            title,
            description,
            category,
            modelFile,
            questions,
            difficulty,
            timeLimit,
            createdBy: req.userId
        });

        await quiz.save();
        res.status(201).json({ message: 'Quiz created', quizId: quiz._id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create quiz' });
    }
});

module.exports = router;
