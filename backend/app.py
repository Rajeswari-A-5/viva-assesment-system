from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import uuid
from datetime import datetime

from  excel_db import (
    create_excel_file,
    get_students,
    get_questions,
    add_student,
    add_question,
    get_student_by_register_no,
    save_response,
    update_student_result,
    verify_admin,
    delete_question,
    delete_student,
    get_student_responses,
    grade_student_responses,
    get_dashboard_stats,
    seed_default_questions,
    parse_pdf_questions,
    save_lab_session_result,
    get_all_lab_sheets,
    get_lab_sheet_data
)

from flask import Response
import csv
import io


app = Flask(__name__)

CORS(app)


# =========================================================
# CREATE EXCEL FILE & SEED DEFAULT QUESTIONS
# =========================================================

create_excel_file()
seed_default_questions()



# =========================================================
# HOME
# =========================================================

@app.route("/", methods=["GET"])
def home():
    return "VivaTrack Backend is Running"


# =========================================================
# GET ALL STUDENTS
# =========================================================

@app.route("/api/students", methods=["GET"])
def get_all_students():

    students = get_students()

    return jsonify(students)


# =========================================================
# REGISTER A STUDENT
# =========================================================

@app.route("/api/students", methods=["POST"])
def register_student():

    # Get JSON data from request
    data = request.get_json()

    # Check whether data was received
    if not data:
        return jsonify({
            "success": False,
            "message": "No data received."
        }), 400

    # Get student information
    register_no = data.get("registerNo", "").strip()
    name = data.get("name", "").strip()
    batch = data.get("batch", "").strip()

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    if not register_no:
        return jsonify({
            "success": False,
            "message": "Register number is required."
        }), 400

    if not name:
        return jsonify({
            "success": False,
            "message": "Student name is required."
        }), 400

    if not batch:
        return jsonify({
            "success": False,
            "message": "Batch is required."
        }), 400

    # -----------------------------------------------------
    # SAVE STUDENT TO EXCEL
    # -----------------------------------------------------

    success, message = add_student(
        register_no,
        name,
        batch
    )

    # Student already exists
    if not success:
        return jsonify({
            "success": False,
            "message": message
        }), 409

    # Successfully registered
    return jsonify({
        "success": True,
        "message": message
    }), 201


# =========================================================
# GET ALL QUESTIONS
# =========================================================

@app.route("/api/questions", methods=["GET"])
def get_all_questions():

    questions = get_questions()

    return jsonify(questions)


# =========================================================
# START FLASK SERVER
# =========================================================

# =========================================================
# ADD QUESTION
# =========================================================

@app.route("/api/questions", methods=["POST"])
def create_question():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "No data received."
        }), 400

    question_id = data.get("questionId", "").strip()
    question = data.get("question", "").strip()
    question_type = data.get("type", "").strip()
    category = data.get("category", "").strip()
    difficulty = data.get("difficulty", "").strip()

    option_a = data.get("optionA", "").strip()
    option_b = data.get("optionB", "").strip()
    option_c = data.get("optionC", "").strip()
    option_d = data.get("optionD", "").strip()

    correct_answer = data.get("correctAnswer", "").strip()

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    if not question_id:
        return jsonify({
            "success": False,
            "message": "Question ID is required."
        }), 400

    if not question:
        return jsonify({
            "success": False,
            "message": "Question is required."
        }), 400

    if not question_type:
        return jsonify({
            "success": False,
            "message": "Question type is required."
        }), 400

    if question_type not in ["Text", "MCQ"]:
        return jsonify({
            "success": False,
            "message": "Question type must be Text or MCQ."
        }), 400

    if not category:
        return jsonify({
            "success": False,
            "message": "Category is required."
        }), 400

    if not difficulty:
        return jsonify({
            "success": False,
            "message": "Difficulty is required."
        }), 400

    # -----------------------------------------------------
    # SAVE QUESTION
    # -----------------------------------------------------

    success, message = add_question(
        question_id,
        question,
        question_type,
        category,
        difficulty,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer
    )

    if not success:

        return jsonify({
            "success": False,
            "message": message
        }), 409

    return jsonify({
        "success": True,
        "message": message
    }), 201

