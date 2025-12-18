/**
 * EventEmitter 单元测试
 */

import { EventEmitter } from '../EventEmitter.js';
import { PatrolEventType, PatrolStartedEvent, PatrolCompletedEvent, PatrolFailedEvent, TaskCreatedEvent } from '../types.js';
import { sleep } from '../../__tests__/helpers/testUtils.js';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on() - 注册事件监听器', () => {
    it('应该成功注册事件监听器', () => {
      const listener = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);
    });

    it('应该支持注册多个监听器', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);
      emitter.on(PatrolEventType.PATROL_STARTED, listener3);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(3);
    });

    it('应该支持不同事件类型的监听器', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_COMPLETED, listener2);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);
      expect(emitter.listenerCount(PatrolEventType.PATROL_COMPLETED)).toBe(1);
    });

    it('应该防止重复注册同一个监听器', () => {
      const listener = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener);
      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      // Set 会自动去重
      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);
    });
  });

  describe('once() - 注册一次性监听器', () => {
    it('应该成功注册一次性监听器', () => {
      const listener = jest.fn();

      emitter.once(PatrolEventType.PATROL_STARTED, listener);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);
    });

    it('应该在事件触发后自动移除监听器', async () => {
      const listener = jest.fn();

      emitter.once(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(0);
    });

    it('应该在事件第二次触发时不再调用监听器', async () => {
      const listener = jest.fn();

      emitter.once(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);
      await emitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('off() - 移除事件监听器', () => {
    it('应该成功移除指定的监听器', () => {
      const listener = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener);
      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);

      emitter.off(PatrolEventType.PATROL_STARTED, listener);
      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(0);
    });

    it('应该只移除指定的监听器,保留其他监听器', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);

      emitter.off(PatrolEventType.PATROL_STARTED, listener1);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);
    });

    it('应该能移除一次性监听器', () => {
      const listener = jest.fn();

      emitter.once(PatrolEventType.PATROL_STARTED, listener);
      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);

      emitter.off(PatrolEventType.PATROL_STARTED, listener);
      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(0);
    });

    it('移除不存在的监听器不应该报错', () => {
      const listener = jest.fn();

      expect(() => {
        emitter.off(PatrolEventType.PATROL_STARTED, listener);
      }).not.toThrow();
    });
  });

  describe('removeAllListeners() - 移除所有监听器', () => {
    it('应该移除指定事件类型的所有监听器', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);
      emitter.once(PatrolEventType.PATROL_STARTED, listener3);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(3);

      emitter.removeAllListeners(PatrolEventType.PATROL_STARTED);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(0);
    });

    it('应该只移除指定事件类型,不影响其他事件', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_COMPLETED, listener2);

      emitter.removeAllListeners(PatrolEventType.PATROL_STARTED);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(0);
      expect(emitter.listenerCount(PatrolEventType.PATROL_COMPLETED)).toBe(1);
    });

    it('应该移除所有事件类型的所有监听器(不传参数)', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_COMPLETED, listener2);

      emitter.removeAllListeners();

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(0);
      expect(emitter.listenerCount(PatrolEventType.PATROL_COMPLETED)).toBe(0);
      expect(emitter.eventNames()).toHaveLength(0);
    });
  });

  describe('emit() - 发射事件', () => {
    it('应该调用已注册的监听器', async () => {
      const listener = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('应该按顺序调用多个监听器', async () => {
      const callOrder: number[] = [];
      const listener1 = jest.fn(() => { callOrder.push(1); });
      const listener2 = jest.fn(() => { callOrder.push(2); });
      const listener3 = jest.fn(() => { callOrder.push(3); });

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);
      emitter.on(PatrolEventType.PATROL_STARTED, listener3);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('应该支持异步监听器', async () => {
      const listener = jest.fn(async () => {
        await sleep(10);
      });

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('应该同时调用普通监听器和一次性监听器', async () => {
      const regularListener = jest.fn();
      const onceListener = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, regularListener);
      emitter.once(PatrolEventType.PATROL_STARTED, onceListener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      expect(regularListener).toHaveBeenCalledTimes(1);
      expect(onceListener).toHaveBeenCalledTimes(1);
    });

    it('监听器抛出错误不应该阻止其他监听器执行', async () => {
      const listener1 = jest.fn(() => {
        throw new Error('Listener 1 error');
      });
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);
      emitter.on(PatrolEventType.PATROL_STARTED, listener3);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      // 应该不会抛出错误
      await emitter.emit(event);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('没有监听器时发射事件不应该报错', async () => {
      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await expect(emitter.emit(event)).resolves.not.toThrow();
    });

    it('应该等待所有监听器完成后才返回', async () => {
      let completed = false;
      const listener = jest.fn(async () => {
        await sleep(50);
        completed = true;
      });

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      expect(completed).toBe(false);
      await emitter.emit(event);
      expect(completed).toBe(true);
    });
  });

  describe('emitSync() - 同步发射事件', () => {
    it('应该同步发射事件(不等待监听器完成)', () => {
      let completed = false;
      const listener = jest.fn(async () => {
        await sleep(10);
        completed = true;
      });

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      emitter.emitSync(event);

      // 立即返回,不等待监听器完成
      expect(completed).toBe(false);
    });

    it('应该不会抛出错误', () => {
      const listener = jest.fn(() => {
        throw new Error('Test error');
      });

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      expect(() => {
        emitter.emitSync(event);
      }).not.toThrow();
    });
  });

  describe('listenerCount() - 获取监听器数量', () => {
    it('应该返回正确的监听器数量', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(2);
    });

    it('应该包含一次性监听器的数量', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.once(PatrolEventType.PATROL_STARTED, listener2);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(2);
    });

    it('没有监听器时应该返回 0', () => {
      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(0);
    });

    it('移除监听器后应该返回正确的数量', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);

      emitter.off(PatrolEventType.PATROL_STARTED, listener1);

      expect(emitter.listenerCount(PatrolEventType.PATROL_STARTED)).toBe(1);
    });
  });

  describe('eventNames() - 获取所有事件类型', () => {
    it('应该返回所有已注册的事件类型', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_COMPLETED, listener2);

      const names = emitter.eventNames();

      expect(names).toHaveLength(2);
      expect(names).toContain(PatrolEventType.PATROL_STARTED);
      expect(names).toContain(PatrolEventType.PATROL_COMPLETED);
    });

    it('应该包含一次性监听器的事件类型', () => {
      const listener = jest.fn();

      emitter.once(PatrolEventType.PATROL_STARTED, listener);

      const names = emitter.eventNames();

      expect(names).toContain(PatrolEventType.PATROL_STARTED);
    });

    it('没有监听器时应该返回空数组', () => {
      expect(emitter.eventNames()).toHaveLength(0);
    });

    it('应该去重相同的事件类型', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.once(PatrolEventType.PATROL_STARTED, listener2);

      const names = emitter.eventNames();

      expect(names).toHaveLength(1);
      expect(names).toContain(PatrolEventType.PATROL_STARTED);
    });
  });

  describe('实际使用场景', () => {
    it('应该支持巡检完成事件的监听和处理', async () => {
      const listener = jest.fn();

      emitter.on(PatrolEventType.PATROL_COMPLETED, listener);

      const event: PatrolCompletedEvent = {
        type: PatrolEventType.PATROL_COMPLETED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
        execution: {} as any,
        passedUrls: 5,
        failedUrls: 1,
        durationMs: 5000,
      };

      await emitter.emit(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          passedUrls: 5,
          failedUrls: 1,
          durationMs: 5000,
        })
      );
    });

    it('应该支持巡检失败事件的监听和处理', async () => {
      const listener = jest.fn();

      emitter.on(PatrolEventType.PATROL_FAILED, listener);

      const error = new Error('Network timeout');
      const event: PatrolFailedEvent = {
        type: PatrolEventType.PATROL_FAILED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
        error,
        errorMessage: 'Network timeout',
      };

      await emitter.emit(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          errorMessage: 'Network timeout',
        })
      );
    });

    it('应该支持任务创建事件的监听和处理', async () => {
      const listener = jest.fn();

      emitter.on(PatrolEventType.TASK_CREATED, listener);

      const event: TaskCreatedEvent = {
        type: PatrolEventType.TASK_CREATED,
        timestamp: new Date(),
        task: {
          id: 'task-123',
          name: 'Test Task',
        } as any,
      };

      await emitter.emit(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            id: 'task-123',
            name: 'Test Task',
          }),
        })
      );
    });

    it('应该支持事件链式处理', async () => {
      const results: string[] = [];

      // 监听 PATROL_STARTED 并触发下一个事件
      emitter.on(PatrolEventType.PATROL_STARTED, async (event) => {
        results.push('started');

        // 类型断言确保 event 是 PatrolStartedEvent
        const startedEvent = event as PatrolStartedEvent;

        // 模拟巡检完成
        const completedEvent: PatrolCompletedEvent = {
          type: PatrolEventType.PATROL_COMPLETED,
          timestamp: new Date(),
          executionId: startedEvent.executionId,
          task: startedEvent.task,
          execution: {} as any,
          passedUrls: 10,
          failedUrls: 0,
          durationMs: 1000,
        };

        await emitter.emit(completedEvent);
      });

      emitter.on(PatrolEventType.PATROL_COMPLETED, () => {
        results.push('completed');
      });

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      expect(results).toEqual(['started', 'completed']);
    });
  });

  describe('边界情况和异常处理', () => {
    it('应该处理监听器返回 undefined', async () => {
      const listener = jest.fn(() => undefined);

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await expect(emitter.emit(event)).resolves.not.toThrow();
    });

    it('应该处理监听器返回 Promise<void>', async () => {
      const listener = jest.fn(async (): Promise<void> => {
        await sleep(1);
      });

      emitter.on(PatrolEventType.PATROL_STARTED, listener);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await expect(emitter.emit(event)).resolves.not.toThrow();
    });

    it('应该处理在监听器执行中添加新监听器', async () => {
      const listener1 = jest.fn(() => {
        // 在监听器执行中添加新监听器
        emitter.on(PatrolEventType.PATROL_STARTED, listener2);
      });
      const listener2 = jest.fn();

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      // listener2 在第一次 emit 时不应该被调用
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();

      // 第二次 emit 时应该调用 listener2
      await emitter.emit(event);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('应该处理在监听器执行中移除其他监听器', async () => {
      const listener2 = jest.fn();
      const listener1 = jest.fn(() => {
        // 在监听器执行中移除其他监听器
        emitter.off(PatrolEventType.PATROL_STARTED, listener2);
      });

      emitter.on(PatrolEventType.PATROL_STARTED, listener1);
      emitter.on(PatrolEventType.PATROL_STARTED, listener2);

      const event: PatrolStartedEvent = {
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId: 'exec-123',
        task: {} as any,
      };

      await emitter.emit(event);

      // 两个监听器都应该被调用(因为 emit 时已经获取了监听器列表)
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      // 但 listener2 已被移除,第二次 emit 时不应该被调用
      await emitter.emit(event);
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });
});
