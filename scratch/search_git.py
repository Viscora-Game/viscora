import os

path_dirs = os.environ.get('PATH', '').split(os.pathsep)
found = []
for d in path_dirs:
    p = os.path.join(d, 'git.exe')
    if os.path.exists(p):
        print("Found git in PATH:", p)
        found.append(p)
    p_cmd = os.path.join(d, 'git.cmd')
    if os.path.exists(p_cmd):
        print("Found git.cmd in PATH:", p_cmd)
        found.append(p_cmd)

if not found:
    print("git not found in PATH directories.")
