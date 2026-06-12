with open('js/game.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'togglePause' in line or 'pause' in line.lower():
        if 'console.log' in line or 'comment' in line:
            continue
        print(f"Line {i+1}: {line.strip()}")
