import os

for filename in ["js/player.js", "js/game.js"]:
    with open(filename, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if "die" in line.lower() or "takedamage" in line.lower() or "gameover" in line.lower() or "respawn" in line.lower():
                print(f"{filename}:{i}: {line.strip()}")
