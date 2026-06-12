with open('js/ui.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'this.screens' in line:
        print(f"Line {i+1}: {line.strip()}")
