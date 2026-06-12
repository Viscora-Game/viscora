with open('js/level.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'class Level' in line or 'loadLevel' in line or 'levelData' in line or 'LEVELS' in line:
        print(f"Line {i+1}: {line.strip()}")
