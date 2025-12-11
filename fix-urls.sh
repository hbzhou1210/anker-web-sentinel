#!/bin/bash
# 修复所有硬编码的 localhost:3000 URL

cd /Users/anker/anita-project/frontend/src

# 1. 修改 vite.config.ts - 使用绝对路径
sed -i '' "s|base: './', // 使用相对路径，适配子路径部署|base: '/', // 使用绝对路径,部署在根路径|" ../vite.config.ts

# 2. 在 api.ts 中添加 getFullApiUrl 函数
sed -i '' '/const API_BASE_URL = getApiBaseUrl();/a\
\
/**\
 * 获取完整的 API URL\
 * 在生产环境使用相对路径,在开发环境使用完整 URL\
 */\
export const getFullApiUrl = (path: string): string => {\
  // 如果已经是完整 URL,直接返回\
  if (path.startsWith("http://") || path.startsWith("https://")) {\
    return path;\
  }\
\
  // 如果是相对路径,根据环境拼接\
  if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {\
    // 生产环境:使用当前域名\
    return path.startsWith("/") ? path : `/${path}`;\
  }\
\
  // 开发环境:使用 localhost:3000\
  const cleanPath = path.startsWith("/") ? path : `/${path}`;\
  return `http://localhost:3000${cleanPath}`;\
};
' services/api.ts

# 3. 添加 import 到各个文件
echo "import { getFullApiUrl } from '../services/api';" >> /tmp/import_line.txt
sed -i '' '3r /tmp/import_line.txt' pages/ResponsiveTesting.tsx
sed -i '' '3r /tmp/import_line.txt' pages/PatrolManagement.tsx
sed -i '' '3r /tmp/import_line.txt' pages/TestPointExtraction.tsx

echo "import { getFullApiUrl } from '../../services/api';" > /tmp/import_line2.txt
sed -i '' '3r /tmp/import_line2.txt' components/UITestResults/UITestResults.tsx

# 4. 替换所有硬编码 URL
sed -i '' "s|'http://localhost:3000/api/v1/responsive/devices'|getFullApiUrl('/api/v1/responsive/devices')|g" pages/ResponsiveTesting.tsx
sed -i '' "s|'http://localhost:3000/api/v1/responsive/test'|getFullApiUrl('/api/v1/responsive/test')|g" pages/ResponsiveTesting.tsx
sed -i '' 's|`http://localhost:3000${result.screenshotPortraitUrl}`|`${getFullApiUrl(result.screenshotPortraitUrl)}`|g' pages/ResponsiveTesting.tsx
sed -i '' 's|`http://localhost:3000${result.screenshotLandscapeUrl}`|`${getFullApiUrl(result.screenshotLandscapeUrl)}`|g' pages/ResponsiveTesting.tsx

sed -i '' 's|`http://localhost:3000${result.screenshotUrl}`|`${getFullApiUrl(result.screenshotUrl)}`|g' pages/PatrolManagement.tsx
sed -i '' 's|link.href = `http://localhost:3000${expandedScreenshot}`;|link.href = getFullApiUrl(expandedScreenshot);|g' pages/PatrolManagement.tsx

sed -i '' "s|'http://localhost:3000/api/v1/test-points/extract-and-save'|getFullApiUrl('/api/v1/test-points/extract-and-save')|g" pages/TestPointExtraction.tsx
sed -i '' "s|'http://localhost:3000/api/v1/feishu/fetch-document'|getFullApiUrl('/api/v1/feishu/fetch-document')|g" pages/TestPointExtraction.tsx

sed -i '' 's|`http://localhost:3000${result.screenshotUrl}`|`${getFullApiUrl(result.screenshotUrl)}`|g' components/UITestResults/UITestResults.tsx

rm /tmp/import_line.txt /tmp/import_line2.txt

echo "✓ 所有 URL 已修复"
