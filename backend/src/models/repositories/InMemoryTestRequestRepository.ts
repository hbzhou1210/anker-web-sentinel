import { TestRequest, TestRequestStatus } from '../entities.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 内存版 TestRequest Repository
 *
 * TestRequest 只用于追踪异步测试任务的状态,不需要持久化。
 * 真正的测试结果会存储在 TestReport (Bitable) 中。
 *
 * 这个实现使用内存存储,重启后会清空,但这对于临时状态追踪是可接受的。
 */
export class InMemoryTestRequestRepository {
  private requests: Map<string, TestRequest> = new Map();

  /**
   * 创建新的测试请求
   */
  async create(
    url: string,
    config?: any, // 使用 any 以支持所有配置参数
    notificationEmail?: string,
    originUrl?: string // 🌐 请求来源的完整 URL
  ): Promise<TestRequest> {
    const testRequest: TestRequest = {
      id: uuidv4(),
      url,
      requestedAt: new Date(),
      status: TestRequestStatus.Pending,
      config: config || null,
      notificationEmail: notificationEmail || null,
      originUrl: originUrl || null, // 🌐 保存请求来源
    };

    this.requests.set(testRequest.id, testRequest);
    console.log(`[InMemoryTestRequestRepository] Created test request ${testRequest.id} from origin: ${originUrl || 'unknown'}`);

    return testRequest;
  }

  /**
   * 根据 ID 查找测试请求
   */
  async findById(id: string): Promise<TestRequest | null> {
    return this.requests.get(id) || null;
  }

  /**
   * 更新测试请求状态
   */
  async updateStatus(id: string, status: TestRequestStatus): Promise<void> {
    const request = this.requests.get(id);
    if (request) {
      request.status = status;
      console.log(`[InMemoryTestRequestRepository] Updated test request ${id} status to ${status}`);
    } else {
      console.warn(`[InMemoryTestRequestRepository] Test request ${id} not found for status update`);
    }
  }

  /**
   * 清理旧的已完成请求 (可选,用于防止内存泄漏)
   */
  cleanup(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [id, request] of this.requests.entries()) {
      if (
        (request.status === TestRequestStatus.Completed ||
         request.status === TestRequestStatus.Failed) &&
        request.requestedAt.getTime() < cutoffTime
      ) {
        this.requests.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[InMemoryTestRequestRepository] Cleaned up ${cleanedCount} old test request(s)`);
    }
  }
}

// Export singleton instance
export default new InMemoryTestRequestRepository();
