import os

project_dir = 'c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js'

for file in os.listdir(project_dir):
    if file.endswith('.js'):
        filepath = os.path.join(project_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for idx, line in enumerate(lines):
            if 'import' in line and 'from' in line:
                print(f"{file} line {idx+1}: {line.strip()}")
