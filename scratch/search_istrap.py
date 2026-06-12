with open(r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\player.js", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "istrap" in line.lower() or "trapobj" in line.lower():
            print(f"Line {i}: {line.strip()}")
