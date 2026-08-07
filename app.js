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
    // LOGIKA BARU: Tampilkan materi jika ada
    const summaryScreen = document.getElementById('summary-screen');
    if (data.summary && data.summary.trim() !== "") {
        quizScreen.classList.add('hidden');
        summaryScreen.classList.remove('hidden');
        document.getElementById('summary-title').innerText = data.title;
        document.getElementById('summary-content').innerHTML = data.summary;
    } else {
        // Jika tidak ada materi di JSON, langsung mulai kuis
        summaryScreen.classList.add('hidden');
        startQuiz();
    }
}
function startQuiz() {
    document.getElementById('summary-screen').classList.add('hidden');
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
        case 'long':
            html += `<textarea id="text-answer" class="long-answer" placeholder="Type your sentence here..."></textarea>`;
            break;
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
        case 'matching':
            let leftItems = qData.pairs.map(p => p.left);
            let rightItems = qData.pairs.map(p => p.right);
            
            // Pengacakan tingkat lanjut (Fisher-Yates) agar pasti bersilang
            for (let i = rightItems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rightItems[i], rightItems[j]] = [rightItems[j], rightItems[i]];
            }

            window.currentMatchConnections = {}; 
            window.selectedMatchLeft = null;

            html += `
            <div class="match-container" id="match-container">
                <svg id="match-svg"></svg>
                <div class="match-col" id="match-left">
                    ${leftItems.map((item, i) => `<div class="match-item" id="left-${i}" onclick="selectMatchLeft(${i})">${item}</div>`).join('')}
                </div>
                <div class="match-col" id="match-right">
                    ${rightItems.map((item, i) => `<div class="match-item" id="right-${i}" onclick="selectMatchRight(${i})">${item}</div>`).join('')}
                </div>
            </div>`;
            break;
            case 'fill_letters':
            window.currentFillWord = qData.word.toUpperCase();
            window.currentBlanks = qData.blanks; // array angka indeks
            window.userFilled = {}; // menyimpan jawaban anak
            
            // Ambil huruf yang hilang, lalu acak urutannya
            let letters = qData.blanks.map(idx => window.currentFillWord[idx]);
            letters.sort(() => Math.random() - 0.5);
            
            // Buat kotak soal di atas
            let slotsHtml = `<div class="slot-container" id="word-slots">`;
            for(let i = 0; i < window.currentFillWord.length; i++) {
                if (window.currentBlanks.includes(i)) {
                    slotsHtml += `<div class="slot blank" id="slot-${i}" onclick="removeLetter(${i})"></div>`;
                } else {
                    slotsHtml += `<div class="slot filled">${window.currentFillWord[i]}</div>`;
                }
            }
            slotsHtml += `</div>`;
            
            // Buat baki huruf di bawah
            let trayHtml = `<div class="tray" id="letter-tray">`;
            letters.forEach((l, i) => {
                trayHtml += `<div class="slot" id="tray-${i}" onclick="putLetter('${l}', ${i})">${l}</div>`;
            });
            trayHtml += `</div>`;
            
            html += slotsHtml + trayHtml;
            break;
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
    } else if (qData.type === 'long') {
        // CEK SOAL ESAI (Kata Kunci)
        const input = document.getElementById('text-answer');
        if (!input || input.value.trim() === "") { alert("Please type your answer!"); return; }
        
        actualAnswer = input.value.toLowerCase();
        
        // Memeriksa apakah kalimat mengandung SEMUA kata kunci
        if (Array.isArray(qData.answer)) {
            isCorrect = qData.answer.every(keyword => actualAnswer.includes(keyword.toLowerCase()));
        } else {
            isCorrect = actualAnswer.includes(qData.answer.toString().toLowerCase());
        }
    } else if (qData.type === 'matching') {
        // CEK SOAL MATCHING
        if (!window.currentMatchConnections || Object.keys(window.currentMatchConnections).length < qData.pairs.length) {
            alert("Please draw lines for all words before checking!");
            return;
        }
        let allCorrect = true;
        let rightElements = document.querySelectorAll('#match-right .match-item');
        
        for (const [leftIdx, rightIdx] of Object.entries(window.currentMatchConnections)) {
            // Ambil kata dari pasangan asli di JSON, lalu cocokkan dengan kata di layar
            const expectedRightWord = qData.pairs[leftIdx].right.trim();
            const actualRightWord = rightElements[rightIdx].innerText.trim();
            
            if (expectedRightWord !== actualRightWord) {
                allCorrect = false;
                break;
            }
        }
        isCorrect = allCorrect;
        actualAnswer = "Check connections";
    
    } else if (qData.type === 'fill_letters') {
        if (Object.keys(window.userFilled).length < qData.blanks.length) {
            alert("Please fill all the blanks! (Ketuk huruf di bawah untuk mengisi kotak yang kosong)");
            return;
        }
        let allCorrect = true;
        for (let idx of qData.blanks) {
            if (window.userFilled[idx].letter !== window.currentFillWord[idx]) {
                allCorrect = false;
                break;
            }
        }
        isCorrect = allCorrect;
        actualAnswer = "Check letters";
    } else {
        const input = document.getElementById('text-answer');
        if (!input || input.value.trim() === "") { alert("Please enter an answer!"); return; }
        actualAnswer = input.value.trim();
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
    const summaryScreen = document.getElementById('summary-screen');
    if (summaryScreen) summaryScreen.classList.add('hidden');
    appTitle.textContent = "Elmira & Eiliya Learning App";
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
// --- FUNGSI GARIS MATCHING ---
function selectMatchLeft(index) {
    window.selectedMatchLeft = index;
    document.querySelectorAll('#match-left .match-item').forEach(el => el.classList.remove('selected'));
    document.getElementById(`left-${index}`).classList.add('selected');
}

function selectMatchRight(index) {
    if (window.selectedMatchLeft === null) return;
    const leftIndex = window.selectedMatchLeft;
    
    // Simpan sambungan
    window.currentMatchConnections[leftIndex] = index;
    
    // Ubah warna
    document.getElementById(`left-${leftIndex}`).classList.remove('selected');
    document.getElementById(`left-${leftIndex}`).classList.add('connected');
    document.getElementById(`right-${index}`).classList.add('connected');
    
    window.selectedMatchLeft = null;
    drawMatchLines();
}

function drawMatchLines() {
    const svg = document.getElementById('match-svg');
    const container = document.getElementById('match-container');
    if (!svg || !container) return;

    svg.innerHTML = ''; // Hapus garis lama
    const containerRect = container.getBoundingClientRect();

    for (const [leftIdx, rightIdx] of Object.entries(window.currentMatchConnections)) {
        const leftEl = document.getElementById(`left-${leftIdx}`);
        const rightEl = document.getElementById(`right-${rightIdx}`);
        const lRect = leftEl.getBoundingClientRect();
        const rRect = rightEl.getBoundingClientRect();

        // Hitung titik tengah untuk garis
        const x1 = lRect.right - containerRect.left;
        const y1 = lRect.top + lRect.height / 2 - containerRect.top;
        const x2 = rRect.left - containerRect.left;
        const y2 = rRect.top + rRect.height / 2 - containerRect.top;

        svg.innerHTML += `<line class="match-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }
}

// Pastikan garis tidak putus saat layar diubah (misal: iPad diputar)
window.addEventListener('resize', () => {
    if (document.getElementById('match-svg')) drawMatchLines();
});
// --- FUNGSI KOTAK HURUF (FILL LETTERS) ---
function putLetter(letter, trayIndex) {
    // Cari kotak kosong pertama yang belum diisi
    const emptyBlankIdx = window.currentBlanks.find(idx => !window.userFilled.hasOwnProperty(idx));
    
    if (emptyBlankIdx !== undefined) {
        // Catat jawaban
        window.userFilled[emptyBlankIdx] = { letter: letter, trayIndex: trayIndex };
        
        // Pindahkan huruf ke kotak atas
        document.getElementById(`slot-${emptyBlankIdx}`).innerText = letter;
        document.getElementById(`slot-${emptyBlankIdx}`).classList.add('has-letter');
        
        // Sembunyikan huruf di baki bawah
        document.getElementById(`tray-${trayIndex}`).classList.add('hidden');
    }
}

function removeLetter(slotIndex) {
    // Jika kotak yang diketuk ada isinya, kembalikan ke baki bawah
    if (window.userFilled[slotIndex]) {
        const trayIndex = window.userFilled[slotIndex].trayIndex;
        delete window.userFilled[slotIndex];
        
        // Kosongkan kotak atas
        document.getElementById(`slot-${slotIndex}`).innerText = '';
        document.getElementById(`slot-${slotIndex}`).classList.remove('has-letter');
        
        // Munculkan kembali huruf di baki bawah
        document.getElementById(`tray-${trayIndex}`).classList.remove('hidden');
    }
}