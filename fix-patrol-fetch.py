#!/usr/bin/env python3
"""
修复 PatrolManagement.tsx 中所有的 fetch 调用
"""
import re

file_path = '/Users/anker/anita-project/frontend/src/pages/PatrolManagement.tsx'

# 读取文件
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 替换模式
replacements = [
    # fetch('/api/v1/... -> fetch(getFullApiUrl('/api/v1/...
    (r"fetch\('/api/v1/", r"fetch(getFullApiUrl('/api/v1/"),
    # fetch(`/api/v1/... -> fetch(getFullApiUrl(`/api/v1/...
    (r"fetch\(`/api/v1/", r"fetch(getFullApiUrl(`/api/v1/"),
]

# 应用替换
for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

# 写回文件
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ 已修复所有 fetch 调用")
