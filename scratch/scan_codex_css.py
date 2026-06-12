with open('index.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's search for codex-btn and print lines around it
lines = content.splitlines()
for i, line in enumerate(lines):
    if 'codex-btn' in line or 'btn-codex' in line:
        start = max(0, i - 5)
        end = min(len(lines), i + 8)
        print(f"--- Line {i+1} ---")
        for j in range(start, end):
            print(f"{j+1}: {lines[j]}")
