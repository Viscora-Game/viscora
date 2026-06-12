with open('js/level.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'switch' in line or 'levelNumber ===' in line or 'levelNumber == 1' in line or 'if (levelNumber ===' in line:
        print(f"Line {i+1}: {line.strip()}")
