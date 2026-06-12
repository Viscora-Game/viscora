import os

log_path = r"C:\Users\Acer\.gemini\antigravity\brain\11aaf379-7df5-4729-bf6d-c3e7d43c16eb\.system_generated\tasks\task-10352.log"

if os.path.exists(log_path):
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    print("LOG CONTENT:")
    for line in content.splitlines():
        cleaned = line.strip()
        if cleaned:
            print(cleaned)
else:
    print("Log file not found yet.")
