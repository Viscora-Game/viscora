import sys

with open('js/game_recovered.js', 'r', encoding='utf-8') as f:
    content = f.read()

corrupted_patterns = ['Ã¼', 'Ã¶', 'Ã§', 'Å\x9f', 'Ä\xb1', 'Ä\x9f', 'Ã\x9c', 'Ã\x96', 'Ã\x87', 'Å\x9e', 'Ä\xb0', 'Ä\x9e']

found = False
for pattern in corrupted_patterns:
    if pattern in content:
        print(f"Warning: found corrupted pattern '{repr(pattern)}' in recovered file!")
        found = True

# Also check for individual unresolved Ã followed by non-ascii or other weird chars
for i in range(len(content) - 1):
    if content[i] == 'Ã' and ord(content[i+1]) > 127:
        print(f"Warning: potential corruption at pos {i}: {repr(content[i:i+5])}")
        found = True

if not found:
    print("Verification passed! No common corruption patterns found in game_recovered.js.")
else:
    print("Verification failed.")
