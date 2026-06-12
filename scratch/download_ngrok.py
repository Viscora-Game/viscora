import urllib.request
import zipfile
import os

url = "https://bin.equinox.io/a/cJk8dzafvmN/ngrok-v3-3.3.1-windows-amd64.zip"
zip_path = "ngrok.zip"

try:
    print("Downloading ngrok zip...")
    urllib.request.urlretrieve(url, zip_path)
    print("Extracting...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(".")
    print("ngrok.exe has been extracted successfully!")
    if os.path.exists(zip_path):
        os.remove(zip_path)
except Exception as e:
    print("Error downloading or extracting ngrok:", e)
