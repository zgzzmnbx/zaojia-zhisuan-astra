# WeKnora 接入与验收

日期：2026-10-06。版本：v0.4.0。范围：智算Astra 独立目录。

## 当前结论

接入层与界面已实现，Windows 主用 WeKnora 服务健康接口实际返回 200。Astra 独立访问凭证尚未配置；用户已收到“复用原连接配置 / 提供独立凭证路径”的待答问题。**尚未完成真实 WeKnora 问答联调，不能标记端到端接通。**

## 需求清单

- [已完成] 在现有对话选择本地检索 / WeKnora，右侧核对范围、引用与来源；继续保留 Gork。
- [已完成] 独立后端适配 13 份已获准造价资料，仅传 knowledge_ids；不发送 Excel、项目文件和其他对话。
- [已完成] 连接状态核对权限、资料名称、ID、文件版本及完成状态；失效 / 未配置 / 不可达明确显示。
- [已完成] 仅完整回答且引用核验通过才输出正文；拒答明确，无自动换引擎、自动重发或拼接半段回答。
- [已完成] 停止中断本地接收并调用上游 stop；晚到结果不会变成正式回答。页面断开也尝试停止上游。
- [已完成] 回答与引用卡随对话保存；引用快照写 Astra 独立 SQLite，保留 30 天，过期 / 版本变化明确反馈。
- [进行中] 按用户确认配置现有受保护凭证引用，完成真实回答、原文、拒答与停止验收。
- [待开发] 原模型回答 / 双路对比与完整知识治理，仍按全功能迁移矩阵保留。

## 接口与隔离

Astra 只向浏览器暴露同源 `/api/astra/weknora/` 的 capabilities、ask-stream、requests/{id}/cancel、citations/{id}。实际上游为 Windows 主用本机 18091，原文入口为 18090；不触碰 VMware 备用服务，不重启 WeKnora，不读取其数据库。

`03-Src/weknora.py` 从冻结宿主适配器迁移，补上独立配置命名空间、实际连接检测、取消清理屏蔽、输入边界与请求缓存上限。原 `03-Src/engine/` 的 308 项文件哈希全部保持。计价 / 双系数 / 规则 / 预警 / 报告仍走原机械流程。

配置入口 `config/astra-weknora.local.json` 已被忽略，只保存 enabled、base_url、api_key_file 引用；示例为 `config/astra-weknora.example.json`。也支持 `ASTRA_WEKNORA_*` 环境变量。凭证不写进浏览器、回答、日志或快照。当前没有读取原造价智算的生产凭证。

WeKnora 会话按当前 Astra 对话分开保存在浏览器运行内存，避免跨对话混入上文。刷新页面或重启服务后重新建立问答上下文，已保存回答与来源卡保持；过期 / 范围变化明确报错，下一次手动发送重新建立会话。

## 验证记录

| 检查 | 结果 | 证据与边界 |
| --- | --- | --- |
| 前端测试 | 25 passed | 包含 UTF-8 / CRLF 分块、SSE 断流、取消、晚到完整结果、无引用终态 |
| 后端、宿主、工作空间 | 45 passed | 19 项新增 WeKnora 契约用例；上游为合成 MockTransport，未调用外部模型 |
| 类型与生产构建 | 通过 | 既有 3D 懒加载包体积提示保留 |
| 冻结引擎资产 | 308 / 308 哈希相同 | 不改规则与价格引擎；本轮无需重新执行 V3.1 定价全流程 |
| 本机 WeKnora 健康 | HTTP 200 | 仅服务健康，不等于获准资料问答通过 |
| Astra 连接能力 | available=false / MODULE_DISABLED | 未配置独立凭证，不伪报已连接 |
| 浏览器 | 本地检索真实返回 8 条来源、会话保存；未配置卡片与按钮禁用符合实际 | 1440×900 / 390×844 亮色、1280×720 深色；控制项 13px、辅助 12px、本地苹方，页面无横向溢出；已恢复亮色及原对话，草稿保持 |
| 真实 WeKnora 回答 / 引用 / 拒答 / 停止 | 待执行 | 需要完成待答的凭证配置选择 |

截图留在 `Codex-Temp/acceptance/weknora/`。仅重启了 Astra 5189，原项目 8000 / 5174 和 WeKnora 服务未重启。

## 关联资产

- `03-Src/weknora.py`、`03-Src/server.py`
- `03-Src/studio/weknora-stream.ts`、`useWeKnora.ts`、`MigratedModules.tsx`、`App.tsx`
- `03-Src/engine/config/knowledge-weknora-scope.json`
- `tests/test_weknora.py`、`03-Src/studio/weknora-stream.test.mjs`
- [WeKnora 官方项目](https://github.com/Tencent/WeKnora)；以本机固定服务契约及现有适配器为准，不将最新主干能力混记为本机已接入。
