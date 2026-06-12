import sys

# Custom mapping for Windows-1252 characters that aren't in Latin-1 range but got translated
custom_map = {
    '\u20ac': 0x80, # Euro
    '\u201a': 0x82,
    '\u0192': 0x83,
    '\u201e': 0x84,
    '\u2026': 0x85, # Ellipsis
    '\u2020': 0x86, # Dagger
    '\u2021': 0x87, # Double dagger
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
    '\u2013': 0x96, # En-dash
    '\u2014': 0x97,
    '\u02dc': 0x98,
    '\u2122': 0x99,
    '\u0161': 0x9A,
    '\u203a': 0x9B,
    '\u0153': 0x9C,
    '\u017e': 0x9E,
    '\u0178': 0x9F,
}

try:
    with open('js/game.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    out_bytes = bytearray()
    
    for i, c in enumerate(content):
        code = ord(c)
        if c in custom_map:
            out_bytes.append(custom_map[c])
        elif code < 256:
            out_bytes.append(code)
        else:
            # Already correct UTF-8 character, encode it back to UTF-8 bytes
            out_bytes.extend(c.encode('utf-8'))
            
    print("All characters processed!")
    # Try to decode the resulting bytes as UTF-8
    decoded = out_bytes.decode('utf-8')
    print("Decoded as UTF-8 successfully!")
    with open('js/game_recovered.js', 'w', encoding='utf-8') as f:
        f.write(decoded)
    print("Recovered file written to js/game_recovered.js")
except Exception as e:
    print("Error:", e)
