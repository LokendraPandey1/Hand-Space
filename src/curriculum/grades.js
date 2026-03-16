/**
 * Grade/Class Curriculum System
 *
 * Maps each class/grade to its NCERT syllabus topics and the 3D models
 * that correspond to each chapter. When a student selects their class,
 * only models relevant to their curriculum are shown.
 *
 * Class 9 — Biology only (pilot).
 * Models are in models/class 9/ folder.
 */

export const GRADES = ['5', '6', '7', '8', '9'];
export const SECTIONS = ['A', 'B', 'C'];

export const CLASS_CURRICULUM = {
    '9': {
        name: 'Class 9',
        subject: 'Science (NCERT)',
        chapters: [
            // ── Biology — The Fundamental Unit of Life ────────
            {
                id: 'ch5',
                name: 'The Fundamental Unit of Life',
                subject: 'Biology',
                icon: '\u{1F52C}',
                color: '#00b894',
                topics: ['Cell Structure', 'Plant Cell', 'Animal Cell', 'Cell Organelles', 'Cell Division'],
                models: [
                    { name: 'Animal Cell', file: 'class 9/animal_cell.glb', category: 'Biology', icon: '\u{1F9EB}', description: 'Complete structure of an animal cell with all organelles', available: true },
                    { name: 'Plant Cell', file: 'class 9/plant_cell_-_cell_structure.glb', category: 'Biology', icon: '\u{1F331}', description: 'Plant cell structure with cell wall, chloroplasts and vacuole', available: true },
                    { name: 'Nucleus', file: 'class 9/nucleus.glb', category: 'Biology', icon: '\u{1F9EC}', description: 'Cell nucleus with nuclear membrane, nucleolus and chromatin', available: true },
                    { name: 'Mitochondria', file: 'class 9/mitochondria_-_cell_organelles.glb', category: 'Biology', icon: '\u{1F52C}', description: 'Mitochondria — the powerhouse of the cell, showing cristae and matrix', available: true },
                    { name: 'Chloroplast', file: 'class 9/chloroplast.glb', category: 'Biology', icon: '\u{1F33F}', description: 'Chloroplast structure with thylakoids, grana and stroma', available: true },
                ],
                quiz: {
                    title: 'Cell Structure Quiz',
                    difficulty: 'Medium',
                    xp: 200,
                    questions: 10
                }
            },
            // ── Biology — Tissues ─────────────────────────────
            {
                id: 'ch6',
                name: 'Tissues',
                subject: 'Biology',
                icon: '\u{1F9EC}',
                color: '#6c5ce7',
                topics: ['Epithelial Tissue', 'Connective Tissue', 'Muscular Tissue', 'Nervous Tissue', 'Plant Tissues'],
                models: [],
                quiz: {
                    title: 'Tissues Quiz',
                    difficulty: 'Medium',
                    xp: 200,
                    questions: 10
                }
            },
            // ── Biology — Diversity in Living Organisms ───────
            {
                id: 'ch7',
                name: 'Diversity in Living Organisms',
                subject: 'Biology',
                icon: '\u{1F33F}',
                color: '#00cec9',
                topics: ['Classification', 'Five Kingdoms', 'Plantae', 'Animalia', 'Nomenclature'],
                models: [],
                quiz: {
                    title: 'Diversity in Living Organisms',
                    difficulty: 'Easy',
                    xp: 150,
                    questions: 10
                }
            },
            // ── Biology — Why Do We Fall Ill ──────────────────
            {
                id: 'ch13',
                name: 'Why Do We Fall Ill',
                subject: 'Biology',
                icon: '\u{1F3E5}',
                color: '#ff7675',
                topics: ['Health & Disease', 'Infectious Diseases', 'Immune System', 'Antibiotics', 'Prevention'],
                models: [],
                quiz: {
                    title: 'Health & Disease Quiz',
                    difficulty: 'Easy',
                    xp: 150,
                    questions: 8
                }
            },
        ]
    }
};

/**
 * Get all models for a specific grade.
 * Returns flat array of model objects with chapter context.
 */
export function getModelsForGrade(grade) {
    const curriculum = CLASS_CURRICULUM[grade];
    if (!curriculum) return [];

    const models = [];
    for (const chapter of curriculum.chapters) {
        for (const model of chapter.models) {
            models.push({
                ...model,
                chapter: chapter.name,
                chapterId: chapter.id,
                subject: chapter.subject,
                chapterIcon: chapter.icon,
                chapterColor: chapter.color
            });
        }
    }
    return models;
}

/**
 * Get chapters for a specific grade, optionally filtered by subject.
 */
export function getChaptersForGrade(grade, subject = null) {
    const curriculum = CLASS_CURRICULUM[grade];
    if (!curriculum) return [];

    if (subject) {
        return curriculum.chapters.filter(ch => ch.subject === subject);
    }
    return curriculum.chapters;
}

/**
 * Get the current grade from localStorage.
 * Handles both student grade ("9") and teacher class ("9A") formats.
 */
export function getCurrentGrade() {
    // Check student grade first
    const studentGrade = localStorage.getItem('handspace_grade') || '';
    if (studentGrade && studentGrade !== 'other') return studentGrade;
    if (studentGrade === 'other') return null;

    // Check teacher class selection (e.g. "9A" → "9")
    const teacherClass = localStorage.getItem('handspace_class') || '';
    if (teacherClass) {
        const grade = teacherClass.replace(/[A-Z]/gi, '');
        if (GRADES.includes(grade)) return grade;
    }

    return null;
}

/**
 * Set the student's grade.
 */
export function setCurrentGrade(grade) {
    localStorage.setItem('handspace_grade', grade);
    window.dispatchEvent(new Event('grade_changed'));
}
