# 重定向测试工具 - CSV 导入指南

## 📋 功能概述

重定向测试工具现已支持CSV文件导入功能，方便批量导入重定向规则。

## 📥 CSV 格式说明

### 基本格式

CSV文件应包含两列：

```csv
源URL,目标URL
http://old-domain.com,https://new-domain.com
http://old-domain.com/page1,https://new-domain.com/page1
```

### 支持的分隔符

- **逗号** (`,`) - 推荐使用
- **制表符** (`\t`) - 自动检测

### 标题行（可选）

可以添加标题行，工具会自动识别并跳过：

```csv
源URL,目标URL
http://example.com,https://example.com
```

或使用英文标题：

```csv
From URL,To URL
http://example.com,https://example.com
```

### URL 格式要求

- **必须是完整的URL**，包含协议（http://或https://）
- 例如：`http://example.com/page`
- ❌ 错误示例：`example.com/page`（缺少协议）

## 🔧 使用步骤

### 1. 准备CSV文件

创建一个CSV文件，例如 `redirects.csv`：

```csv
源URL,目标URL
http://old-site.com,https://new-site.com
http://old-site.com/about,https://new-site.com/about-us
http://old-site.com/contact,https://new-site.com/contact-us
http://old-site.com/blog/post1,https://new-site.com/articles/post1
http://old-site.com/products/item1,https://new-site.com/shop/item1
```

### 2. 在工具中导入

1. 打开重定向测试工具页面
2. 点击 **"📥 导入CSV"** 按钮
3. 选择您的CSV文件
4. 工具会自动解析并显示导入结果

### 3. 选择导入模式

导入时会弹出确认对话框：

- **点击"确定"** → 追加到现有规则
- **点击"取消"** → 替换所有规则

### 4. 查看导入结果

导入成功后：
- 会显示导入的规则数量
- 所有规则将显示在规则列表中
- 默认匹配类型为 **"完全匹配"**

## 📤 导出CSV

### 导出当前规则

1. 配置好重定向规则
2. 点击 **"📤 导出CSV"** 按钮
3. 下载的CSV文件包含三列：
   - 源URL
   - 目标URL
   - 匹配类型

### 导出格式示例

```csv
源URL,目标URL,匹配类型
"http://old-site.com","https://new-site.com","完全匹配"
"http://old-site.com/page1","https://new-site.com/page1","完全匹配"
```

## 💡 高级功能

### 1. 批量处理

一次可以导入**成百上千条**重定向规则，例如：

```csv
源URL,目标URL
http://old-site.com/page1,https://new-site.com/page1
http://old-site.com/page2,https://new-site.com/page2
http://old-site.com/page3,https://new-site.com/page3
...
http://old-site.com/page1000,https://new-site.com/page1000
```

### 2. 支持特殊字符

URL中的特殊字符会被正确处理：

```csv
源URL,目标URL
"http://example.com/page?id=123&utm_source=google","https://example.com/page?id=123"
"http://example.com/path/with spaces/","https://example.com/path/with-spaces/"
```

**建议**：包含逗号或特殊字符的URL用双引号包裹。

### 3. 忽略空行

CSV文件中的空行会被自动忽略：

```csv
源URL,目标URL
http://example1.com,https://example1.com

http://example2.com,https://example2.com

```

## 🛠️ 修改匹配类型

导入后，如果需要修改匹配类型：

1. 删除不需要精确匹配的规则
2. 手动重新添加，选择合适的匹配类型：
   - **完全匹配** - URL必须完全相同
   - **部分匹配** - 匹配URL的特定部分
   - **前缀匹配** - 匹配URL前缀
   - **正则匹配** - 使用正则表达式匹配

## 📊 示例场景

### 场景1：网站域名迁移

旧域名所有页面迁移到新域名：

```csv
源URL,目标URL
http://old-company.com,https://new-company.com
http://old-company.com/about,https://new-company.com/about
http://old-company.com/services,https://new-company.com/services
http://old-company.com/contact,https://new-company.com/contact
```

### 场景2：URL结构重构

修改URL路径结构：

```csv
源URL,目标URL
http://example.com/old-structure/page1,https://example.com/new-structure/page1
http://example.com/old-structure/page2,https://example.com/new-structure/page2
```

### 场景3：HTTPS升级

将所有HTTP页面升级到HTTPS：

```csv
源URL,目标URL
http://example.com,https://example.com
http://example.com/page1,https://example.com/page1
http://example.com/page2,https://example.com/page2
```

## ❌ 常见问题

### 1. 导入失败：未能解析到有效规则

**原因**：
- CSV格式不正确
- URL格式错误（缺少 http:// 或 https://）
- 分隔符使用错误

**解决方法**：
- 确保每行包含两列：源URL,目标URL
- 检查URL是否包含完整协议
- 使用逗号或制表符分隔

### 2. 导入的规则数量不对

**原因**：
- 存在无效的行（URL格式错误、空行等）
- 标题行被误判

**解决方法**：
- 检查CSV文件中每行的URL格式
- 确保标题行包含"URL"、"From"或"To"关键字

### 3. 中文乱码

**原因**：
- CSV文件编码不是UTF-8

**解决方法**：
- 使用UTF-8编码保存CSV文件
- 推荐使用Excel另存为CSV (UTF-8)格式

## 📝 Excel 使用提示

### 创建CSV

1. 在Excel中创建表格：
   | 源URL | 目标URL |
   |-------|---------|
   | http://old.com | https://new.com |
   | http://old.com/page1 | https://new.com/page1 |

2. 另存为 → 选择 **"CSV UTF-8 (逗号分隔)(*.csv)"**

### 注意事项

- Excel可能会自动格式化URL，请检查导出后的CSV文件
- 确保URL没有被转换为超链接格式

## 🔗 相关功能

- **JSON导入/导出** - 保留完整配置（包括匹配类型和高级选项）
- **HTML报告导出** - 测试完成后生成可视化报告
- **批量测试** - 一次测试所有规则

## 📚 示例文件

项目包含示例CSV文件：

```
tools/redirect-tester/example-redirects.csv
```

您可以下载此文件作为模板使用。

---

**更新时间**：2025-01-22
**版本**：1.0
