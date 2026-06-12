with open(r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\game.js", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "radialgradient" in line.lower() or "createradialgradient" in line.lower() or "shadow" in line.lower() or "filter" in line.lower():
            if i > 500: # Draw and update loop are usually at the bottom
                print(f"game.js:{i}: {line.strip()}")
