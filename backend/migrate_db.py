import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "legal_complaints.db"))
print(f"Migrating database at: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(complaints)")
cols = [col[1] for col in cursor.fetchall()]
print("Existing columns:", cols)

if "translation_confidence" not in cols:
    cursor.execute("ALTER TABLE complaints ADD COLUMN translation_confidence VARCHAR(20) DEFAULT 'high'")
    print("Added translation_confidence column")

if "language_coverage_confidence" not in cols:
    cursor.execute("ALTER TABLE complaints ADD COLUMN language_coverage_confidence VARCHAR(20) DEFAULT 'HIGH'")
    print("Added language_coverage_confidence column")

cursor.execute("""
UPDATE complaints
SET language_coverage_confidence = CASE
    WHEN detected_lang IN ('en', 'hi', 'te', 'ta', 'bn', 'ur', 'mr', 'gu', 'pa', 'ml', 'fr', 'de') THEN 'HIGH'
    WHEN detected_lang IN ('es', 'ar', 'ru', 'it', 'kn', 'or') THEN 'MEDIUM'
    ELSE 'LOW'
END,
translation_confidence = CASE
    WHEN detected_lang IN ('en', 'hi', 'te', 'ta', 'bn', 'ur', 'ml', 'pa', 'mr', 'fr') THEN 'high'
    WHEN detected_lang IN ('de', 'gu', 'kn') THEN 'medium'
    ELSE 'low'
END
""")

conn.commit()
conn.close()
print("Migration and coverage population completed successfully.")
