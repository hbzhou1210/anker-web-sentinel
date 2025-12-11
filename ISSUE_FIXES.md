# 🔧 问题修复报告

**日期**: 2025-12-10
**环境**: http://10.5.3.150:10038/

---

## 发现的问题

### 1. ❌ 响应式测试页面刷新空白

**问题描述**:
访问 `http://10.5.3.150:10038/tools/responsive` 时,刷新页面显示空白。

**根本原因**:
Dockerfile 中前端构建文件未复制到 Nginx 的 root 目录 `/usr/share/nginx/html/`,导致 Nginx 无法找到静态文件。

**修复方案**:
修改 Dockerfile,在配置 Nginx 后添加复制命令:

```dockerfile
# 配置 Nginx 并复制前端构建文件
RUN cp frontend/nginx.conf /etc/nginx/sites-available/default \
    && cp -r frontend/dist/* /usr/share/nginx/html/
```

**影响范围**: 所有前端页面的刷新操作

**修复状态**: ✅ 已修复 (commit: 待提交)

---

### 2. ❌ 定时巡检调度不执行

**问题描述**:
修改巡检任务的调度时间后保存无效,定时巡检不会自动执行。

**根本原因**:
调度功能在 Bitable 模式下不支持。代码中明确返回 501 错误:

```typescript
// backend/src/api/routes/patrol.ts
router.post('/schedules', async (req: Request, res: Response) => {
  // Bitable mode does not support schedules yet
  if (DATABASE_STORAGE === 'bitable') {
    res.status(501).json({
      error: 'Not Implemented',
      message: '调度功能在 Bitable 模式下暂不支持',
    });
    return;
  }
  // ...
});
```

**技术背景**:
- Bitable 模式使用飞书多维表格作为数据存储
- 调度功能需要在服务端维护 cron 任务状态
- Bitable 表结构虽然包含 `patrolSchedules` 表,但后端服务未实现完整的调度逻辑

**当前解决方案**:
使用**手动触发**替代定时调度:

```bash
# 手动触发巡检任务
curl -X POST http://10.5.3.150:10038/api/v1/patrol/tasks/{taskId}/execute
```

**临时替代方案**:
1. **方案 A**: 使用外部 cron 作业
   ```bash
   # 在服务器上配置 crontab
   0 9 * * * curl -X POST http://localhost:10038/api/v1/patrol/tasks/{taskId}/execute
   ```

2. **方案 B**: 使用 Launch 平台的定时任务功能(如果支持)

3. **方案 C**: 切换到 PostgreSQL 模式
   - 修改环境变量: `DATABASE_STORAGE=postgres`
   - 部署 PostgreSQL 数据库
   - 运行数据迁移脚本

**长期解决方案** (需要开发):
实现 Bitable 模式下的调度功能:

1. **创建 BitablePatrolScheduleRepository**
   - 实现调度配置的 CRUD 操作
   - 使用 Bitable API 读写 `patrolSchedules` 表

2. **修改 PatrolSchedulerService**
   - 支持从 Bitable 加载调度配置
   - 初始化时注册所有启用的调度任务
   - 使用 `node-cron` 管理定时任务

3. **参考实现**:
   ```typescript
   // 伪代码示例
   export class BitablePatrolScheduleRepository {
     async findAllEnabled(): Promise<PatrolSchedule[]> {
       const result = await feishuApiService.searchRecords(
         this.scheduleTableId,
         {
           filter: {
             conditions: [{
               field_name: 'enabled',
               operator: 'is',
               value: [true]
             }]
           }
         }
       );
       return result.items.map(record => this.recordToSchedule(record));
     }

     async updateNextExecution(id: string, nextTime: Date): Promise<void> {
       await feishuApiService.updateRecord(
         this.scheduleTableId,
         id,
         { next_execution_at: nextTime.getTime() }
       );
     }
   }
   ```

**修复优先级**: 🟡 中等 (可使用手动触发替代)

