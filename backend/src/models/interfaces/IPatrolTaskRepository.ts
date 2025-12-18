import { PatrolTask } from '../entities.js';

/**
 * 巡检任务仓储接口
 * 抽象存储层,支持多种存储实现(Bitable、PostgreSQL等)
 */
export interface IPatrolTaskRepository {
  /**
   * 根据ID查找任务
   * @param id 任务ID
   * @returns 任务实体或null
   */
  findById(id: string): Promise<PatrolTask | null>;

  /**
   * 查找所有任务
   * @param options 查询选项
   * @returns 任务列表
   */
  findAll(options?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PatrolTask[]>;

  /**
   * 创建新任务
   * @param task 任务实体(不含ID)
   * @returns 创建的任务ID
   */
  create(task: Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;

  /**
   * 更新任务
   * @param id 任务ID
   * @param updates 更新字段
   * @returns 更新后的任务或null
   */
  update(id: string, updates: Partial<PatrolTask>): Promise<PatrolTask | null>;

  /**
   * 删除任务
   * @param id 任务ID
   * @returns 是否删除成功
   */
  delete(id: string): Promise<boolean>;

  /**
   * 统计任务数量
   * @param options 统计选项
   * @returns 任务数量
   */
  count(options?: { enabled?: boolean }): Promise<number>;
}
