const API_URL = "http://127.0.0.1:5000";

// State Variables
let currentStudent = null;
let assessmentQuestions = [];
let currentQuestionIndex = 0;
let studentAnswers = [];
let timerInterval = null;
let timeRemaining = 180; // 3 minutes for 10 questions
let currentEvalStudent = null;
let allStudentsData = [];
let allQuestionsData = [];
let currentSessionInfo = { batch: "Batch 1", group: "Group 1", experiment: "Experiment 1" };

// =========================================================
// PAGE NAVIGATION
// =========================================================
function hideAllPages() {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });
}

function showHome() {
    hideAllPages();
    document.getElementById("homePage").classList.remove("hidden");
    document.getElementById("navHomeBtn").style.display = "none";
}

function showStudentLogin() {
    hideAllPages();
    document.getElementById("studentLoginPage").classList.remove("hidden");
    document.getElementById("navHomeBtn").style.display = "inline-flex";
    document.getElementById("studentLoginMessage").textContent = "";
}

function showAdminLogin() {
    hideAllPages();
    document.getElementById("adminLoginPage").classList.remove("hidden");
    document.getElementById("navHomeBtn").style.display = "inline-flex";
    document.getElementById("adminLoginMessage").textContent = "";
}

// Tab Switching
function switchTab(tabId, element) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    
    document.getElementById(tabId).classList.remove("hidden");
    element.classList.add("active");

    if (tabId === "labSheetsTab") {
        loadLabSheets();
    }
}

// =========================================================
// ADMIN LOGIN & DASHBOARD
// =========================================================
async function adminLogin() {
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    const message = document.getElementById("adminLoginMessage");

    message.textContent = "";

    if (!email || !password) {
        message.style.color = "var(--danger)";
        message.textContent = "Please enter email and password.";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            message.style.color = "var(--danger)";
            message.textContent = data.message || "Invalid credentials.";
            return;
        }

        localStorage.setItem("admin", JSON.stringify(data.admin));
        showAdminDashboard();
    } catch (error) {
        message.style.color = "var(--danger)";
        message.textContent = "Unable to connect to VivaTrack backend server.";
        console.error(error);
    }
}

async function showAdminDashboard() {
    hideAllPages();
    document.getElementById("adminDashboard").classList.remove("hidden");
    document.getElementById("navHomeBtn").style.display = "inline-flex";

    const admin = JSON.parse(localStorage.getItem("admin"));
    if (admin) {
        document.getElementById("adminWelcome").textContent = `Welcome, ${admin.name}`;
    }

    await loadDashboardData();
}

async function loadDashboardData() {
    try {
        const [studentRes, questionRes, statsRes] = await Promise.all([
            fetch(`${API_URL}/api/students`),
            fetch(`${API_URL}/api/questions`),
            fetch(`${API_URL}/api/admin/stats`)
        ]);

        if (studentRes.ok) {
            allStudentsData = await studentRes.json();
        }
        if (questionRes.ok) {
            allQuestionsData = await questionRes.json();
        }

        if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData.success) {
                document.getElementById("studentCount").textContent = statsData.stats.totalStudents;
                document.getElementById("questionCount").textContent = statsData.stats.totalQuestions;
                document.getElementById("completedCount").textContent = statsData.stats.completed;
                document.getElementById("pendingCount").textContent = statsData.stats.pending;
            }
        }

        displayStudents(allStudentsData);
        displayQuestions(allQuestionsData);
    } catch (error) {
        console.error("Dashboard error:", error);
    }
}

