// --- STATE MANAGEMENT ---
let worksheetData = null;
let currentQuestionIndex = 0;
let score = 0;
let incorrectQuestions = []; // Stores indices of wrong answers for retry mode
let isRetryMode = false;
let activeQuestionList = []; 
let userSelectedAnswer = null;

// --- DOM ELEMENTS ---
const studentView = document.getElementById('student-view');
const teacherView = document.getElementById('teacher-view');
const setupScreen = document.getElementById('setup-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const appTitle = document.getElementById('app-title');

// --- INITIALIZATION ---
async function loadWorksheet(filepath) {
    try {
        const response = await fetch(filepath);
        if (!response.ok) throw new Error("Could not load the worksheet file.");
        const data = await response.json();
        startWorksheet(data);
    } catch (error) {
        alert("Error loading file: " + error.message);
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                startWorksheet(data);
            } catch (err) {
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    }
}

function startWorksheet(data) {
    worksheetData = data;
    appTitle.textContent = data.title;
    activeQuestionList = data.questions.map((q, index) => index); // array of original indices [0, 1, 2...]
    currentQuestionIndex = 0;
    score = 0;
    incorrectQuestions = [];
    isRetryMode = false;
    
    document.getElementById('json-editor').value = JSON.stringify(data, null, 4);

    setupScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    renderQuestion();
}

// --- RENDERING QUESTIONS ---
function renderQuestion() {
    userSelectedAnswer = null;
    const qContainer = document.getElementById('question-container');
    const feedback = document.getElementById('feedback-area');
    feedback.className = 'feedback-area hidden';
    feedback.innerHTML = '';
    
    document.getElementById('check-btn').classList.remove('hidden');
    document.getElementById('next-btn').classList.add('hidden');

    const realIndex = activeQuestionList[currentQuestionIndex];
    const qData = worksheetData.questions[realIndex];

    // Update Progress
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    progressText.innerText = `${currentQuestionIndex + 1} / ${activeQuestionList.length}`;
    progressBar.style.width = `${((currentQuestionIndex + 1) / activeQuestionList.length) * 100}%`;
    document.getElementById('score-display').innerText = `Score: ${score}`;

    let html = `<div class="question-text">${qData.questionText}</div>`;
    
    if (qData.image) {
        html += `<img src="${qData.image}" class="question-image" alt="Question Image">`;
    }

    // Render based on type
    switch(qData.type) {
        case 'mcq':
        case 'tf':
        case 'image':
            html += `<div class="options-grid">`;
            qData.options.forEach(opt => {
                html += `<button class="option-btn" onclick="selectOption(this, '${opt}')">${opt}</button>`;
            });
            html += `</div>`;
            break;
        case 'fitb':
        case 'short':
            html += `<input type="text" id="text-answer" placeholder="Type your answer here...">`;
            break;
        // Note: Drag/Drop and Matching require complex custom drag logic. 
        // For simplicity in this unified file, they fallback to Short Answer logic or dropdowns in actual implementation.
        default:
            html += `<input type="text" id="text-answer" placeholder="Type your answer here...">`;
    }

    qContainer.innerHTML = html;
}

function selectOption(element, value) {
    document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
    userSelectedAnswer = value;
}

// --- LOGIC & GRADING ---
function checkAnswer() {
    const realIndex = activeQuestionList[currentQuestionIndex];
    const qData = worksheetData.questions[realIndex];
    const feedback = document.getElementById('feedback-area');
    let isCorrect = false;
    let actualAnswer = null;

    if (qData.type === 'mcq' || qData.type === 'tf' || qData.type === 'image') {
        if (!userSelectedAnswer) {
            alert("Please select an answer!");
            return;
        }
        actualAnswer = userSelectedAnswer;
        isCorrect = (actualAnswer.toString().toLowerCase() === qData.answer.toString().toLowerCase());
    } else {
        const input = document.getElementById('text-answer');
        if (!input || input.value.trim() === "") {
            alert("Please enter an answer!");
            return;
        }
        actualAnswer = input.value.trim();
        // Array of acceptable answers or single string
        if (Array.isArray(qData.answer)) {
            isCorrect = qData.answer.some(ans => ans.toString().toLowerCase() === actualAnswer.toLowerCase());
        } else {
            isCorrect = (actualAnswer.toLowerCase() === qData.answer.toString().toLowerCase());
        }
    }

    feedback.className = 'feedback-area ' + (isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
        feedback.innerHTML = "🌟 Correct! Great job!";
        if (!isRetryMode) score++; 
    } else {
        feedback.innerHTML = `❌ Oops! That's incorrect. ${isRetryMode ? `<br>Correct Answer: ${Array.isArray(qData.answer) ? qData.answer[0] : qData.answer}` : ''}`;
        if (!isRetryMode && !incorrectQuestions.includes(realIndex)) {
            incorrectQuestions.push(realIndex);
        }
    }

    document.getElementById('score-display').innerText = `Score: ${score}`;
    document.getElementById('check-btn').classList.add('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
}

function showHint() {
    const realIndex = activeQuestionList[currentQuestionIndex];
    const qData = worksheetData.questions[realIndex];
    const feedback = document.getElementById('feedback-area');
    
    if (qData.hint) {
        feedback.innerHTML = `💡 <b>Hint:</b> ${qData.hint}`;
        feedback.className = 'feedback-area hint';
    } else {
        alert("No hint available for this question.");
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < activeQuestionList.length) {
        renderQuestion();
    } else {
        finishWorksheet();
    }
}

function finishWorksheet() {
    quizScreen.classList.add('hidden');
    resultsScreen.classList.remove('hidden');
    
    const maxScore = isRetryMode ? score : activeQuestionList.length; // Keep historical score context
    document.getElementById('final-score-text').innerText = `You scored ${score} out of ${worksheetData.questions.length}!`;
    
    const retryBtn = document.getElementById('retry-btn');
    if (incorrectQuestions.length > 0) {
        retryBtn.classList.remove('hidden');
    } else {
        retryBtn.classList.add('hidden');
    }
}

function retryIncorrect() {
    if (incorrectQuestions.length === 0) return;
    
    isRetryMode = true;
    activeQuestionList = [...incorrectQuestions]; // Set active list to only wrong ones
    incorrectQuestions = []; // Reset tracking for this retry pass
    currentQuestionIndex = 0;
    
    resultsScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    renderQuestion();
}

function resetApp() {
    setupScreen.classList.remove('hidden');
    quizScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    appTitle.textContent = "Fun Learning App";
    worksheetData = null;
}

// --- TEACHER MODE FUNCTIONS ---
function toggleTeacherMode() {
    if (studentView.classList.contains('hidden')) {
        studentView.classList.remove('hidden');
        teacherView.classList.add('hidden');
    } else {
        studentView.classList.add('hidden');
        teacherView.classList.remove('hidden');
        if (worksheetData) {
            document.getElementById('json-editor').value = JSON.stringify(worksheetData, null, 4);
        } else {
            // Default template
            document.getElementById('json-editor').value = JSON.stringify({
                title: "New Worksheet",
                questions: [{ type: "mcq", questionText: "New Question?", options: ["A", "B"], answer: "A", hint: "Think hard!" }]
            }, null, 4);
        }
    }
}

function importTeacherJSON(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('json-editor').value = e.target.result;
        };
        reader.readAsText(file);
    }
}

function exportJSON() {
    const text = document.getElementById('json-editor').value;
    try {
        JSON.parse(text); // validate
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "worksheet.json";
        a.click();
        URL.revokeObjectURL(url);
    } catch(e) {
        alert("Invalid JSON format. Please fix errors before exporting.");
    }
}

function previewWorksheet() {
    const text = document.getElementById('json-editor').value;
    try {
        const data = JSON.parse(text);
        toggleTeacherMode(); // Switch back to student view
        startWorksheet(data);
    } catch(e) {
        alert("Invalid JSON format. Cannot preview.");
    }
}