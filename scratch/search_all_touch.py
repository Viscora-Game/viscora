import os

files = ['index.html', 'js/main.js', 'js/game.js', 'js/ui.js', 'js/editor.js']
for filename in files:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if 'touchmove' in line or 'touchstart' in line:
                safe_str = repr(line.strip()).encode('ascii', 'backslashreplace').decode('ascii')
                print(f"{filename} Line {i+1}: {safe_str}")
