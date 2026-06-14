import os
import re

project_dir = 'c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js'
version = 'v76'

for file in os.listdir(project_dir):
    if file.endswith('.js'):
        filepath = os.path.join(project_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Regex to find imports ending with .js or .js?v=something
        # and replace them with .js?v=version
        new_content = re.sub(
            r"(from\s+['\"])(\./[^'\"]+\.js)(?:\?v=[^'\"]+)?(['\"])",
            rf"\g<1>\g<2>?v={version}\g<3>",
            content
        )
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Busted cache in {file} successfully!")
