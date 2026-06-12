with open('index.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'menu-card' in line or 'screen' in line:
        # print lines around
        print(f"Line {i+1}: {line.strip()}")
