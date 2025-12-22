import { Router, Request, Response } from 'express';
import { patrolService } from '../../services/PatrolService.js';
import { BitablePatrolScheduleRepository } from '../../models/repositories/BitablePatrolScheduleRepository.js';
import { patrolSchedulerService } from '../../services/PatrolSchedulerService.js';
import { PatrolScheduleType } from '../../models/entities.js';
import { standardLimiter, strictLimiter, createLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Use Bitable for schedule repository
const scheduleRepository = new BitablePatrolScheduleRepository();

// ==================== 巡检任务管理 ====================

/**
 * POST /api/v1/patrol/tasks - 创建巡检任务
 * 应用创建限流器(30次/分钟)
 */
router.post('/tasks', createLimiter, async (req: Request, res: Response) => {
  try {
    const { name, description, urls, notificationEmails, config, enabled } = req.body;

    // 验证必填字段
    if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'name 和 urls 是必填字段，urls 必须是非空数组',
      });
      return;
    }

    if (!notificationEmails || !Array.isArray(notificationEmails) || notificationEmails.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'notificationEmails 是必填字段，必须是非空数组',
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of notificationEmails) {
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: 'Bad Request',
          message: `无效的邮箱格式: ${email}`,
        });
        return;
      }
    }

    // 验证 URLs 格式
    for (const urlConfig of urls) {
      if (!urlConfig.url || !urlConfig.name) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'urls 中的每个项目必须包含 url 和 name 字段',
        });
        return;
      }
    }

    const task = await patrolService.createPatrolTask({
      name,
      description: description || undefined,
      urls,
      notificationEmails,
      config: config || {},
      enabled: enabled !== undefined ? enabled : true,
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('创建巡检任务失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '创建巡检任务失败',
    });
  }
});

/**
 * GET /api/v1/patrol/tasks - 获取巡检任务列表
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const enabledOnly = req.query.enabledOnly === 'true';
    const tasks = await patrolService.getPatrolTasks(enabledOnly);
    res.json(tasks);
  } catch (error) {
    console.error('获取巡检任务列表失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取巡检任务列表失败',
    });
  }
});

/**
 * GET /api/v1/patrol/tasks/:taskId - 获取巡检任务详情
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await patrolService.getPatrolTask(taskId);

    if (!task) {
      res.status(404).json({
        error: 'Not Found',
        message: `巡检任务 ${taskId} 不存在`,
      });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error('获取巡检任务详情失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取巡检任务详情失败',
    });
  }
});

/**
 * PUT /api/v1/patrol/tasks/:taskId - 更新巡检任务
 */
router.put('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    // 验证邮箱格式（如果提供）
    if (updates.notificationEmails) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of updates.notificationEmails) {
        if (!emailRegex.test(email)) {
          res.status(400).json({
            error: 'Bad Request',
            message: `无效的邮箱格式: ${email}`,
          });
          return;
        }
      }
    }

    const task = await patrolService.updatePatrolTask(taskId, updates);

    if (!task) {
      res.status(404).json({
        error: 'Not Found',
        message: `巡检任务 ${taskId} 不存在`,
      });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error('更新巡检任务失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '更新巡检任务失败',
    });
  }
});

/**
 * DELETE /api/v1/patrol/tasks/:taskId - 删除巡检任务
 */
router.delete('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const deleted = await patrolService.deletePatrolTask(taskId);

    if (!deleted) {
      res.status(404).json({
        error: 'Not Found',
        message: `巡检任务 ${taskId} 不存在`,
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('删除巡检任务失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '删除巡检任务失败',
    });
  }
});

/**
 * POST /api/v1/patrol/tasks/:taskId/execute - 手动执行巡检任务
 * 应用严格限流器(10次/分钟) - 资源密集型操作
 */
router.post('/tasks/:taskId/execute', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    // 检查任务是否存在
    const task = await patrolService.getPatrolTask(taskId);
    if (!task) {
      res.status(404).json({
        error: 'Not Found',
        message: `巡检任务 ${taskId} 不存在`,
      });
      return;
    }

    // 🌐 自动获取请求来源的完整 URL (协议 + 域名 + 端口)
    const protocol = req.protocol;
    const forwardedHost = req.get('x-forwarded-host');
    const host = forwardedHost || req.get('host');
    let originUrl = `${protocol}://${host}`;

    // 检查是否需要添加端口号
    if (!host?.includes(':')) {
      const forwardedPort = req.get('x-forwarded-port');
      if (forwardedPort &&
          ((protocol === 'http' && forwardedPort !== '80') ||
           (protocol === 'https' && forwardedPort !== '443'))) {
        originUrl = `${protocol}://${host}:${forwardedPort}`;
      }
    }

    console.log(`[Patrol API] Request origin: ${originUrl}`);

    // 启动巡检任务(异步执行,但等待创建execution记录,并传递 originUrl)
    const executionId = await patrolService.executePatrol(taskId, originUrl).catch((error) => {
      console.error(`巡检任务 ${taskId} 启动失败:`, error);
      throw error;
    });

    res.status(202).json({
      message: '巡检任务已开始执行',
      taskId,
      executionId,
    });
  } catch (error) {
    console.error('执行巡检任务失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '执行巡检任务失败',
    });
  }
});

