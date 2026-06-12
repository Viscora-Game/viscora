with open(r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js/level.js", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "shadowblur" in line.lower():
            print(f"level.js:{i}: {line.strip()}")
