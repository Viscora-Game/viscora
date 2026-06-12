import os

files = ['index.html', 'js/ui.js', 'js/game.js']
for filename in files:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            for pattern in ['guide', 'rehber', 'tutorial', 'help', 'instructions', 'yardim', 'info-panel', 'how-to']:
                if pattern in line.lower():
                    # safe print using ascii backslashreplace
                    safe_str = repr(line.strip()).encode('ascii', 'backslashreplace').decode('ascii')
                    print(f"{filename} Line {i+1}: {safe_str}")
                    break
