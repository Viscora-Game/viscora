with open('c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js/level.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'theme =' in line or 'this.theme =' in line:
        print(f"Line {i+1}: {line.strip()}")
