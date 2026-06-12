import json
import os

transcript_path = r'C:\Users\Acer\.gemini\antigravity\brain\11aaf379-7df5-4729-bf6d-c3e7d43c16eb\.system_generated\logs\transcript.jsonl'

if not os.path.exists(transcript_path):
    print("Transcript not found at:", transcript_path)
    sys.exit(1)

print("Searching transcript.jsonl...")

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            step_index = step.get('step_index')
            tool_calls = step.get('tool_calls', [])
            for tc in tool_calls:
                args = tc.get('args', {})
                # Check if this tool call is related to game.js
                target = args.get('TargetFile', '') or args.get('AbsolutePath', '') or args.get('CommandLine', '')
                if 'game.js' in target:
                    print(f"Step {step_index}: {tc.get('name')} | args: {list(args.keys())}")
                    # Print preview of instructions or description
                    if 'Instruction' in args:
                        print(f"  Instruction: {args['Instruction']}")
                    if 'Description' in args:
                        print(f"  Description: {args['Description']}")
        except Exception as e:
            pass
