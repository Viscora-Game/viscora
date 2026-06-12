import os

files_to_update = [
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\boss.js",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\editor.js",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\game.js",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\level.js",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\main.js",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\player.js",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\js\ui.js",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\index.html",
    r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\sw.js"
]

for filepath in files_to_update:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace v20 with v21
        new_content = content.replace('?v=v20', '?v=v21')
        # Also replace viscora-cache-v15 with viscora-cache-v16 in sw.js
        if "sw.js" in filepath:
            new_content = new_content.replace('viscora-cache-v15', 'viscora-cache-v16')
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(filepath)}")
    else:
        print(f"File not found: {filepath}")
