import os

search_terms = ['strokeRect', 'gridSize', 'grid', 'ızgara']
project_dir = 'c:/Users/Acer/OneDrive/Masaüstü/VISCORA'

for root, dirs, files in os.walk(project_dir):
    for file in files:
        if file.endswith('.js') or file.endswith('.html') or file.endswith('.css'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            for term in search_terms:
                if term in content:
                    # Print matching lines
                    lines = content.split('\n')
                    for idx, line in enumerate(lines):
                        if term in line:
                            print(f"{file} line {idx+1}: {line.strip()}")
