import os

for root, dirs, files in os.walk(r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA"):
    if ".git" in root or ".gemini" in root or "scratch" in root:
        continue
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                for i, line in enumerate(f, 1):
                    if "clientx" in line.lower() or "pagex" in line.lower() or "offsetx" in line.lower() or "touches" in line.lower():
                        print(f"{file}:{i}: {line.strip()}")
