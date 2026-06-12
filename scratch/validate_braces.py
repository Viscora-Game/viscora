# Smart brace validator for JS files

def check_braces_smart(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    i = 0
    line_no = 1
    char_no = 1
    n = len(content)
    
    while i < n:
        char = content[i]
        
        # Track line and column numbers
        if char == '\n':
            line_no += 1
            char_no = 1
            i += 1
            continue
            
        # Ignore comments
        if i + 1 < n and content[i:i+2] == '//':
            # Skip till newline
            while i < n and content[i] != '\n':
                i += 1
            continue
        if i + 1 < n and content[i:i+2] == '/*':
            start_line, start_col = line_no, char_no
            i += 2
            char_no += 2
            while i + 1 < n and content[i:i+2] != '*/':
                if content[i] == '\n':
                    line_no += 1
                    char_no = 1
                else:
                    char_no += 1
                i += 1
            if i + 1 >= n:
                print(f'{filename}: Unclosed block comment starting at line {start_line}, col {start_col}')
                return False
            i += 2
            char_no += 2
            continue
            
        # Ignore string literals
        if char in ["'", '"', '`']:
            quote_char = char
            start_line, start_col = line_no, char_no
            i += 1
            char_no += 1
            escaped = False
            while i < n:
                curr = content[i]
                if curr == '\n':
                    line_no += 1
                    char_no = 1
                else:
                    char_no += 1
                
                if escaped:
                    escaped = False
                elif curr == '\\':
                    escaped = True
                elif curr == quote_char:
                    break
                i += 1
            if i >= n:
                print(f'{filename}: Unclosed string literal starting at line {start_line}, col {start_col}')
                return False
            i += 1
            char_no += 1
            continue
            
        # Check braces
        if char in '{[(':
            stack.append((char, line_no, char_no))
        elif char in '}])':
            if not stack:
                print(f'{filename}: Unmatched closing brace {char} at line {line_no}, col {char_no}')
                return False
            top_char, top_line, top_col = stack.pop()
            if (char == '}' and top_char != '{') or \
               (char == ']' and top_char != '[') or \
               (char == ')' and top_char != '('):
                print(f'{filename}: Mismatched braces {top_char} (line {top_line}, col {top_col}) and {char} (line {line_no}, col {char_no})')
                return False
        
        i += 1
        char_no += 1
        
    if stack:
        print(f'{filename}: Unclosed braces at end of file:')
        for item in stack[-5:]:
            print(f'  {item[0]} at line {item[1]}, col {item[2]}')
        return False
    
    print(f'{filename}: All braces and parentheses match perfectly!')
    return True

check_braces_smart('c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js/level.js')
check_braces_smart('c:/Users/Acer/OneDrive/Masaüstü/VISCORA/js/generator.js')