**修复状态**: ⚠️ 功能限制,需要开发支持

---

### 3. ❌ 移动端/响应式测试设备列表为空

**问题描述**:
访问响应式测试页面,设备选择列表为空,无法选择测试设备。

**根本原因**:
Bitable 中的 `devicePresets` 表没有初始数据。系统查询时返回空数组。

**API 端点**:
```
GET /api/v1/responsive/devices
```

**预期返回**:
```json
{
  "success": true,
  "data": [
    {
      "id": "mobile-iphone-13",
      "name": "iPhone 13",
      "deviceType": "mobile",
      "viewportWidth": 390,
      "viewportHeight": 844,
      "userAgent": "Mozilla/5.0...",
      "enabled": true
    },
    // ... 更多设备
  ]
}
```

**实际返回**:
```json
{
  "success": true,
  "data": []
}
```

**修复方案**:

#### 方案 A: 创建数据初始化脚本 (推荐)

创建脚本文件 `backend/src/scripts/init-device-presets.ts`:

```typescript
import feishuApiService from '../services/FeishuApiService.js';
import { FEISHU_BITABLE_CONFIG } from '../config/feishu-bitable.config.js';

const DEFAULT_DEVICES = [
  // 移动设备
  {
    id: 'mobile-iphone-13',
    name: 'iPhone 13',
    device_type: 'mobile',
    viewport_width: 390,
    viewport_height: 844,
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
    pixel_ratio: 3,
    has_touch: true,
    is_mobile: true,
    enabled: true,
  },
  {
    id: 'mobile-samsung-galaxy-s21',
    name: 'Samsung Galaxy S21',
    device_type: 'mobile',
    viewport_width: 360,
    viewport_height: 800,
    user_agent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
    pixel_ratio: 3,
    has_touch: true,
    is_mobile: true,
    enabled: true,
  },
  // 平板设备
  {
    id: 'tablet-ipad-pro',
    name: 'iPad Pro 12.9"',
    device_type: 'tablet',
    viewport_width: 1024,
    viewport_height: 1366,
    user_agent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
    pixel_ratio: 2,
    has_touch: true,
    is_mobile: false,
    enabled: true,
  },
  // 桌面设备
  {
    id: 'desktop-1920',
    name: 'Desktop 1920x1080',
    device_type: 'desktop',
    viewport_width: 1920,
    viewport_height: 1080,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    pixel_ratio: 1,
    has_touch: false,
    is_mobile: false,
    enabled: true,
  },
];

async function initDevicePresets() {
  console.log('开始初始化设备预设数据...');

  const tableId = FEISHU_BITABLE_CONFIG.tables.devicePresets;

  for (const device of DEFAULT_DEVICES) {
    try {
      await feishuApiService.createRecord(tableId, device);
      console.log(`✓ 创建设备: ${device.name}`);
    } catch (error) {
      console.error(`✗ 创建失败: ${device.name}`, error);
    }
  }

  console.log('设备预设数据初始化完成!');
}

initDevicePresets().catch(console.error);
```

运行脚本:
```bash
cd backend
npx tsx src/scripts/init-device-presets.ts
```

#### 方案 B: 手动在 Bitable 中添加数据

1. 访问 Bitable: https://anker-in.feishu.cn/base/X66Mb4mPRagcrSsBlRQcNrHQnKh
2. 打开 `devicePresets` 表 (table_id: tblmB4EAqP1Xbsnb)
3. 手动添加设备记录,参考以下数据:

| id | name | device_type | viewport_width | viewport_height | enabled |
|----|------|-------------|----------------|-----------------|---------|
| mobile-iphone-13 | iPhone 13 | mobile | 390 | 844 | ✓ |
| mobile-samsung-s21 | Samsung Galaxy S21 | mobile | 360 | 800 | ✓ |
| tablet-ipad-pro | iPad Pro 12.9" | tablet | 1024 | 1366 | ✓ |
| desktop-1920 | Desktop 1920x1080 | desktop | 1920 | 1080 | ✓ |