// =========================================================
// STUDENTS LIST & EVALUATION
// =========================================================
function displayStudents(students) {
    const container = document.getElementById("studentTable");

    if (!students || students.length === 0) {
        container.innerHTML = "<p style='color: var(--text-secondary); padding: 20px; text-align: center;'>No registered students found.</p>";
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Reg No</th>
                    <th>Name</th>
                    <th>Batch / Group</th>
                    <th>Date / Time</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    students.forEach(s => {
        const statusStr = (s.status || "Pending").toLowerCase();
        let badgeClass = "badge-warning";
        if (statusStr === "completed") badgeClass = "badge-success";

        const scoreDisplay = (s.score !== null && s.score !== undefined && s.score !== "") ? `${s.score}` : "--";

        html += `
            <tr>
                <td><strong>${s.registerNo}</strong></td>
                <td>${s.name}</td>
                <td><span class="badge badge-info">${s.batch || "N/A"}</span></td>
                <td>${s.date || "--"} <span style="color: var(--text-muted); font-size: 12px;">${s.startTime || ""}</span></td>
                <td><span class="badge ${badgeClass}">${s.status || "Pending"}</span></td>
                <td><strong>${scoreDisplay}</strong></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm" onclick="openEvalModal('${s.registerNo}')">Evaluate 📝</button>
                        <button class="btn-danger btn-sm" onclick="deleteStudent('${s.registerNo}')">Delete 🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function filterStudents() {
    const query = document.getElementById("searchStudentInput").value.toLowerCase();
    const statusFilter = document.getElementById("filterStatusSelect").value;

    const filtered = allStudentsData.filter(s => {
        const matchesQuery = s.name.toLowerCase().includes(query) || s.registerNo.toLowerCase().includes(query);
        const matchesStatus = (statusFilter === "ALL") || (s.status && s.status.toLowerCase() === statusFilter.toLowerCase());
        return matchesQuery && matchesStatus;
    });

    displayStudents(filtered);
}

// Student Registration
async function registerStudent() {
    const registerNo = document.getElementById("studentRegisterNo").value.trim();
    const name = document.getElementById("studentName").value.trim();
    const batch = document.getElementById("studentBatch").value;
    const message = document.getElementById("registrationMessage");

    message.textContent = "";

    if (!registerNo || !name || !batch) {
        message.style.color = "var(--danger)";
        message.textContent = "Please enter Register No, Name, and select Batch.";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/students`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registerNo, name, batch })
        });

        const data = await response.json();

        if (!response.ok) {
            message.style.color = "var(--danger)";
            message.textContent = data.message || "Failed to register student.";
            return;
        }

        message.style.color = "var(--success)";
        message.textContent = "Student registered successfully!";

        document.getElementById("studentRegisterNo").value = "";
        document.getElementById("studentName").value = "";
        document.getElementById("studentBatch").value = "";

        await loadDashboardData();
    } catch (error) {
        message.style.color = "var(--danger)";
        message.textContent = "Unable to connect to server.";
    }
}

async function deleteStudent(registerNo) {
    if (!confirm(`Are you sure you want to delete student ${registerNo}?`)) return;

    try {
        const response = await fetch(`${API_URL}/api/students/${registerNo}`, {
            method: "DELETE"
        });

        const data = await response.json();
        if (response.ok) {
            await loadDashboardData();
        } else {
            alert(data.message || "Failed to delete student.");
        }
    } catch (error) {
        alert("Server error occurred.");
    }
}

