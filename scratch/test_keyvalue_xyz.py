import urllib.request
import urllib.error

try:
    # To create a new key in keyvalue.xyz, we send a POST request to https://api.keyvalue.xyz/new
    # with a key name in the path or just POST to https://api.keyvalue.xyz/new
    req = urllib.request.Request("https://api.keyvalue.xyz/new", data=b"", method="POST")
    with urllib.request.urlopen(req) as resp:
        url_with_token = resp.read().decode('utf-8').strip()
        print("New key URL created:", url_with_token)
        
        # Now let's try writing to it
        write_req = urllib.request.Request(
            url_with_token,
            data=b"hello_world_keyvalue_xyz",
            method="POST"
        )
        with urllib.request.urlopen(write_req) as write_resp:
            print("Write success! Status:", write_resp.status)
            
        # Now let's read it back
        read_req = urllib.request.Request(url_with_token)
        with urllib.request.urlopen(read_req) as read_resp:
            print("Read back:", read_resp.read().decode('utf-8'))
except Exception as e:
    print("Error with keyvalue.xyz:", e)
