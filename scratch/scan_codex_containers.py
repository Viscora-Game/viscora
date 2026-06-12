with open('index.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'codex-content-container' in line or 'codex-tab-content' in line or 'codex-row' in line:
        start = max(0, i - 3)
        end = min(len(lines), i + 6)
        print(f"--- Line {i+1} ---")
        for j in range(start, end):
            print(f"{j+1}: {lines[j].strip()}")