// =========================================================
// TEACHER EVALUATION MODAL LOGIC
// =========================================================
async function openEvalModal(registerNo) {
    currentEvalStudent = registerNo;
    const modal = document.getElementById("evalModal");
    const detailsContainer = document.getElementById("evalStudentDetails");
    const listContainer = document.getElementById("evalResponsesList");

    detailsContainer.innerHTML = "<p>Loading student responses...</p>";
    listContainer.innerHTML = "";
    modal.classList.remove("hidden");

    try {
        const response = await fetch(`${API_URL}/api/students/${registerNo}/responses`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            detailsContainer.innerHTML = `<p style='color: var(--danger);'>${data.message || "Unable to fetch student responses."}</p>`;
            return;
        }

        const student = data.student;
        const responses = data.responses;

        detailsContainer.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.5); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <p><strong>Student Name:</strong> ${student.name} (${student.registerNo}) | <strong>Batch:</strong> ${student.batch}</p>
                <p><strong>Status:</strong> <span class="badge badge-warning">${student.status}</span> | <strong>Current Score:</strong> ${student.score || 0}</p>
            </div>
        `;

        if (!responses || responses.length === 0) {
            listContainer.innerHTML = "<p style='padding: 20px; text-align: center; color: var(--text-secondary);'>No submitted responses logged for this student yet.</p>";
            document.getElementById("evalScoreInput").value = student.score || 0;
            return;
        }

        let mcqCorrectCount = 0;
        let html = "";

        responses.forEach((r, idx) => {
            if (r.questionType === "MCQ" && r.correct === "Yes") {
                mcqCorrectCount++;
            }

            const correctBadge = r.correct === "Yes" ? '<span class="badge badge-success">Correct ✓</span>' : (r.correct === "No" ? '<span class="badge badge-danger">Incorrect ✗</span>' : '<span class="badge badge-warning">Needs Grading</span>');

            html += `
                <div class="eval-item">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span class="badge badge-info">${r.questionType}</span>
                        ${correctBadge}
                    </div>
                    <div class="eval-question">Q${idx + 1}: ${r.question}</div>
                    <div class="eval-response">" ${r.response || "No response provided"} "</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Time Taken: ${r.timeTaken || 0} seconds</div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
        document.getElementById("evalScoreInput").value = student.score || mcqCorrectCount;
    } catch (error) {
        detailsContainer.innerHTML = "<p style='color: var(--danger);'>Error loading data.</p>";
    }
}

function closeEvalModal() {
    document.getElementById("evalModal").classList.add("hidden");
    currentEvalStudent = null;
}

async function saveStudentEvaluation() {
    if (!currentEvalStudent) return;

    const scoreVal = parseFloat(document.getElementById("evalScoreInput").value);
    const remarksVal = document.getElementById("evalRemarksInput").value.trim();

    if (isNaN(scoreVal)) {
        alert("Please enter a valid score.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/students/${currentEvalStudent}/grade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                score: scoreVal,
                remarks: remarksVal,
                status: "Completed"
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeEvalModal();
            await loadDashboardData();
        } else {
            alert(data.message || "Failed to save evaluation.");
        }
    } catch (error) {
        alert("Failed to submit evaluation to server.");
    }
}

