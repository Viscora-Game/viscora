import os

for filename in ['index.html', 'index.css', 'js/ui.js']:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if 'codex-btn' in line or 'btn-codex' in line or 'codex-card' in line or 'codex-screen' in line:
                safe_str = repr(line.strip()).encode('ascii', 'backslashreplace').decode('ascii')
                print(f"{filename} Line {i+1}: {safe_str}")
