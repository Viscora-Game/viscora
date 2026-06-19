import urllib.request
import urllib.error

bucket_id = "GxUJpUzDriroG5kHq2hepK"
key = "test_key"

# Try raw POST with no headers
try:
    print("Test 1: raw POST with string data")
    req = urllib.request.Request(
        f"https://kvdb.io/{bucket_id}/{key}",
        data=b"hello_world",
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        print("Success!", resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Failed Test 1:", e.code, e.read().decode('utf-8'))

# Try PUT instead
try:
    print("Test 2: raw PUT with string data")
    req = urllib.request.Request(
        f"https://kvdb.io/{bucket_id}/{key}",
        data=b"hello_world_put",
        method="PUT"
    )
    with urllib.request.urlopen(req) as resp:
        print("Success!", resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Failed Test 2:", e.code, e.read().decode('utf-8'))
