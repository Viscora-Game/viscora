import json

log_file = r"C:\Users\Acer\.gemini\antigravity\brain\11aaf379-7df5-4729-bf6d-c3e7d43c16eb\.system_generated\logs\transcript.jsonl"

with open(log_file, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        if idx+1 in [10780, 10789, 11920, 12259]:
            try:
                data = json.loads(line)
                for tc in data.get('tool_calls', []):
                    if tc.get('name') == 'run_command':
                        print(f"Line {idx+1} command: {tc['args']['CommandLine']}")
            except Exception as e:
                print(f"Error at line {idx+1}: {e}")