// =========================================================
// QUESTION BANK MANAGEMENT
// =========================================================
function displayQuestions(questions) {
    const container = document.getElementById("questionTable");

    if (!questions || questions.length === 0) {
        container.innerHTML = "<p style='color: var(--text-secondary); padding: 20px; text-align: center;'>No questions in bank.</p>";
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Question</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Difficulty</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    questions.forEach(q => {
        let diffBadge = "badge-info";
        if (q.difficulty === "Easy") diffBadge = "badge-success";
        else if (q.difficulty === "Hard") diffBadge = "badge-danger";

        html += `
            <tr>
                <td><strong>${q.id}</strong></td>
                <td>${q.question}</td>
                <td><span class="badge badge-info">${q.type}</span></td>
                <td>${q.category}</td>
                <td><span class="badge ${diffBadge}">${q.difficulty}</span></td>
                <td>
                    <button class="btn-danger btn-sm" onclick="deleteQuestion('${q.id}')">Delete 🗑️</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function toggleMCQOptions() {
    const type = document.getElementById("questionType").value;
    const optionsDiv = document.getElementById("mcqOptions");
    optionsDiv.style.display = (type === "MCQ") ? "block" : "none";
}

async function addQuestion() {
    const questionId = document.getElementById("questionId").value.trim();
    const question = document.getElementById("adminQuestionInput").value.trim();
    const type = document.getElementById("questionType").value;
    const category = document.getElementById("questionCategory").value.trim();
    const difficulty = document.getElementById("questionDifficulty").value;

    const optionA = document.getElementById("optionA").value.trim();
    const optionB = document.getElementById("optionB").value.trim();
    const optionC = document.getElementById("optionC").value.trim();
    const optionD = document.getElementById("optionD").value.trim();
    const correctAnswer = document.getElementById("correctAnswer").value;

    const message = document.getElementById("questionMessage");
    message.textContent = "";

    if (!questionId || !question || !type || !category || !difficulty) {
        message.style.color = "var(--danger)";
        message.textContent = "Please fill out all required question fields.";
        return;
    }

    if (type === "MCQ") {
        if (!optionA || !optionB || !optionC || !optionD || !correctAnswer) {
            message.style.color = "var(--danger)";
            message.textContent = "All MCQ options and the correct answer choice are required.";
            return;
        }
    }

    try {
        const response = await fetch(`${API_URL}/api/questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                questionId,
                question,
                type,
                category,
                difficulty,
                optionA,
                optionB,
                optionC,
                optionD,
                correctAnswer
            })
        });

        const data = await response.json();

        if (!response.ok) {
            message.style.color = "var(--danger)";
            message.textContent = data.message || "Failed to add question.";
            return;
        }

        message.style.color = "var(--success)";
        message.textContent = "Question added to bank successfully!";

        // Reset Form
        document.getElementById("questionId").value = "";
        document.getElementById("adminQuestionInput").value = "";
        document.getElementById("questionType").value = "";
        document.getElementById("questionCategory").value = "";
        document.getElementById("questionDifficulty").value = "";
        document.getElementById("optionA").value = "";
        document.getElementById("optionB").value = "";
        document.getElementById("optionC").value = "";
        document.getElementById("optionD").value = "";
        document.getElementById("correctAnswer").value = "";
        document.getElementById("mcqOptions").style.display = "none";

        await loadDashboardData();
    } catch (error) {
        message.style.color = "var(--danger)";
        message.textContent = "Unable to connect to server.";
    }
}

async function deleteQuestion(questionId) {
    if (!confirm(`Are you sure you want to delete question ${questionId}?`)) return;

    try {
        const response = await fetch(`${API_URL}/api/questions/${questionId}`, {
            method: "DELETE"
        });

        if (response.ok) {
            await loadDashboardData();
        } else {
            alert("Failed to delete question.");
        }
    } catch (error) {
        alert("Server error occurred.");
    }
}

async function seedSampleQuestions() {
    try {
        const response = await fetch(`${API_URL}/api/questions/seed`, {
            method: "POST"
        });
        const data = await response.json();
        alert(data.message || "Sample questions loaded!");
        await loadDashboardData();
    } catch (error) {
        alert("Failed to seed questions.");
    }
}

// =========================================================
// PDF QUESTION BANK UPLOAD MODAL
// =========================================================
function openPdfModal() {
    document.getElementById("pdfModal").classList.remove("hidden");
    document.getElementById("pdfUploadMessage").textContent = "";
}

function closePdfModal() {
    document.getElementById("pdfModal").classList.add("hidden");
}

