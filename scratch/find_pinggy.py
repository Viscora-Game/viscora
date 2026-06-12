import os
import json

log_file = r"C:\Users\Acer\.gemini\antigravity\brain\11aaf379-7df5-4729-bf6d-c3e7d43c16eb\.system_generated\logs\transcript.jsonl"

if os.path.exists(log_file):
    with open(log_file, 'r', encoding='utf-8') as f:
        for line in f:
            if 'pinggy' in line:
                try:
                    data = json.loads(line)
                    # Check tool calls or command lines
                    if 'tool_calls' in data:
                        for tc in data['tool_calls']:
                            if 'CommandLine' in tc.get('arguments', {}):
                                print("Command:", tc['arguments']['CommandLine'])
                except Exception as e:
                    pass
else:
    print("Log file not found!")
