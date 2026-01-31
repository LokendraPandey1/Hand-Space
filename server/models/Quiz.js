const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    options: [{
        type: String,
        required: true
    }],
    correctAnswer: {
        type: Number,  // Index of correct option
        required: true
    },
    explanation: {
        type: String,
        default: ''
    }
});

const QuizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        required: true,
        enum: ['Anatomy', 'Chemistry', 'Earth Science', 'Space', 'Engineering', 'General']
    },
    modelFile: {
        type: String,
        default: ''  // Associated 3D model
    },
    questions: [QuestionSchema],
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    timeLimit: {
        type: Number,  // In minutes
        default: 10
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Quiz attempt tracking
const QuizAttemptSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    answers: [{
        questionIndex: Number,
        selectedAnswer: Number,
        isCorrect: Boolean
    }],
    score: {
        type: Number,
        required: true
    },
    totalQuestions: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: true
    },
    timeTaken: {
        type: Number  // In seconds
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});

const Quiz = mongoose.model('Quiz', QuizSchema);
const QuizAttempt = mongoose.model('QuizAttempt', QuizAttemptSchema);

module.exports = { Quiz, QuizAttempt };
