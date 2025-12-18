/**
 * 修复卡住的巡检执行记录
 *
 * 用法: tsx backend/fix-stuck-execution.ts <executionId>
 */

import dotenv from 'dotenv';
import { BitablePatrolExecutionRepository } from './src/models/repositories/BitablePatrolExecutionRepository.js';
import { PatrolExecutionStatus } from './src/models/entities.js';

// 加载环境变量
dotenv.config({ path: '.env' });

const executionId = process.argv[2];

if (!executionId) {
  console.error('Usage: tsx backend/fix-stuck-execution.ts <executionId>');
  process.exit(1);
}

async function main() {
  const repo = new BitablePatrolExecutionRepository();

  console.log(`Checking execution: ${executionId}`);

  const execution = await repo.findById(executionId);

  if (!execution) {
    console.error(`Execution ${executionId} not found`);
    process.exit(1);
  }

  console.log(`Current status: ${execution.status}`);
  console.log(`Started at: ${execution.startedAt}`);

  if (execution.status === 'running') {
    const now = new Date();
    const startTime = new Date(execution.startedAt);
    const durationMinutes = (now.getTime() - startTime.getTime()) / 1000 / 60;

    console.log(`Duration: ${durationMinutes.toFixed(1)} minutes`);

    if (durationMinutes > 10) {
      console.log(`Updating status to 'failed' (stuck for more than 10 minutes)`);
      await repo.updateStatus(
        executionId,
        PatrolExecutionStatus.Failed,
        '任务执行超时或后端进程崩溃'
      );
      console.log('✓ Status updated successfully');
    } else {
      console.log(`Still within normal execution time, not updating`);
    }
  } else {
    console.log(`Status is not 'running', no action needed`);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
