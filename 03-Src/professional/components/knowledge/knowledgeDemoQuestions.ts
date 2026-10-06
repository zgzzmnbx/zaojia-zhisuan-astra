export const DEMO_KNOWLEDGE_QUESTIONS = [
  "勘察测量，技术工作费调整系数如何确定？",
  "走向图编制、地图编制、Ⅱ类、1:50000，价格如何确定？以及相邻比例尺价格如何确定？",
  "对比清单编码10504014、10504015、10504016，只回答管径、单位、清单单价和来源定位，用Markdown表格。",
  "查询清单编码10504001至10504016的过路过桥费，按管径从小到大输出柱状图，并指出价格平台区间和最高单价，只使用造价通用知识库数据，不进行区间插值。",
] as const;

function normalizeDemoQuestion(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s　，,。；;：:？?、“”"'（）()\-_—–]+/g, "");
}

const DEMO_QUESTION_KEYS = new Set(DEMO_KNOWLEDGE_QUESTIONS.map(normalizeDemoQuestion));

export function isDemoKnowledgeQuestion(question: string) {
  return DEMO_QUESTION_KEYS.has(normalizeDemoQuestion(question));
}