# =========================================================
# START ASSESSMENT
# =========================================================

@app.route("/api/assessment/start", methods=["POST"])
def start_assessment():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "No data received."
        }), 400

    register_no = data.get("registerNo", "").strip()
    name = data.get("name", "").strip()
    batch = data.get("batch", "Batch 1").strip()
    group = data.get("group", "Group 1").strip()
    experiment = data.get("experiment", "Experiment 1").strip()

    if not register_no:
        return jsonify({
            "success": False,
            "message": "Register number is required."
        }), 400

    # -----------------------------------------------------
    # CHECK / AUTO-REGISTER STUDENT
    # -----------------------------------------------------

    student = get_student_by_register_no(register_no)

    if not student:
        if name:
            add_student(register_no, name, f"{batch} - {group}")
            student = get_student_by_register_no(register_no)
        else:
            return jsonify({
                "success": False,
                "message": "Student is not registered. Please enter student name to register."
            }), 404

    # Attach group and experiment to student object in session
    student["group"] = group
    student["experiment"] = experiment

    # -----------------------------------------------------
    # GET QUESTION BANK
    # -----------------------------------------------------

    all_questions = get_questions()

    if len(all_questions) < 1:
        return jsonify({
            "success": False,
            "message": "Question bank is empty. Please upload questions first."
        }), 400

    # -----------------------------------------------------
    # RANDOMLY SELECT UP TO 10 QUESTIONS
    # -----------------------------------------------------

    sample_count = min(10, len(all_questions))

    selected_questions = random.sample(
        all_questions,
        sample_count
    )

    # -----------------------------------------------------
    # FORMAT FOR STUDENT
    # -----------------------------------------------------

    student_questions = []

    for question in selected_questions:

        question_data = {
            "id": question["id"],
            "question": question["question"],
            "type": question["type"],
            "category": question["category"],
            "difficulty": question["difficulty"]
        }

        if question["type"] == "MCQ":
            question_data["optionA"] = question["optionA"]
            question_data["optionB"] = question["optionB"]
            question_data["optionC"] = question["optionC"]
            question_data["optionD"] = question["optionD"]

        student_questions.append(question_data)

    return jsonify({
        "success": True,
        "message": "Assessment started successfully.",
        "student": student,
        "questions": student_questions
    }), 200


# =========================================================
# SUBMIT ASSESSMENT
# =========================================================

