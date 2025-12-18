import { PatrolSchedule } from '../entities.js';

/**
 * 巡检调度仓储接口
 * 抽象存储层,支持多种存储实现
 */
export interface IPatrolScheduleRepository {
  /**
   * 根据ID查找调度配置
   * @param id 调度ID
   * @returns 调度配置或null
   */
  findById(id: string): Promise<PatrolSchedule | null>;

  /**
   * 根据任务ID查找调度配置
   * @param taskId 任务ID
   * @returns 调度配置列表
   */
  findByTaskId(taskId: string): Promise<PatrolSchedule[]>;

  /**
   * 查找所有启用的调度
   * @returns 调度配置列表
   */
  findAllEnabled(): Promise<PatrolSchedule[]>;

  /**
   * 创建调度配置
   * @param schedule 调度配置(不含ID)
   * @returns 创建的配置ID
   */
  create(schedule: Omit<PatrolSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;

  /**
   * 更新调度配置
   * @param id 配置ID
   * @param updates 更新字段
   * @returns 更新后的配置或null
   */
  update(id: string, updates: Partial<PatrolSchedule>): Promise<PatrolSchedule | null>;

  /**
   * 删除调度配置
   * @param id 配置ID
   * @returns 是否删除成功
   */
  delete(id: string): Promise<boolean>;

  /**
   * 更新最后执行时间
   * @param id 配置ID
   * @param lastExecutedAt 最后执行时间
   */
  updateLastExecutedAt(id: string, lastExecutedAt: Date): Promise<void>;
}
