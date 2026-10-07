import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    text: { type: String, required: true },
    image: { type: String },
    latexContent: { type: Boolean, default: false },
    type: { type: String, enum: ['mcq', 'msq', 'fillblank', 'comprehension', 'broad'], required: true },
    topic: { type: String },
    subtopic: { type: String },
    marks: { type: Number, required: true, default: 1 },
    negativeMarks: { type: Number, default: 0 },
    timeLimit: { type: Number },
    isGrace: { type: Boolean, default: false },
    solutionText: { type: String },
    solutionImage: { type: String },
    options: { type: [mongoose.Schema.Types.Mixed] },
    correctIndices: [{ type: Number }],
    shuffleOptions: { type: Boolean, default: false },
    fillBlankAnswer: { type: String },
    caseSensitive: { type: Boolean, default: false },
    isNumberRange: { type: Boolean, default: false },
    numberRangeMin: { type: Number },
    numberRangeMax: { type: Number },
    comprehensionText: { type: String },
    comprehensionImage: { type: String },
    subQuestions: [{
        id: { type: String },
        text: { type: String },
        latexContent: { type: Boolean, default: false },
        type: { type: String, enum: ['mcq', 'msq', 'fillblank'] },
        options: { type: [mongoose.Schema.Types.Mixed] },
        correctIndices: [{ type: Number }],
        shuffleOptions: { type: Boolean, default: false },
        marks: { type: Number, default: 1 },
        negativeMarks: { type: Number, default: 0 },
        fillBlankAnswer: { type: String },
        caseSensitive: { type: Boolean, default: false },
        isNumberRange: { type: Boolean, default: false },
        numberRangeMin: { type: Number },
        numberRangeMax: { type: Number }
    }]
}, { _id: false });

const OnlineTestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    isBoardSpecific: { type: Boolean, default: false },
    questions: [QuestionSchema],
    boardQuestionSets: [{
        boards: [{ type: String }],
        questions: [QuestionSchema]
    }],
    deployment: {
        batches: [{ type: String }],
        students: [{
            phoneNumber: { type: String },
            studentName: { type: String },
            batchName: { type: String }
        }],
        startTime: { type: Date },
        endTime: { type: Date },
        durationMinutes: { type: Number }
    },
    config: {
        shuffleQuestions: { type: Boolean, default: false },
        showTimer: { type: Boolean, default: true },
        allowBackNavigation: { type: Boolean, default: true },
        showResults: { type: Boolean, default: true },
        showResultsImmediately: { type: Boolean, default: true },
        maxQuestionsToAttempt: { type: Number, default: null },
        passingPercentage: { type: Number, default: 40 },
        enablePerQuestionTimer: { type: Boolean, default: false },
        perQuestionDuration: { type: Number, default: 60 }
    },
    excludedStudents: [{ type: String }],
    status: { type: String, enum: ['draft', 'deployed', 'completed'], default: 'draft' },
    createdBy: { type: String, required: true },
    folderId: { type: String, default: null },
    totalMarks: { type: Number },
}, { timestamps: true });

OnlineTestSchema.pre('save', function () {
    let total = 0;
    
    // For board specific tests, total marks might vary by board. We'll store the max or just 0, but for now we'll calculate based on the first set if available, else questions array.
    let questionsToCount: any[] = this.questions || [];
    if (this.isBoardSpecific && this.boardQuestionSets && this.boardQuestionSets.length > 0) {
        questionsToCount = this.boardQuestionSets[0].questions || [];
    }

    if (this.config && this.config.maxQuestionsToAttempt && this.config.maxQuestionsToAttempt > 0) {
        questionsToCount = questionsToCount.slice(0, this.config.maxQuestionsToAttempt);
    }

    questionsToCount.forEach(q => {
        if (q.type === 'comprehension' && q.subQuestions) {
            q.subQuestions.forEach((sq: any) => total += sq.marks || 0);
        } else {
            total += q.marks || 0;
        }
    });
    this.totalMarks = total;
});

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.OnlineTest;
}

export default mongoose.models.OnlineTest || mongoose.model('OnlineTest', OnlineTestSchema);
