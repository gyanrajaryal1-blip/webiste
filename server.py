from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "patient_problems.db"


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patient_problems (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_name TEXT NOT NULL,
                contact TEXT NOT NULL,
                problem TEXT NOT NULL,
                reply TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def row_to_dict(row):
    return {
        "id": row[0],
        "patient_name": row[1],
        "contact": row[2],
        "problem": row[3],
        "reply": row[4] or "",
        "created_at": row[5],
        "updated_at": row[6],
    }


class WebsiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        if self.path == "/api/problems":
            with sqlite3.connect(DB_PATH) as conn:
                rows = conn.execute(
                    """
                    SELECT id, patient_name, contact, problem, reply, created_at, updated_at
                    FROM patient_problems
                    ORDER BY id DESC
                    """
                ).fetchall()
            self.send_json(200, [row_to_dict(row) for row in rows])
            return

        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/problems":
            payload = self.read_json()
            patient_name = str(payload.get("patient_name", "")).strip()
            contact = str(payload.get("contact", "")).strip()
            problem = str(payload.get("problem", "")).strip()

            if not patient_name or not contact or not problem:
                self.send_json(400, {"error": "patient_name, contact, and problem are required"})
                return

            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.execute(
                    """
                    INSERT INTO patient_problems (patient_name, contact, problem)
                    VALUES (?, ?, ?)
                    """,
                    (patient_name, contact, problem),
                )
                conn.commit()
            self.send_json(201, {"id": cursor.lastrowid})
            return

        match = re.fullmatch(r"/api/problems/(\d+)/reply", self.path)
        if match:
            payload = self.read_json()
            reply = str(payload.get("reply", "")).strip()
            pin = str(payload.get("pin", "")).strip()
            problem_id = int(match.group(1))

            if pin != "1111":
                self.send_json(403, {"error": "Invalid PIN"})
                return

            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.execute(
                    """
                    UPDATE patient_problems
                    SET reply = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (reply, problem_id),
                )
                conn.commit()

            if cursor.rowcount == 0:
                self.send_json(404, {"error": "Problem not found"})
                return

            self.send_json(200, {"ok": True})
            return

        match = re.fullmatch(r"/api/problems/(\d+)/delete", self.path)
        if match:
            payload = self.read_json()
            pin = str(payload.get("pin", "")).strip()
            problem_id = int(match.group(1))

            if pin != "1111":
                self.send_json(403, {"error": "Invalid PIN"})
                return

            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.execute(
                    "DELETE FROM patient_problems WHERE id = ?",
                    (problem_id,),
                )
                conn.commit()

            if cursor.rowcount == 0:
                self.send_json(404, {"error": "Problem not found"})
                return

            self.send_json(200, {"ok": True})
            return

        self.send_json(404, {"error": "Not found"})


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), WebsiteHandler)
    print("Serving Dr. Gyan Raj Aryal website at http://127.0.0.1:8000/index.html")
    print(f"Database: {DB_PATH}")
    server.serve_forever()
