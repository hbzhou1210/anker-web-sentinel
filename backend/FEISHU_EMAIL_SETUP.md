# 飞书邮箱SMTP配置指南

本文档说明如何配置飞书邮箱用于测试报告的邮件通知功能。

## 第一步：开启飞书邮箱SMTP服务

1. 登录飞书网页版：https://feishu.cn
2. 点击右上角头像 → **设置**
3. 在左侧菜单选择 **邮箱**
4. 找到 **SMTP/IMAP设置** 或 **第三方客户端** 选项
5. 开启 **POP3/SMTP/IMAP服务**
6. 点击 **生成授权码** 按钮
7. 记录下生成的授权码（这是你的SMTP密码）

## 第二步：配置环境变量

编辑 `backend/.env` 文件，在文件末尾添加以下配置：

```bash
# Email Notification Configuration (Feishu)
SMTP_HOST=smtp.feishu.cn
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的飞书邮箱地址@xxx.feishu.cn
SMTP_PASSWORD=步骤一中生成的授权码

# Application URL for email links
APP_URL=http://localhost:5173
```

### 配置说明

- **SMTP_HOST**: 飞书SMTP服务器地址（固定为 `smtp.feishu.cn`）
- **SMTP_PORT**: SMTP端口
  - `465`: SSL加密（推荐）
  - `587`: TLS加密（备选）
- **SMTP_SECURE**:
  - `true`: 使用SSL加密（端口465）
  - `false`: 使用TLS加密（端口587）
- **SMTP_USER**: 你的完整飞书邮箱地址
- **SMTP_PASSWORD**: 在飞书中生成的授权码（不是登录密码）
- **APP_URL**: 前端应用URL，用于邮件中的链接

## 第三步：验证配置

1. 保存 `.env` 文件后，后端会自动重启
2. 查看后端日志，应该看到：
   ```
   ✓ Email service initialized (smtp.feishu.cn:465, secure=true)
   ```
   而不是：
   ```
   ⚠️  Email service is disabled
   ```

## 第四步：测试邮件发送

1. 在前端页面输入测试URL
2. 在"接收测试报告"输入框填写你的邮箱地址
3. 点击"开始检测"
4. 等待测试完成
5. 检查邮箱收件箱（可能在垃圾邮件中）

## 常见问题

### Q1: 配置后仍显示 "Email service is disabled"

**解决方案**：
- 确认 `.env` 文件中的配置没有空格或换行错误
- 检查所有必需字段（HOST, PORT, USER, PASSWORD）都已填写
- 重启后端服务

### Q2: 邮件发送失败，显示认证错误

**解决方案**：
- 确认使用的是**授权码**而不是登录密码
- 重新生成授权码
- 检查邮箱地址是否正确（包含域名）

### Q3: 端口465连接失败

**解决方案**：
尝试使用端口587：
```bash
SMTP_PORT=587
SMTP_SECURE=false
```

### Q4: 邮件进入垃圾邮件

**解决方案**：
- 将发件人地址添加到白名单
- 检查邮件内容，确保不包含垃圾邮件特征
- 使用企业邮箱域名会更可靠

## 其他邮件服务配置

如果你想使用其他邮件服务，参考以下配置：

### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### QQ邮箱
```bash
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@qq.com
SMTP_PASSWORD=your_auth_code
```

### 163邮箱
```bash
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@163.com
SMTP_PASSWORD=your_auth_code
```

## 安全建议

1. **不要提交 `.env` 文件到Git仓库**
   - `.env` 文件已在 `.gitignore` 中
   - 使用 `.env.example` 作为模板

2. **定期更换授权码**
   - 建议每3-6个月更换一次

3. **使用专用邮箱**
   - 建议使用专门的系统通知邮箱
   - 不要使用个人主邮箱

4. **生产环境配置**
   - 在生产环境使用企业邮箱
   - 开启SSL证书验证（NODE_ENV=production）
