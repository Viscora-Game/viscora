import os
import re

dir_to_search = r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA"
pattern = re.compile(r"audio\.", re.IGNORECASE)

for root, dirs, files in os.walk(dir_to_search):
    if ".git" in root or ".gemini" in root or "scratch" in root:
        continue
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for i, line in enumerate(f, 1):
                        if pattern.search(line):
                            print(f"{file}:{i}: {line.strip()}")
            except Exception as e:
                print(f"Error reading {file}: {e}")
