import os

files = ["index.css", "js/ui.js", "js/game.js", "index.html"]

for f in files:
    if os.path.exists(f):
        with open(f, "r", encoding="utf-8") as file:
            for i, line in enumerate(file, 1):
                if any(x in line.lower() for x in ["orientation", "rotate", "döndür", "game-active", "portrait", "landscape"]):
                    print(f"{f}:{i}: {line.strip()}")
