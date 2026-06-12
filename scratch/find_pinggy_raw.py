log_file = r"C:\Users\Acer\.gemini\antigravity\brain\11aaf379-7df5-4729-bf6d-c3e7d43c16eb\.system_generated\logs\transcript.jsonl"

with open(log_file, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        if 'pinggy.io' in line:
            # print first 200 chars of the matching line
            print(f"Line {idx+1}: {line[:250]}...")
