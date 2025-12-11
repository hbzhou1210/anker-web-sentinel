#!/usr/bin/env python3
import re

files_to_fix = [
    'frontend/src/pages/ResponsiveTesting.tsx',
    'frontend/src/pages/PatrolManagement.tsx',
    'frontend/src/pages/TestPointExtraction.tsx',
    'frontend/src/components/UITestResults/UITestResults.tsx'
]

for filepath in files_to_fix:
    with open(filepath, 'r') as f:
        content = f.read()

    # 删除所有错误插入的 import getFullApiUrl
    content = re.sub(r'import { getFullApiUrl } from [\'"]\.\.?\/\.\.?\/services\/api[\'"];\n', '', content)

    # 在正确位置添加 import
    if 'UITestResults' in filepath:
        # 组件目录,使用 ../../
        import_line = "import { getFullApiUrl } from '../../services/api';\n"
    else:
        # pages 目录,使用 ../
        import_line = "import { getFullApiUrl } from '../services/api';\n"

    # 找到最后一个 import 语句的位置
    import_matches = list(re.finditer(r'^import .+;$', content, re.MULTILINE))
    if import_matches:
        last_import_end = import_matches[-1].end()
        # 在最后一个 import 后插入
        content = content[:last_import_end] + '\n' + import_line + content[last_import_end+1:]

    with open(filepath, 'w') as f:
        f.write(content)

    print(f"✓ 修复 {filepath}")
