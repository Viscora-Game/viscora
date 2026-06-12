with open(r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\level.js", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "laser" in line.lower() and "gate" in line.lower() and ("collision" in line.lower() or "===" in line.lower() or "type" in line.lower() or "disable" in line.lower()):
            if "draw" not in line.lower():
                print(f"Line {i}: {line.strip()}")
