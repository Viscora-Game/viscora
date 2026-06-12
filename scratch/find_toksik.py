import json

def extract():
    with open(r'C:\Users\Acer\.gemini\antigravity\brain\11aaf379-7df5-4729-bf6d-c3e7d43c16eb\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    idx = 15161
    if idx < len(lines):
        try:
            data = json.loads(lines[idx])
            print(f"--- INDEX {idx} ---")
            print("keys:", list(data.keys()))
            tool_calls = data.get('tool_calls', [])
            print("tool_calls len:", len(tool_calls))
            for tc_idx, tc in enumerate(tool_calls):
                print(f"  Tool {tc_idx}: {tc.get('name')}")
                # Print keys of tc
                print(f"  tc keys: {list(tc.keys())}")
                if 'args' in tc:
                    args = tc['args']
                    print(f"  args keys: {list(args.keys())}")
                    # Write ReplacementContent to a file
                    if 'ReplacementContent' in args:
                        with open("scratch/extracted_replacement_15161.txt", "w", encoding="utf-8") as out:
                            out.write(args['ReplacementContent'])
                        print("  Successfully wrote ReplacementContent to scratch/extracted_replacement_15161.txt")
                    else:
                        print("  No ReplacementContent in args!")
                else:
                    print("  No args in tc!")
        except Exception as e:
            print(f"Error parsing line {idx}: {e}")

if __name__ == '__main__':
    extract()