@app.route("/api/assessment/submit", methods=["POST"])
def submit_assessment():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "No data received."
        }), 400

    register_no = data.get("registerNo", "").strip()
    answers = data.get("answers", [])
    group = data.get("group", "Group 1")
    experiment = data.get("experiment", "Experiment 1")

    if not register_no:
        return jsonify({
            "success": False,
            "message": "Register number is required."
        }), 400

    if not answers:
        return jsonify({
            "success": False,
            "message": "No answers received."
        }), 400

    student = get_student_by_register_no(register_no)

    if not student:
        return jsonify({
            "success": False,
            "message": "Student is not registered."
        }), 404

    questions = get_questions()

    question_map = {
        question["id"]: question
        for question in questions
    }

    mcq_correct = 0
    text_count = 0
    total_mcq = 0

    for answer in answers:

        question_id = answer.get("questionId")
        response = answer.get("answer", "")
        time_taken = answer.get("timeTaken", 0)

        question = question_map.get(question_id)

        if not question:
            continue

        question_type = question["type"]
        response_id = str(uuid.uuid4())

        if question_type == "MCQ":
            total_mcq += 1
            correct_answer = question["correctAnswer"]

            if response.upper() == correct_answer.upper():
                correct = "Yes"
                mcq_correct += 1
            else:
                correct = "No"
        else:
            text_count += 1
            correct = "Pending"

        save_response(
            response_id,
            register_no,
            question_id,
            question["question"],
            question_type,
            response,
            correct,
            time_taken
        )

    if text_count == 0:
        score = mcq_correct
        status = "Completed"
    else:
        score = mcq_correct
        status = "Pending Review"

    end_time = datetime.now().strftime("%H:%M:%S")
    date_today = datetime.now().strftime("%d-%m-%Y")

    update_student_result(
        register_no,
        end_time,
        status,
        score
    )

    # -----------------------------------------------------
    # SAVE TO PER-LAB EXCEL SHEET
    # -----------------------------------------------------
    lab_sheet_name = save_lab_session_result(
        register_no,
        student.get("name", "Student"),
        student.get("batch", "Batch 1"),
        group,
        experiment,
        date_today,
        student.get("startTime", end_time),
        end_time,
        status,
        mcq_correct,
        score
    )

    return jsonify({
        "success": True,
        "message": "Assessment submitted successfully.",
        "registerNo": register_no,
        "mcqCorrect": mcq_correct,
        "mcqTotal": total_mcq,
        "textQuestions": text_count,
        "score": score,
        "status": status,
        "labSheet": lab_sheet_name
    }), 200


# =========================================================
# ADMIN LOGIN
# =========================================================

@app.route("/api/admin/login", methods=["POST"])
def admin_login():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "No data received."
        }), 400

    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email:
        return jsonify({
            "success": False,
            "message": "Email is required."
        }), 400

    if not password:
        return jsonify({
            "success": False,
            "message": "Password is required."
        }), 400

    # Check credentials
    admin = verify_admin(email, password)

    if not admin:
        return jsonify({
            "success": False,
            "message": "Invalid email or password."
        }), 401

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "admin": admin
    }), 200


# =========================================================
# DELETE QUESTION
# =========================================================

@app.route("/api/questions/<question_id>", methods=["DELETE"])
def remove_question(question_id):

    success, message = delete_question(question_id)

    if not success:
        return jsonify({
            "success": False,
            "message": message
        }), 404

    return jsonify({
        "success": True,
        "message": message
    }), 200


# =========================================================
# DELETE STUDENT
# =========================================================

@app.route("/api/students/<register_no>", methods=["DELETE"])
def remove_student(register_no):

    success, message = delete_student(register_no)

    if not success:
        return jsonify({
            "success": False,
            "message": message
        }), 404

    return jsonify({
        "success": True,
        "message": message
    }), 200


# =========================================================
# GET STUDENT RESPONSES FOR TEACHER EVALUATION
# =========================================================

@app.route("/api/students/<register_no>/responses", methods=["GET"])
def fetch_student_responses(register_no):

    student = get_student_by_register_no(register_no)
    if not student:
        return jsonify({
            "success": False,
            "message": "Student not found."
        }), 404

    responses = get_student_responses(register_no)

    return jsonify({
        "success": True,
        "student": student,
        "responses": responses
    }), 200


# =========================================================
# GRADE STUDENT ASSESSMENT (TEACHER EVALUATION)
# =========================================================

@app.route("/api/students/<register_no>/grade", methods=["POST"])
def grade_student(register_no):

    data = request.get_json()
    if not data:
        return jsonify({
            "success": False,
            "message": "No data received."
        }), 400

    score = data.get("score")
    remarks = data.get("remarks", "")
    status = data.get("status", "Completed")

    if score is None:
        return jsonify({
            "success": False,
            "message": "Score is required."
        }), 400

    success, message = grade_student_responses(
        register_no,
        score,
        remarks,
        status
    )

    if not success:
        return jsonify({
            "success": False,
            "message": message
        }), 404

    return jsonify({
        "success": True,
        "message": message
    }), 200


# =========================================================
# DASHBOARD STATS
# =========================================================

