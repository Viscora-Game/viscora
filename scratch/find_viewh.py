with open('c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js/level.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'viewH' in line or 'viewW' in line:
        print(f"Line {i+1}: {line.strip()}")
