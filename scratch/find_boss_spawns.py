import os

project_dir = 'c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js'

for file in os.listdir(project_dir):
    if file.endswith('.js'):
        filepath = os.path.join(project_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'new Boss' in content or 'Boss(' in content:
            print(f"Boss spawned in {file}!")
            # Print matching lines
            lines = content.split('\n')
            for idx, line in enumerate(lines):
                if 'new Boss' in line or 'Boss(' in line:
                    print(f"  Line {idx+1}: {line.strip()}")
