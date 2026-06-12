import os
import shutil

source = 'js/game_recovered.js'
destination = 'js/game.js'

try:
    if os.path.exists(source):
        shutil.copyfile(source, destination)
        os.remove(source)
        print("Restored game.js successfully!")
    else:
        print("Source file not found!")
except Exception as e:
    print("Error during restore:", e)
