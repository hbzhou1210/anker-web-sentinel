/**
 * Jest 配置文件
 *
 * 配置 TypeScript + ESM 支持的测试环境
 */

export default {
  // 使用 ts-jest 预设处理 TypeScript 文件
  preset: 'ts-jest/presets/default-esm',

  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],

  // 忽略的目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // 模块名称映射 (处理 .js 导入)
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // 转换配置
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'node',
          esModuleInterop: true,
        },
      },
    ],
  },

  // 代码覆盖率配置
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts', // 通常只是导出
    '!src/loader.ts', // 入口文件
    '!src/database/migrate.ts', // 迁移脚本
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
  },

  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // 覆盖率输出目录
  coverageDirectory: 'coverage',

  // 测试超时(毫秒)
  testTimeout: 10000,

  // 详细输出
  verbose: true,

  // 在测试之间自动清理 mock
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // 设置文件(在每个测试文件之前运行)
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
