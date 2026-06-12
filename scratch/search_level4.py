with open(r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js/level.js", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "levelnumber ===" in line.lower() or "levelnumber ==" in line.lower() or "levelnumber == 4" in line.lower():
            print(f"Line {i}: {line.strip()}")
