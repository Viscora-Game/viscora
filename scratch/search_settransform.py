with open('js/game.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'setTransform' in line:
        print(f"Line {i+1}: {line.strip()}")
