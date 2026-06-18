import os
import fnmatch

search_paths = [
    (r"c:\Users\Acer\OneDrive\Masaüstü", 3),  # search desktop up to depth 3
    (r"c:\Users\Acer\Downloads", 3),          # search downloads up to depth 3
    (r"c:\Users\Acer\Documents", 3),          # search documents up to depth 3
    (r"c:\Users\Acer", 2)                     # search user home folder up to depth 2 only
]

patterns = [
    "twa-manifest.json",
    "*.keystore",
    "*.jks",
    "android-release-signing.properties",
    "*viscora*.apk",
    "*viscora*.aab",
    "bubblewrap.json"
]

print("Searching for build files with depth limits...")

def search_dir(base_dir, max_depth):
    base_dir = os.path.abspath(base_dir)
    base_slash_count = base_dir.count(os.sep)
    for root, dirs, files in os.walk(base_dir):
        # Exclude common large directories to speed up
        dirs[:] = [d for d in dirs if d not in [
            "node_modules", ".git", "AppData", "Local Settings", 
            "Application Data", "System Volume Information", "$RECYCLE.BIN"
        ]]
        
        # Calculate current depth
        current_depth = root.count(os.sep) - base_slash_count
        if current_depth > max_depth:
            # Clear dirs to prevent going deeper
            dirs.clear()
            continue
            
        for file in files:
            for pattern in patterns:
                if fnmatch.fnmatch(file, pattern):
                    filepath = os.path.join(root, file)
                    try:
                        size = os.path.getsize(filepath)
                        print(f"Found: {filepath} ({size} bytes)")
                    except Exception as e:
                        print(f"Found: {filepath} (Error getting size: {e})")

for path, depth in search_paths:
    if os.path.exists(path):
        print(f"\n--- Searching in: {path} (max depth: {depth}) ---")
        search_dir(path, depth)

print("\nSearch complete!")
