import sys

try:
    with open('js/game.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print("File read successfully as UTF-8.")
    for i, line in enumerate(lines):
        non_ascii = [c for c in line if ord(c) > 127]
        if non_ascii:
            print(f"Line {i+1}: {repr(line[:120])} | Non-ascii ords: {[ord(c) for c in non_ascii]}")
except Exception as e:
    print(f"Error: {e}")
