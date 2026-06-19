import urllib.request
import json

try:
    url = "https://viscora.onrender.com/api/levels"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print("Error fetching levels:", e)
