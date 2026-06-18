import zipfile
import re

apk_path = r"c:\Users\Acer\OneDrive\Masaüstü\ÖNEMLİ KAYBETME\Viscora - Google Play package (1)\Viscora.apk"
with zipfile.ZipFile(apk_path, 'r') as zip_ref:
    manifest_data = zip_ref.read('AndroidManifest.xml')

# Decode UTF-16LE strings which is common in Android binary XML
# Let's extract all sequences of 4+ alphanumeric characters or dots/hyphens
# separated by null bytes or directly.
# Replace any null bytes or non-printable chars with spaces, then use regex
clean_data = ''.join([chr(b) if 32 <= b < 127 else ' ' for b in manifest_data])
words = re.findall(r'[a-zA-Z0-9._-]{2,}', clean_data)
unique_words = set(words)

print("Decoded manifest strings:")
for w in sorted(unique_words):
    if any(char.isdigit() for char in w) or 'viscora' in w.lower():
         if len(w) < 30:
             print("  -", w)
