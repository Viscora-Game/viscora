with open('index.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'touch-action' in line or 'user-select' in line:
        print(f"Line {i+1}: {line.strip()}")
