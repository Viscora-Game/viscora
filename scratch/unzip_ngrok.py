import zipfile
import os

zip_path = r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA\ngrok.zip"
dest_dir = r"c:\Users\Acer\OneDrive\Masaüstü\VISCORA"

try:
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(dest_dir)
        print("Success! ngrok.zip extracted successfully.")
        print("Files in destination:", os.listdir(dest_dir))
except Exception as e:
    print("Error unzipping:", e)
