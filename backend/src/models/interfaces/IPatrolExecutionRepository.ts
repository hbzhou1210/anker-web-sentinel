import { PatrolExecution, PatrolExecutionStatus } from '../entities.js';

/**
 * 巡检执行记录仓储接口
 * 抽象存储层,支持多种存储实现
 */
export interface IPatrolExecutionRepository {
  /**
   * 根据ID查找执行记录
   * @param id 执行记录ID
   * @returns 执行记录或null
   */
  findById(id: string): Promise<PatrolExecution | null>;

  /**
   * 根据任务ID查找执行记录
   * @param taskId 任务ID
   * @param options 查询选项
   * @returns 执行记录列表
   */
  findByTaskId(
    taskId: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'asc' | 'desc';
    }
  ): Promise<PatrolExecution[]>;

  /**
   * 创建执行记录
   * @param execution 执行记录(不含ID)
   * @returns 创建的记录ID
   */
  create(execution: Omit<PatrolExecution, 'id'>): Promise<string>;

  /**
   * 更新执行记录
   * @param id 记录ID
   * @param updates 更新字段
   * @returns 更新后的记录或null
   */
  update(id: string, updates: Partial<PatrolExecution>): Promise<PatrolExecution | null>;

  /**
   * 删除执行记录
   * @param id 记录ID
   * @returns 是否删除成功
   */
  delete(id: string): Promise<boolean>;

  /**
   * 获取最近的执行记录
   * @param taskId 任务ID
   * @param limit 返回数量
   * @returns 执行记录列表
   */
  getRecentExecutions(taskId: string, limit?: number): Promise<PatrolExecution[]>;

  /**
   * 统计执行记录数量
   * @param taskId 任务ID(可选)
   * @returns 记录数量
   */
  count(taskId?: string): Promise<number>;

  /**
   * 查找所有执行记录(便捷方法)
   * @param limit 返回数量限制
   * @returns 执行记录列表
   */
  findAll(limit?: number): Promise<PatrolExecution[]>;

  /**
   * 更新执行状态(便捷方法)
   * @param id 记录ID
   * @param status 新状态
   * @param errorMessage 错误信息(可选)
   */
  updateStatus(id: string, status: PatrolExecutionStatus, errorMessage?: string): Promise<void>;

  /**
   * 完成执行记录(便捷方法)
   * @param id 记录ID
   * @param passedUrls 通过的URL数量
   * @param failedUrls 失败的URL数量
   * @param testResults 测试结果
   * @param durationMs 执行时长(毫秒)
   */
  complete(
    id: string,
    passedUrls: number,
    failedUrls: number,
    testResults: any[],
    durationMs: number
  ): Promise<void>;
}