#### 方案 C: 添加默认设备逻辑

修改 `BitableResponsiveTestRepository.getEnabledDevices()` 方法,如果 Bitable 返回空,则返回硬编码的默认设备列表:

```typescript
async getEnabledDevices(): Promise<DevicePreset[]> {
  const result = await feishuApiService.searchRecords(this.devicePresetsTableId, {
    filter: {
      conditions: [{
        field_name: 'enabled',
        operator: 'is',
        value: [true],
      }],
      conjunction: 'and',
    },
    page_size: 500,
  });

  const devices = result.items.map((record: any) => this.recordToDevicePreset(record));

  // 如果没有数据,返回默认设备列表
  if (devices.length === 0) {
    console.warn('[ResponsiveTest] No devices in Bitable, using default devices');
    return this.getDefaultDevices();
  }

  return devices.sort((a, b) => {
    const typeOrder = { mobile: 1, tablet: 2, desktop: 3 };
    const typeCompare = typeOrder[a.deviceType] - typeOrder[b.deviceType];
    if (typeCompare !== 0) return typeCompare;
    return a.name.localeCompare(b.name);
  });
}

private getDefaultDevices(): DevicePreset[] {
  return [
    {
      id: 'mobile-iphone-13',
      name: 'iPhone 13',
      deviceType: 'mobile',
      viewportWidth: 390,
      viewportHeight: 844,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      pixelRatio: 3,
      hasTouch: true,
      isMobile: true,
      enabled: true,
      createdAt: new Date(),
    },
    // ... 更多默认设备
  ];
}
```

**推荐方案**: 方案 C (添加默认设备逻辑) + 方案 A (数据初始化脚本)
- 短期: 使用方案 C 让功能立即可用
- 长期: 使用方案 A 在 Bitable 中维护设备数据

**修复优先级**: 🔴 高 (影响核心功能)

**修复状态**: ⚠️ 待实现

---

## 修复总结

| 问题 | 严重程度 | 修复状态 | 预计工作量 |
|-----|---------|---------|----------|
| 响应式测试页面刷新空白 | 🔴 高 | ✅ 已修复 | 10 分钟 |
| 定时巡检调度不执行 | 🟡 中 | ⚠️ 功能限制 | 4-8 小时 |
| 设备列表为空 | 🔴 高 | ⚠️ 待实现 | 1-2 小时 |

## 下一步行动

### 立即执行

1. **提交 Dockerfile 修复**
   ```bash
   git add Dockerfile
   git commit -m "fix: 复制前端构建文件到 Nginx root 目录"
   git push coding master
   ```

2. **在 Launch 平台重新部署**
   - 触发重新构建
   - 验证响应式测试页面可以正常刷新

### 短期修复 (1-2 小时)

3. **实现设备列表默认值**
   - 修改 `BitableResponsiveTestRepository.ts`
   - 添加 `getDefaultDevices()` 方法
   - 提交并部署

4. **创建设备初始化脚本**
   - 创建 `init-device-presets.ts`
   - 运行脚本初始化 Bitable 数据
   - 验证设备列表正常显示

### 中期优化 (4-8 小时)

5. **实现 Bitable 调度支持**
   - 创建 `BitablePatrolScheduleRepository`
   - 修改 `PatrolSchedulerService`
   - 测试定时执行功能
   - 更新文档

---

## 临时替代方案

在完整修复之前,用户可以:

### 巡检任务
- ✅ 手动触发巡检: 点击"立即执行"按钮
- ✅ 使用外部 cron: 通过 API 调用触发

### 响应式测试
- ⚠️ 等待修复部署
- ⚠️ 或切换到 PostgreSQL 模式

---

**文档创建**: 2025-12-10
**负责人**: Claude Sonnet 4.5
