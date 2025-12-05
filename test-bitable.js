// 测试多维表格数据生成
// 使用简单的测试点数据

const testPoints = [
  {
    category: "功能测试",
    feature: "邮箱注册",
    description: "验证用户使用有效的邮箱地址和符合规则的密码能够成功注册",
    priority: "high",
    testType: "正向测试",
    preconditions: "用户未注册过该邮箱",
    expectedResult: "注册成功,发送验证邮件,提示用户查收邮件进行验证",
    testData: {
      email: "test@example.com",
      password: "Test@123456"
    }
  },
  {
    category: "功能测试",
    feature: "邮箱注册",
    description: "验证用户使用无效的邮箱格式无法注册",
    priority: "high",
    testType: "反向测试",
    preconditions: "无",
    expectedResult: "显示错误提示'邮箱格式不正确',注册失败",
    testData: {
      email: "invalid-email",
      password: "Test@123456"
    }
  },
  {
    category: "功能测试",
    feature: "手机号注册",
    description: "验证用户使用有效的手机号和密码能够成功注册",
    priority: "high",
    testType: "正向测试",
    preconditions: "用户未注册过该手机号",
    expectedResult: "注册成功,系统记录用户信息",
    testData: {
      phone: "13800138000",
      password: "Test@123456"
    }
  }
];

// 生成字段定义
const fieldDefinitions = [
  {
    field_name: '用例ID',
    type: 1, // Text 文本
    ui_type: 'Text',
  },
  {
    field_name: '模块',
    type: 1, // Text 文本
    ui_type: 'Text',
  },
  {
    field_name: '优先级',
    type: 3, // SingleSelect 单选
    ui_type: 'SingleSelect',
    property: {
      options: [
        { name: '高 🔴', color: 0 },
        { name: '中 🟡', color: 1 },
        { name: '低 🟢', color: 2 },
      ],
    },
  },
  {
    field_name: '测试类型',
    type: 3, // SingleSelect 单选
    ui_type: 'SingleSelect',
    property: {
      options: [
        { name: '功能测试', color: 0 },
        { name: '安全测试', color: 1 },
        { name: '性能测试', color: 2 },
        { name: '正向测试', color: 5 },
        { name: '反向测试', color: 6 },
      ],
    },
  },
  {
    field_name: '用例标题',
    type: 1, // Text 文本
    ui_type: 'Text',
  },
  {
    field_name: '操作步骤',
    type: 1, // Text 多行文本
    ui_type: 'Text',
  },
  {
    field_name: '预期结果',
    type: 1, // Text 多行文本
    ui_type: 'Text',
  },
  {
    field_name: '实际执行结果',
    type: 1, // Text 多行文本
    ui_type: 'Text',
  },
];

// 生成记录数据
function getPriorityText(priority) {
  const map = {
    high: '高 🔴',
    medium: '中 🟡',
    low: '低 🟢',
  };
  return map[priority] || priority;
}

const records = testPoints.map((point, index) => {
  const caseId = `TC${String(index + 1).padStart(4, '0')}`;

  let steps = '';
  if (point.preconditions) {
    steps += `前置条件：${point.preconditions}\n\n`;
  }
  if (point.testData) {
    steps += `测试数据：\n${JSON.stringify(point.testData, null, 2)}`;
  }
  if (!steps) {
    steps = point.description;
  }

  return {
    fields: {
      '用例ID': caseId,
      '模块': point.feature || point.category || '其他',
      '优先级': getPriorityText(point.priority),
      '测试类型': point.testType || '功能测试',
      '用例标题': point.description,
      '操作步骤': steps,
      '预期结果': point.expectedResult || '符合预期',
      '实际执行结果': '',
    },
  };
});

console.log('=== 字段定义 ===');
console.log(JSON.stringify(fieldDefinitions, null, 2));

console.log('\n=== 记录数据 ===');
console.log(JSON.stringify(records, null, 2));
