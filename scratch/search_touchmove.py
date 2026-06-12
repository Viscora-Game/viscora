with open('js/ui.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'touchmove' in line or 'preventdefault' in line.lower():
        print(f"Line {i+1}: {line.strip()}")