async function uploadPdfQuestionBank() {
    const fileInput = document.getElementById("pdfFileInput");
    const message = document.getElementById("pdfUploadMessage");
    message.textContent = "";

    if (!fileInput.files || fileInput.files.length === 0) {
        message.style.color = "var(--danger)";
        message.textContent = "Please select a PDF file first.";
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    message.style.color = "var(--info)";
    message.textContent = "Uploading and parsing PDF question bank...";

    try {
        const response = await fetch(`${API_URL}/api/questions/upload-pdf`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            message.style.color = "var(--danger)";
            message.textContent = data.message || "PDF parsing failed.";
            return;
        }

        message.style.color = "var(--success)";
        message.textContent = data.message;
        fileInput.value = "";

        await loadDashboardData();
        setTimeout(closePdfModal, 1800);
    } catch (error) {
        message.style.color = "var(--danger)";
        message.textContent = "Server connection error during upload.";
    }
}

// =========================================================
// PER-LAB EXCEL SHEET MANAGEMENT
// =========================================================
async function loadLabSheets() {
    const container = document.getElementById("labSheetsTable");
    container.innerHTML = "<p style='color: var(--text-secondary); padding: 20px;'>Loading lab sheets...</p>";

    try {
        const response = await fetch(`${API_URL}/api/reports/labs`);
        const data = await response.json();

        if (!response.ok || !data.success || !data.sheets || data.sheets.length === 0) {
            container.innerHTML = "<p style='color: var(--text-secondary); padding: 20px; text-align: center;'>No lab session sheets created yet. After students take viva, separate sheets will appear here.</p>";
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Excel Worksheet Name</th>
                        <th>Student Count</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.sheets.forEach(s => {
            html += `
                <tr>
                    <td><strong><code style="color: #818cf8;">${s.sheetName}</code></strong></td>
                    <td><span class="badge badge-info">${s.studentCount} Students</span></td>
                    <td>
                        <button class="btn-success btn-sm" onclick="exportLabSheet('${s.sheetName}')">Download Lab CSV/Excel 📥</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = "<p style='color: var(--danger);'>Error loading lab sheets.</p>";
    }
}

function exportLabSheet(sheetName) {
    window.open(`${API_URL}/api/reports/lab/${sheetName}/export`, "_blank");
}

function exportReport() {
    window.open(`${API_URL}/api/reports/export`, "_blank");
}

// =========================================================
// STUDENT ASSESSMENT FLOW (10-QUESTION RANDOM VIVA)
// =========================================================
async function startAssessment() {
    const registerNo = document.getElementById("studentRegInput").value.trim();
    const name = document.getElementById("studentNameInput").value.trim();
    const batch = document.getElementById("studentBatchSelect").value;
    const group = document.getElementById("studentGroupSelect").value;
    const experiment = document.getElementById("studentExperimentSelect").value;

    const message = document.getElementById("studentLoginMessage");
    message.textContent = "";

    if (!registerNo || !name) {
        message.style.color = "var(--danger)";
        message.textContent = "Please enter your Register Number and Name.";
        return;
    }

    currentSessionInfo = { batch, group, experiment };

    try {
        const response = await fetch(`${API_URL}/api/assessment/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                registerNo,
                name,
                batch,
                group,
                experiment
            })
        });

        const data = await response.json();

        if (!response.ok) {
            message.style.color = "var(--danger)";
            message.textContent = data.message || "Unable to start assessment.";
            return;
        }

        currentStudent = data.student;
        assessmentQuestions = data.questions;
        currentQuestionIndex = 0;
        studentAnswers = [];

        hideAllPages();
        document.getElementById("assessmentPage").classList.remove("hidden");
        document.getElementById("navHomeBtn").style.display = "none";

        document.getElementById("studentAssessmentTitle").textContent = `Viva Assessment: ${currentStudent.name}`;
        document.getElementById("sessionBatchBadge").textContent = batch;
        document.getElementById("sessionGroupBadge").textContent = group;
        document.getElementById("sessionExpBadge").textContent = experiment.split(":")[0];

        displayQuestion();
    } catch (error) {
        message.style.color = "var(--danger)";
        message.textContent = "Unable to connect to server.";
    }
}