// ==================== 调度配置管理 ====================

/**
 * POST /api/v1/patrol/schedules - 创建调度配置
 */
router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const { patrolTaskId, cronExpression, scheduleType, timeZone, enabled } = req.body;

    // 验证必填字段
    if (!patrolTaskId || !cronExpression || !scheduleType) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'patrolTaskId, cronExpression 和 scheduleType 是必填字段',
      });
      return;
    }

    // 验证任务是否存在
    const task = await patrolService.getPatrolTask(patrolTaskId);
    if (!task) {
      res.status(404).json({
        error: 'Not Found',
        message: `巡检任务 ${patrolTaskId} 不存在`,
      });
      return;
    }

    const schedule = await scheduleRepository.create({
      patrolTaskId,
      cronExpression,
      scheduleType: scheduleType as PatrolScheduleType,
      timeZone: timeZone || 'Asia/Shanghai',
      enabled: enabled !== undefined ? enabled : true,
    });

    // 如果启用，添加到调度器
    if (schedule.enabled) {
      await patrolSchedulerService.addSchedule(schedule);
    }

    res.status(201).json(schedule);
  } catch (error) {
    console.error('创建调度配置失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '创建调度配置失败',
    });
  }
});

/**
 * GET /api/v1/patrol/schedules - 获取所有调度配置
 */
router.get('/schedules', async (req: Request, res: Response) => {
  try {
    const taskId = req.query.taskId as string | undefined;

    let schedules;
    if (taskId) {
      schedules = await scheduleRepository.findByTaskId(taskId);
    } else {
      schedules = await scheduleRepository.findAllEnabled();
    }

    res.json(schedules);
  } catch (error) {
    console.error('获取调度配置失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取调度配置失败',
    });
  }
});

/**
 * PUT /api/v1/patrol/schedules/:scheduleId - 更新调度配置
 */
router.put('/schedules/:scheduleId', async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const updates = req.body;

    const schedule = await scheduleRepository.update(scheduleId, updates);

    if (!schedule) {
      res.status(404).json({
        error: 'Not Found',
        message: `调度配置 ${scheduleId} 不存在`,
      });
      return;
    }

    // 更新调度器
    await patrolSchedulerService.updateSchedule(scheduleId);

    res.json(schedule);
  } catch (error) {
    console.error('更新调度配置失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '更新调度配置失败',
    });
  }
});

/**
 * DELETE /api/v1/patrol/schedules/:scheduleId - 删除调度配置
 */
router.delete('/schedules/:scheduleId', async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;

    // 从调度器中移除
    await patrolSchedulerService.removeSchedule(scheduleId);

    const deleted = await scheduleRepository.delete(scheduleId);

    if (!deleted) {
      res.status(404).json({
        error: 'Not Found',
        message: `调度配置 ${scheduleId} 不存在`,
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('删除调度配置失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '删除调度配置失败',
    });
  }
});

// ==================== 执行记录查询 ====================

/**
 * GET /api/v1/patrol/executions - 获取执行历史
 */
router.get('/executions', async (req: Request, res: Response) => {
  try {
    const taskId = req.query.taskId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const executions = await patrolService.getExecutionHistory(taskId, limit);
    res.json(executions);
  } catch (error) {
    console.error('获取执行历史失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取执行历史失败',
    });
  }
});

/**
 * GET /api/v1/patrol/executions/:executionId - 获取执行详情
 */
router.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = await patrolService.getExecutionDetail(executionId);

    if (!execution) {
      res.status(404).json({
        error: 'Not Found',
        message: `执行记录 ${executionId} 不存在`,
      });
      return;
    }

    res.json(execution);
  } catch (error) {
    console.error('获取执行详情失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取执行详情失败',
    });
  }
});

// ==================== 调度器管理 ====================

/**
 * POST /api/v1/patrol/scheduler/reload - 重新加载所有调度配置
 */
router.post('/scheduler/reload', async (_req: Request, res: Response) => {
  try {
    await patrolSchedulerService.reloadSchedules();
    res.json({
      success: true,
      message: '调度配置已重新加载',
    });
  } catch (error) {
    console.error('重新加载调度配置失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '重新加载调度配置失败',
    });
  }
});

/**
 * GET /api/v1/patrol/scheduler/status - 获取调度器状态
 */
router.get('/scheduler/status', (_req: Request, res: Response) => {
  try {
    const status = patrolSchedulerService.getScheduleStatus();
    res.json({
      success: true,
      schedules: status,
    });
  } catch (error) {
    console.error('获取调度器状态失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取调度器状态失败',
    });
  }
});

export default router;
