# WeKnora 问答接入 PRD

## 模块目标

在现有“问问智算”聊天区增加可手动选择的 WeKnora 普通知识问答。原 `/api/knowledge/ask`、检索模式、项目记忆、行级复核和专业计价路径保持原有行为。首版范围只允许 Windows 主用实例中获准的 13 份 `cost-aiw` 资料；默认关闭，不自动回退或改写三个数字。

本轮执行来源是用户提供的 [完整任务包](完整任务包.md)。任务包是规划与验收定义，不能作为当前实现或本机实测的证明。

## 需求清单

| 状态 | 需求 | 验收口径 |
| --- | --- | --- |
| [已完成] | 原聊天区显示增强开关与手动引擎选择 | 默认原有问答；关闭时不调用 WeKnora；旧资料库和 classic/hybrid 偏好保留 |
| [进行中] | 对比输出模式 | 同一普通问题并行请求原有问答与 WeKnora，在同一会话按引擎标明两份回答；停止同时取消两路。业务指令和行级复核仍走原流程；前端构建、不可用禁用态及隔离模拟双路浏览器输出已核验，Windows 主用实例真实双引擎问答待启动后联调 |
| [已完成] | 宿主独立问答入口与 Windows 资料白名单 | `ask-stream` 仅接受 `cost-aiw` 普通问答；逐请求核对文件 ID、状态、名称和 MD5，不传宽知识库 ID；本机 13/13 核对通过 |
| [进行中] | 完整 WeKnora 回答、引用与停止 | 正例完整回答和 2 条实际引用已通过；停止尽力调用上游 stop，竞态仍待联调 |
| [进行中] | 来源查看与历史可用性 | 浏览器片段弹窗和 WeKnora 原文页已打开；引用持久化到本机 SQLite，服务重启与失效门禁待回归 |
| [进行中] | 主用 Windows 实例真实问答验收 | 凭证、会话、正例、无依据反例、浏览器来源已实测；断流、故障和性能矩阵仍待完成 |
| [待开发] | QG0—QG4 全部门禁 | 按任务包验收矩阵记录实际通过、失败或阻塞；不得用单元测试代替本机问答 |

## 接口与边界

- 新路由：`GET /api/knowledge/capabilities`、`POST /api/knowledge/ask-stream`、`POST /api/knowledge/requests/{id}/cancel`、`GET /api/knowledge/citations/{id}`。
- 服务端由 `WEKNORA_QA_ENABLED=1` 显式启用；首选 `WEKNORA_QA_API_KEY_FILE` 从受保护文件读取 WeKnora 仅 `retrieve`＋`chat` 的服务密钥，也兼容运行环境 `WEKNORA_QA_BEARER_TOKEN`。绝不写入 Git 或前端。默认上游地址为 Windows 主用 `127.0.0.1:18091`。上游限制带 KB 范围的 API 密钥传入 `knowledge_ids`，因此服务密钥不带 KB 级约束；宿主仍逐请求核验 13 份白名单。该密钥须按 90 天有效期轮换。
- 配置 `config/knowledge-weknora-scope.json` 固定 13 个获准文件的 Windows 实例 ID、来源 SHA256 和上游 MD5。实际请求只传这批文件 ID；映射漂移即停止。
- 当前仅限本机单 worker 试点；企业多用户身份、会话与来源持久化需另设可靠存储和鉴权后再开放网络访问。
- Wiki、实体图谱、资料上传、模型更换、云端发布和自动回退均不在本轮。

## 功能边界

增强通路只接普通资料问答。旧问答入口、项目记忆、任务/项目范围知识、行级复核、主填价和三个数字的裁决继续使用原路径。服务端默认关闭，前端开关只影响当前页面会话；服务不可用、凭证过期或引用越界时明确报错或拒答，不自动改用其他引擎。上游检索参考只有被回答实际标注且在白名单中的片段才显示为来源。

## 验收口径

本机试点须核对 Windows 主库 13/13 文件状态与内容哈希、默认关闭和手动选择、正例完整回答及实际引用、无依据 0 引用、片段和原文可打开、取消后无完成事件、服务重启后引用可读，并运行专项单测、后端全量回归和前端生产构建。完整 QG0—QG4 还须覆盖断流、故障、重复请求、源变更和 V3.1 业务成对验收，证据逐项记录在本模块验收文档；当前未通过的项目不得标记完成。

## 关联资产

- `backend/app/weknora_qa.py`
- `backend/app/main.py`
- `frontend/src/App.tsx`
- `frontend/src/components/agent-workspace/ConversationalAgentWorkspace.tsx`
- `config/knowledge-weknora-scope.json`
- `config/project-default-settings.json`
- `backend/tests/test_weknora_qa.py`
