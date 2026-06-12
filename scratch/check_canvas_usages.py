import sys

with open('js/game.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'this.canvas.width' in line or 'this.canvas.height' in line:
        # Ignore lines where canvas.width or canvas.height are being assigned to
        if '=' in line and 'this.canvas.width' in line.split('=')[0]:
            continue
        if '=' in line and 'this.canvas.height' in line.split('=')[0]:
            continue
        print(f"Line {i+1}: {line.strip()}")