function displayQuestion() {
    const question = assessmentQuestions[currentQuestionIndex];

    document.getElementById("questionNumber").textContent = `Question ${currentQuestionIndex + 1} of ${assessmentQuestions.length}`;
    document.getElementById("studentQuestionText").textContent = question.question;

    document.getElementById("qCategoryBadge").textContent = question.category || "General";
    document.getElementById("qDifficultyBadge").textContent = question.difficulty || "Medium";

    const progressPercent = ((currentQuestionIndex + 1) / assessmentQuestions.length) * 100;
    document.getElementById("progressBarFill").style.width = `${progressPercent}%`;

    const answerArea = document.getElementById("answerArea");
    answerArea.innerHTML = "";

    if (question.type === "MCQ") {
        const options = [
            ["A", question.optionA],
            ["B", question.optionB],
            ["C", question.optionC],
            ["D", question.optionD]
        ];

        options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "option";
            if (studentAnswers[currentQuestionIndex] === opt[0]) {
                btn.classList.add("selected");
            }

            btn.innerHTML = `<span style="font-weight: 700; width: 30px;">${opt[0]}.</span> <span>${opt[1]}</span>`;
            btn.onclick = () => selectMCQOption(opt[0], btn);
            answerArea.appendChild(btn);
        });
    } else {
        const textarea = document.createElement("textarea");
        textarea.className = "text-answer";
        textarea.id = "textAnswerInput";
        textarea.placeholder = "Type your viva response here...";
        textarea.value = studentAnswers[currentQuestionIndex] || "";
        answerArea.appendChild(textarea);
    }

    document.getElementById("prevButton").style.visibility = (currentQuestionIndex > 0) ? "visible" : "hidden";

    const isLast = (currentQuestionIndex === assessmentQuestions.length - 1);
    document.getElementById("nextButton").classList.toggle("hidden", isLast);
    document.getElementById("submitButton").classList.toggle("hidden", !isLast);

    startTimer();
}

function selectMCQOption(letter, element) {
    studentAnswers[currentQuestionIndex] = letter;
    document.querySelectorAll(".option").forEach(btn => btn.classList.remove("selected"));
    element.classList.add("selected");
}

function saveCurrentAnswer() {
    const question = assessmentQuestions[currentQuestionIndex];
    if (question && question.type === "Text") {
        const textarea = document.getElementById("textAnswerInput");
        if (textarea) {
            studentAnswers[currentQuestionIndex] = textarea.value.trim();
        }
    }
}

function nextQuestion() {
    saveCurrentAnswer();
    currentQuestionIndex++;
    displayQuestion();
}

function previousQuestion() {
    saveCurrentAnswer();
    currentQuestionIndex--;
    displayQuestion();
}

// Timer
function startTimer() {
    clearInterval(timerInterval);
    timeRemaining = 180;
    updateTimerDisplay();

    const timerBox = document.getElementById("timerBox");
    timerBox.classList.remove("warning");

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 30) {
            timerBox.classList.add("warning");
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            saveCurrentAnswer();
            if (currentQuestionIndex < assessmentQuestions.length - 1) {
                currentQuestionIndex++;
                displayQuestion();
            } else {
                submitAssessment();
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById("timer").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function submitAssessment() {
    saveCurrentAnswer();
    clearInterval(timerInterval);

    const answers = assessmentQuestions.map((q, idx) => ({
        questionId: q.id,
        answer: studentAnswers[idx] || "",
        timeTaken: 180 - timeRemaining
    }));

    try {
        const response = await fetch(`${API_URL}/api/assessment/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                registerNo: currentStudent.registerNo,
                group: currentSessionInfo.group,
                experiment: currentSessionInfo.experiment,
                answers: answers
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Error submitting assessment.");
            return;
        }

        hideAllPages();
        document.getElementById("completionPage").classList.remove("hidden");

        document.getElementById("completionStudent").textContent = `${currentStudent.name} (${currentStudent.registerNo})`;
        document.getElementById("completionSession").textContent = `${currentSessionInfo.batch} | ${currentSessionInfo.group} | ${currentSessionInfo.experiment.split(":")[0]}`;
        document.getElementById("completionQuestions").textContent = `${assessmentQuestions.length}`;
        document.getElementById("completionScore").textContent = `${data.mcqCorrect} / ${data.mcqTotal} (MCQs)`;

        const labSheetBadge = document.getElementById("completionLabSheet");
        labSheetBadge.textContent = data.labSheet || "Lab Sheet";

        const statusBadge = document.getElementById("completionStatus");
        if (data.status === "Completed") {
            statusBadge.className = "badge badge-success";
            statusBadge.textContent = "Completed";
        } else {
            statusBadge.className = "badge badge-warning";
            statusBadge.textContent = "Pending Faculty Review";
        }
    } catch (error) {
        alert("Unable to submit assessment.");
    }
}