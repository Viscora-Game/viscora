with open(r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\level.js", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "laser" in line.lower() and ("ctx.fillstyle" in line.lower() or "ctx.strokestyle" in line.lower() or "color" in line.lower() or "shadowcolor" in line.lower()):
            print(f"Line {i}: {line.strip()}")
