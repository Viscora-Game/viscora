import os

file_path = 'js/editor.js'
if not os.path.exists(file_path):
    print("editor.js not found!")
    sys.exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace this.game.canvas.width with this.game.cssWidth
# Replace this.game.canvas.height with this.game.cssHeight
new_content = content.replace('this.game.canvas.width', 'this.game.cssWidth')
new_content = new_content.replace('this.game.canvas.height', 'this.game.cssHeight')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replaced canvas dimensions in editor.js successfully!")
