import sys

custom_map = {
    '\u20ac': 0x80,
    '\u201a': 0x82,
    '\u0192': 0x83,
    '\u201e': 0x84,
    '\u2026': 0x85,
    '\u2020': 0x86,
    '\u2021': 0x87,
    '\u02c6': 0x88,
    '\u2030': 0x89,
    '\u0160': 0x8A,
    '\u2039': 0x8B,
    '\u0152': 0x8C,
    '\u2018': 0x91,
    '\u2019': 0x92,
    '\u201c': 0x93,
    '\u201d': 0x94,
    '\u2022': 0x95,
    '\u2013': 0x96,
    '\u2014': 0x97,
    '\u02dc': 0x98,
    '\u2122': 0x99,
    '\u0161': 0x9A,
    '\u203a': 0x9B,
    '\u0153': 0x9C,
    '\u017e': 0x9E,
    '\u0178': 0x9F,
}

def get_byte(c):
    if c in custom_map:
        return custom_map[c]
    code = ord(c)
    if code < 256:
        return code
    return None

def is_continuation(c):
    b = get_byte(c)
    return b is not None and 0x80 <= b <= 0xBF

with open('js/game.js', 'r', encoding='utf-8') as f:
    content = f.read()

recovered_chars = []
i = 0
n = len(content)

while i < n:
    c1 = content[i]
    b1 = get_byte(c1)
    
    # Check if 3-byte sequence starting
    if b1 is not None and 0xE0 <= b1 <= 0xEF and i + 2 < n:
        c2 = content[i+1]
        c3 = content[i+2]
        if is_continuation(c2) and is_continuation(c3):
            b2 = get_byte(c2)
            b3 = get_byte(c3)
            try:
                decoded = bytes([b1, b2, b3]).decode('utf-8')
                recovered_chars.append(decoded)
                i += 3
                continue
            except Exception:
                pass
                
    # Check if 2-byte sequence starting
    if b1 is not None and 0xC0 <= b1 <= 0xDF and i + 1 < n:
        c2 = content[i+1]
        if is_continuation(c2):
            b2 = get_byte(c2)
            try:
                decoded = bytes([b1, b2]).decode('utf-8')
                recovered_chars.append(decoded)
                i += 2
                continue
            except Exception:
                pass
                
    # Otherwise just keep character as is
    recovered_chars.append(c1)
    i += 1

recovered_content = "".join(recovered_chars)

with open('js/game_recovered.js', 'w', encoding='utf-8') as f:
    f.write(recovered_content)

print("Smart recovery finished successfully!")
# Let's count how many Turkish characters are now correct
turkish_chars = 'şışöçüĞİŞÖÇÜ'
counts = {tc: recovered_content.count(tc) for tc in turkish_chars}
print("Turkish character counts in recovered file:")
print(counts)
