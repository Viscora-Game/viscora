import os

old_ver = 'v111'
new_ver = 'v112'


# 1. Update js/ files imports
js_dir = 'c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js'
for file in os.listdir(js_dir):
    if file.endswith('.js'):
        filepath = os.path.join(js_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = content.replace(f'?v={old_ver}', f'?v={new_ver}')
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Bumped version in JS file: {file}")

# 2. Update sw.js
sw_path = 'c:/Users/Acer/OneDrive/Masaüstü/VISCORA/sw.js'
with open(sw_path, 'r', encoding='utf-8') as f:
    content = f.read()
new_content = content.replace(f'-{old_ver}', f'-{new_ver}').replace(f'?v={old_ver}', f'?v={new_ver}')
if new_content != content:
    with open(sw_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Bumped version in sw.js")

# 3. Update index.html
html_path = 'c:/Users/Acer/OneDrive/Masaüstü/VISCORA/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()
new_content = content.replace(f'?v={old_ver}', f'?v={new_ver}')
if new_content != content:
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Bumped version in index.html")
