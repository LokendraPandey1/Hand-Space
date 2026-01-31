// Seed sample quizzes for HandSpace
// Run with: node server/seedQuizzes.js

require('dotenv').config();
const mongoose = require('mongoose');
const { Quiz } = require('./models/Quiz');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/handspace';

const sampleQuizzes = [
    {
        title: 'Human Heart Anatomy',
        description: 'Test your knowledge about the human heart and cardiovascular system.',
        category: 'Anatomy',
        modelFile: 'heart.glb',
        difficulty: 'Medium',
        timeLimit: 10,
        questions: [
            {
                question: 'How many chambers does the human heart have?',
                options: ['Two', 'Three', 'Four', 'Five'],
                correctAnswer: 2,
                explanation: 'The heart has four chambers: two atria (upper) and two ventricles (lower).'
            },
            {
                question: 'Which chamber of the heart pumps blood to the lungs?',
                options: ['Left atrium', 'Right atrium', 'Left ventricle', 'Right ventricle'],
                correctAnswer: 3,
                explanation: 'The right ventricle pumps deoxygenated blood to the lungs via the pulmonary artery.'
            },
            {
                question: 'What is the average resting heart rate for adults?',
                options: ['40-50 bpm', '60-100 bpm', '100-120 bpm', '120-140 bpm'],
                correctAnswer: 1,
                explanation: 'A normal resting heart rate for adults ranges from 60 to 100 beats per minute.'
            },
            {
                question: 'Which valve separates the left atrium from the left ventricle?',
                options: ['Tricuspid valve', 'Mitral valve', 'Aortic valve', 'Pulmonary valve'],
                correctAnswer: 1,
                explanation: 'The mitral (bicuspid) valve controls blood flow from the left atrium to the left ventricle.'
            },
            {
                question: 'What is the largest artery in the human body?',
                options: ['Pulmonary artery', 'Carotid artery', 'Aorta', 'Femoral artery'],
                correctAnswer: 2,
                explanation: 'The aorta is the largest artery, carrying oxygenated blood from the heart to the body.'
            }
        ]
    },
    {
        title: 'Water Molecule Chemistry',
        description: 'Learn about H2O and its unique molecular properties.',
        category: 'Chemistry',
        modelFile: 'h2o_molecule.glb',
        difficulty: 'Easy',
        timeLimit: 8,
        questions: [
            {
                question: 'What is the chemical formula for water?',
                options: ['HO2', 'H2O', 'H2O2', 'OH'],
                correctAnswer: 1,
                explanation: 'Water consists of two hydrogen atoms bonded to one oxygen atom: H2O.'
            },
            {
                question: 'What type of bond exists between hydrogen and oxygen in water?',
                options: ['Ionic bond', 'Covalent bond', 'Metallic bond', 'Van der Waals force'],
                correctAnswer: 1,
                explanation: 'Water molecules are held together by covalent bonds between H and O atoms.'
            },
            {
                question: 'What is the bond angle in a water molecule?',
                options: ['90°', '104.5°', '120°', '180°'],
                correctAnswer: 1,
                explanation: 'The H-O-H bond angle in water is approximately 104.5°.'
            },
            {
                question: 'Water is considered a polar molecule because:',
                options: ['It has equal charge distribution', 'It has unequal charge distribution', 'It is neutral', 'It contains metals'],
                correctAnswer: 1,
                explanation: 'Water is polar due to the unequal distribution of electrons, creating partial charges.'
            }
        ]
    },
    {
        title: 'Solar System & Space',
        description: 'Explore the wonders of space and cosmic discoveries.',
        category: 'Space',
        modelFile: 'hubble_space_telescope.glb',
        difficulty: 'Medium',
        timeLimit: 10,
        questions: [
            {
                question: 'How far is the Sun from Earth?',
                options: ['93 million miles', '193 million miles', '293 million miles', '393 million miles'],
                correctAnswer: 0,
                explanation: 'Earth is approximately 93 million miles (150 million km) from the Sun.'
            },
            {
                question: 'Which planet is known as the Red Planet?',
                options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
                correctAnswer: 1,
                explanation: 'Mars is called the Red Planet due to iron oxide (rust) on its surface.'
            },
            {
                question: 'What year was the Hubble Space Telescope launched?',
                options: ['1980', '1985', '1990', '1995'],
                correctAnswer: 2,
                explanation: 'The Hubble Space Telescope was launched on April 24, 1990.'
            },
            {
                question: 'How many moons does Mars have?',
                options: ['None', 'One', 'Two', 'Four'],
                correctAnswer: 2,
                explanation: 'Mars has two small moons: Phobos and Deimos.'
            },
            {
                question: 'What is the largest planet in our solar system?',
                options: ['Saturn', 'Uranus', 'Neptune', 'Jupiter'],
                correctAnswer: 3,
                explanation: 'Jupiter is the largest planet, with a diameter of about 139,820 km.'
            }
        ]
    }
];

async function seedQuizzes() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing quizzes
        await Quiz.deleteMany({});
        console.log('Cleared existing quizzes');

        // Insert sample quizzes
        await Quiz.insertMany(sampleQuizzes);
        console.log(`✅ Inserted ${sampleQuizzes.length} sample quizzes`);

        mongoose.connection.close();
        console.log('Done!');
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

seedQuizzes();
