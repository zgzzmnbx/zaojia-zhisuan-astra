import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./knowledgeDemoChart.css";

export type KnowledgeDemoChartData = {
  type: "bar";
  title: string;
  x_axis_label: string;
  y_axis_label: string;
  unit: string;
  items: Array<{
    label: string;
    value: number;
    highlight?: boolean;
  }>;
};

type Props = {
  chart: KnowledgeDemoChartData;
};

const amountFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

export default function KnowledgeDemoChart({ chart }: Props) {
  if (chart.type !== "bar" || chart.items.length === 0) return null;

  return (
    <section className="knowledge-demo-chart" aria-label={chart.title}>
      <header>
        <div>
          <span>知识库数据图表</span>
          <strong>{chart.title}</strong>
        </div>
        <small>{chart.y_axis_label}</small>
      </header>
      <div className="knowledge-demo-chart__scroll">
        <div className="knowledge-demo-chart__canvas" role="img" aria-label={`${chart.title}，共${chart.items.length}个管径`}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={chart.items} margin={{ top: 28, right: 14, left: 2, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                angle={-38}
                height={64}
                textAnchor="end"
                tick={{ fontSize: 12 }}
              />
              <YAxis width={52} tick={{ fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                formatter={(value) => [`${amountFormatter.format(Number(value))} ${chart.unit}`, "清单单价"]}
                labelFormatter={(label) => `管径 ${label}`}
              />
              <Bar
                dataKey="value"
                name="清单单价"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {chart.items.map((item) => (
                  <Cell
                    key={item.label}
                    fill={item.highlight ? "#1d4ed8" : "#7aa7e8"}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value: unknown) => amountFormatter.format(Number(value))}
                  className="knowledge-demo-chart__label"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p>{chart.x_axis_label}按知识库记录从小到大排列；深蓝色为最高单价。</p>
    </section>
  );
}