@app.route("/api/admin/stats", methods=["GET"])
def get_stats():

    stats = get_dashboard_stats()
    return jsonify({
        "success": True,
        "stats": stats
    }), 200


# =========================================================
# SEED SAMPLE QUESTIONS
# =========================================================

@app.route("/api/questions/seed", methods=["POST"])
def seed_questions_route():

    seed_default_questions()
    return jsonify({
        "success": True,
        "message": "Sample viva questions loaded successfully."
    }), 200


# =========================================================
# EXPORT REPORTS (CSV DOWNLOAD)
# =========================================================

@app.route("/api/reports/export", methods=["GET"])
def export_reports():

    students = get_students()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Register No",
        "Name",
        "Batch",
        "Date",
        "Start Time",
        "End Time",
        "Status",
        "Score"
    ])

    for s in students:
        writer.writerow([
            s.get("registerNo", ""),
            s.get("name", ""),
            s.get("batch", ""),
            s.get("date", ""),
            s.get("startTime", ""),
            s.get("endTime", ""),
            s.get("status", ""),
            s.get("score", "")
        ])

    csv_data = output.getvalue()

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=VivaTrack_Report.csv"
        }
    )


# =========================================================
# UPLOAD QUESTION BANK PDF
# =========================================================

@app.route("/api/questions/upload-pdf", methods=["POST"])
def upload_question_pdf():

    if "file" not in request.files:
        return jsonify({
            "success": False,
            "message": "No file attached."
        }), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({
            "success": False,
            "message": "No file selected."
        }), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({
            "success": False,
            "message": "Only PDF files are supported."
        }), 400

    parsed_questions = parse_pdf_questions(file.stream)

    if not parsed_questions:
        return jsonify({
            "success": False,
            "message": "Unable to extract questions from PDF. Please check PDF text format."
        }), 400

    existing_questions = get_questions()
    existing_count = len(existing_questions)

    added_count = 0
    for idx, q in enumerate(parsed_questions):
        if existing_count + added_count >= 50:
            break

        q_id = f"PDF_{existing_count + added_count + 1:02d}"
        success, _ = add_question(
            q_id,
            q["question"],
            q["type"],
            q["category"],
            q["difficulty"],
            q["optionA"],
            q["optionB"],
            q["optionC"],
            q["optionD"],
            q["correctAnswer"]
        )

        if success:
            added_count += 1

    return jsonify({
        "success": True,
        "message": f"Successfully imported {added_count} questions from PDF question bank.",
        "parsedCount": len(parsed_questions),
        "addedCount": added_count
    }), 200


# =========================================================
# GET ALL PER-LAB EXCEL SHEETS
# =========================================================

@app.route("/api/reports/labs", methods=["GET"])
def get_lab_reports_list():

    sheets = get_all_lab_sheets()
    return jsonify({
        "success": True,
        "sheets": sheets
    }), 200


# =========================================================
# EXPORT SPECIFIC PER-LAB EXCEL SHEET AS CSV
# =========================================================

@app.route("/api/reports/lab/<sheet_name>/export", methods=["GET"])
def export_lab_sheet(sheet_name):

    data = get_lab_sheet_data(sheet_name)
    if data is None:
        return jsonify({
            "success": False,
            "message": "Lab sheet not found."
        }), 404

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Register No",
        "Name",
        "Batch",
        "Group",
        "Experiment",
        "Date",
        "Start Time",
        "End Time",
        "Status",
        "MCQ Score",
        "Final Score",
        "Remarks"
    ])

    for row in data:
        writer.writerow([
            row["registerNo"],
            row["name"],
            row["batch"],
            row["group"],
            row["experiment"],
            row["date"],
            row["startTime"],
            row["endTime"],
            row["status"],
            row["mcqScore"],
            row["finalScore"],
            row["remarks"]
        ])

    csv_data = output.getvalue()

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={sheet_name}.csv"
        }
    )


if __name__ == "__main__":

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )

