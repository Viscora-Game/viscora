import urllib.request
import json
import time

API_URL = "http://localhost:3000"

def test_api():
    print("--- 1. Testing GET /api/levels on empty/existing DB ---")
    try:
        req = urllib.request.urlopen(f"{API_URL}/api/levels")
        levels = json.loads(req.read().decode('utf-8'))
        print(f"GET returned successfully: {len(levels)} levels found.")
    except Exception as e:
        print("GET levels failed:", e)
        return False

    print("\n--- 2. Testing POST /api/levels to publish a new map ---")
    mock_level_data = {
        "name": "Test Lab",
        "author": "Sudenaz Test",
        "data": {
            "width": 1200,
            "height": 600,
            "spawn": {"x": 100, "y": 300},
            "portal": {"x": 900, "y": 300, "w": 60, "h": 80, "angle": 0},
            "platforms": [
                {"x": 100, "y": 350, "w": 200, "h": 40, "type": "normal"},
                {"x": 400, "y": 300, "w": 200, "h": 40, "type": "sticky"}
            ]
        }
    }
    
    try:
        req_data = json.dumps(mock_level_data).encode('utf-8')
        req = urllib.request.Request(
            f"{API_URL}/api/levels",
            data=req_data,
            headers={'Content-Type': 'application/json'}
        )
        res = urllib.request.urlopen(req)
        created_level = json.loads(res.read().decode('utf-8'))
        print("POST Level returned successfully:", json.dumps(created_level, indent=2))
        level_id = created_level['id']
        assert created_level['name'] == "Test Lab"
        assert created_level['author'] == "Sudenaz Test"
        assert created_level['likes'] == 0
    except Exception as e:
        print("POST level failed:", e)
        return False

    print("\n--- 3. Testing GET /api/levels again to verify presence and sorting ---")
    try:
        req = urllib.request.urlopen(f"{API_URL}/api/levels")
        levels = json.loads(req.read().decode('utf-8'))
        found = any(lvl['id'] == level_id for lvl in levels)
        print(f"GET levels verified. Created level is in DB: {found}")
        assert found, "Created level not found in GET response"
    except Exception as e:
        print("GET level verification failed:", e)
        return False

    print("\n--- 4. Testing POST /api/levels/<id>/like to vote for the map ---")
    try:
        req = urllib.request.Request(
            f"{API_URL}/api/levels/{level_id}/like",
            data=b"",
            headers={'Content-Type': 'application/json'}
        )
        res = urllib.request.urlopen(req)
        liked_level = json.loads(res.read().decode('utf-8'))
        print("POST Like returned successfully:", json.dumps(liked_level, indent=2))
        assert liked_level['likes'] == 1, "Likes count did not increase to 1"
    except Exception as e:
        print("POST like failed:", e)
        return False

    print("\n--- 5. Testing sorting (Popular vs New) ---")
    try:
        # Publish another level
        another_level_data = {
            "name": "Second Lab",
            "author": "Sudenaz Test 2",
            "data": {"width": 800, "height": 600}
        }
        req_data = json.dumps(another_level_data).encode('utf-8')
        req = urllib.request.Request(
            f"{API_URL}/api/levels",
            data=req_data,
            headers={'Content-Type': 'application/json'}
        )
        res = urllib.request.urlopen(req)
        another_level = json.loads(res.read().decode('utf-8'))
        another_id = another_level['id']

        # Get sorted by popular (Test Lab should be first because it has 1 like, Second Lab has 0 likes)
        req_pop = urllib.request.urlopen(f"{API_URL}/api/levels?sort=popular")
        levels_pop = json.loads(req_pop.read().decode('utf-8'))
        print("Popular Sort first item:", levels_pop[0]['name'], "Likes:", levels_pop[0]['likes'])
        assert levels_pop[0]['id'] == level_id, "Test Lab (liked) should be first in popular sort"

        # Get sorted by new (Second Lab should be first because it was created last)
        req_new = urllib.request.urlopen(f"{API_URL}/api/levels?sort=new")
        levels_new = json.loads(req_new.read().decode('utf-8'))
        print("New Sort first item:", levels_new[0]['name'], "Likes:", levels_new[0]['likes'])
        assert levels_new[0]['id'] == another_id, "Second Lab (newer) should be first in new sort"
        
        print("\nAll API tests PASSED successfully!")
        return True
    except Exception as e:
        print("Sorting tests failed:", e)
        return False

if __name__ == "__main__":
    test_api()
