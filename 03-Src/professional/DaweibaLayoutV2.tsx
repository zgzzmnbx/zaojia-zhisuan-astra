import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Columns3,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Settings,
  Upload,
} from "lucide-react";
import "./daweiba-v2.css";

const modules = [
  { index: "01", name: "填价工作台", detail: "上传与列映射", icon: <Upload size={17} /> },
  { index: "02", name: "结果预览", detail: "转换后查看", icon: <FileSpreadsheet size={17} /> },
  { index: "03", name: "经验池预警", detail: "手动运行", icon: <AlertTriangle size={17} /> },
  { index: "04", name: "工作量抓取", detail: "独立预处理", icon: <Columns3 size={17} /> },
  { index: "05", name: "Word 报告", detail: "可下载报告", icon: <FileText size={17} /> },
  { index: "06", name: "知识库问答", detail: "本地证据解释", icon: <Database size={17} /> },
];

const chatItems = [
  { speaker: "Z", text: "你好，我是智算。拖入 Excel 后，我会跟随字段识别、结构化匹配和报告输出。" },
  { speaker: "U", text: "经验池预警分析" },
  { speaker: "Z", text: "收到。预警分析会先找同类记录，再按偏离率拆分高风险和低风险。" },
];

export function DaweibaLayoutV2() {
  return (
    <main className="daweiba-v2-shell" aria-label="大尾巴主题 V2 平铺化试验场">
      <header className="daweiba-v2-topbar">
        <strong>造价智算</strong>
        <span>V2 Preview · Navattic-flat playground · /v2-preview</span>
        <a href="/">返回主界面</a>
      </header>

      <div className="daweiba-v2-layout">
        <aside className="daweiba-v2-left" aria-label="模块导航">
          <div className="daweiba-v2-mark">智</div>
          <div className="daweiba-v2-current">
            <span>当前模块</span>
            <strong>填价工作台</strong>
          </div>
          <nav className="daweiba-v2-menu">
            {modules.map((item, index) => (
              <button className={index === 0 ? "is-active" : ""} key={item.index} type="button">
                <span>{item.index}</span>
                <i>{item.icon}</i>
                <b>{item.name}</b>
                <small>{item.detail}</small>
              </button>
            ))}
          </nav>
          <div className="daweiba-v2-nav-status">
            <strong>101</strong>
            <span>输入行</span>
            <strong>0</strong>
            <span>待复核</span>
          </div>
        </aside>

        <section className="daweiba-v2-main" aria-label="主工作区">
          <section className="daweiba-v2-workbench">
            <div className="daweiba-v2-panel daweiba-v2-upload">
              <div className="daweiba-v2-heading">
                <span>01</span>
                <div>
                  <p>输入</p>
                  <h2>上传标准 Excel</h2>
                </div>
              </div>
              <div className="daweiba-v2-upload-zone">
                <Upload size={30} />
                <strong>拖拽 Excel 到这里</strong>
                <span>或点击选择 .xlsx 文件</span>
              </div>
              <div className="daweiba-v2-actions">
                <button className="daweiba-v2-primary" type="button">开始转换</button>
                <button type="button">选文件</button>
              </div>
              <div className="daweiba-v2-mapping">
                <strong>列映射设置</strong>
                <span>已识别 3 个候选 sheet，当前 表2-通用工程测量费用</span>
              </div>
            </div>

            <div className="daweiba-v2-panel daweiba-v2-summary">
              <div className="daweiba-v2-heading">
                <span>02</span>
                <div>
                  <p>简报</p>
                  <h2>转换后概览</h2>
                </div>
              </div>
              <div className="daweiba-v2-summary-line">
                <strong>100%</strong>
                <span>输入 101 行，匹配 101 行。</span>
              </div>
              <div className="daweiba-v2-progress"><span /></div>
              <div className="daweiba-v2-metrics">
                <div><span>输入行数</span><strong>101</strong></div>
                <div><span>转换成功</span><strong>101</strong></div>
                <div><span>结构匹配</span><strong>101</strong></div>
                <div><span>待复核</span><strong>0</strong></div>
              </div>
              <div className="daweiba-v2-actions">
                <button className="daweiba-v2-primary" type="button"><Download size={16} /> 下载 Excel</button>
                <button type="button"><Download size={16} /> 下载 Word</button>
              </div>
            </div>

            <div className="daweiba-v2-panel daweiba-v2-status">
              <div className="daweiba-v2-heading">
                <span>03</span>
                <div>
                  <p>状态</p>
                  <h2>工作状态</h2>
                </div>
              </div>
              <div className="daweiba-v2-status-grid">
                <div>
                  <span>匹配状态</span>
                  <strong><CheckCircle2 size={18} />101/101 行完成</strong>
                  <small>待复核 0 行 · 预警未运行</small>
                </div>
                <div className="daweiba-v2-quality">
                  <i>100%</i>
                  <span>匹配质量分布</span>
                  <strong>高置信匹配 101 行</strong>
                  <small>低风险 0 行 · 高风险 0 行</small>
                </div>
              </div>
              <p className="daweiba-v2-output">价格列：H · 输出文件：【输出】-控制价计算表.xlsx</p>
            </div>
          </section>
        </section>

        <aside className="daweiba-v2-ai" aria-label="智算助手">
          <div className="daweiba-v2-ai-head">
            <div>
              <span>随行助手</span>
              <h2>智算</h2>
            </div>
            <button type="button" aria-label="设置"><Settings size={18} /></button>
          </div>
          <div className="daweiba-v2-chat">
            {chatItems.map((item, index) => (
              <div className={`daweiba-v2-message ${item.speaker === "U" ? "is-user" : ""}`} key={`${item.speaker}-${index}`}>
                <b>{item.speaker}</b>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <div className="daweiba-v2-quick">快捷指令⌃</div>
          <div className="daweiba-v2-compose">
            <span>输入一句问题</span>
            <button type="button">发送</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
