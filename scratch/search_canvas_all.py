import os

js_dir = 'js'
for filename in os.listdir(js_dir):
    if filename.endswith('.js') and filename != 'game.js':
        path = os.path.join(js_dir, filename)
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if 'canvas.width' in line or 'canvas.height' in line:
                print(f"{filename} Line {i+1}: {line.strip()}")
