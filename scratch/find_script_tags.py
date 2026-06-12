with open('c:/Users/Acer/OneDrive/Masaüstü/VISCORA/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if '<script' in line or 'src=' in line:
        print(f"Line {idx+1}: {line.strip()}")
