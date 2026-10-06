export const OFFLINE_DEMO_FILL_PRESET_ID = "offline-demo-fill-table2-row6";
export const OFFLINE_DEMO_FILL_PROCESSING_MS = 4_000;

export type OfflineDemoFillContext = {
  sheetName: string;
  rowNumber: number;
  values: Record<string, string>;
};

function compact(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/[\s\u3000]/g, "").toLowerCase();
}

function contextValue(values: Record<string, string>, aliases: readonly string[]) {
  const normalizedAliases = aliases.map(compact);
  const entry = Object.entries(values).find(([key]) => {
    const normalizedKey = compact(key);
    return normalizedAliases.some((alias) => normalizedKey === alias || normalizedKey.includes(alias));
  });
  return compact(entry?.[1]);
}

export function isOfflineDemoFillContext(context: OfflineDemoFillContext | null | undefined) {
  if (!context) return false;
  if (compact(context.sheetName) !== compact("表2-通用工程测量费用")) return false;
  if (context.rowNumber !== 6) return false;

  const price = contextValue(context.values, ["基价（元）", "基价/单价", "基价", "单价"]);

  return (
    contextValue(context.values, ["内容", "要素2"]) === compact("首级控制测量")
    && contextValue(context.values, ["类别", "要素4"]) === compact("GPS测量E级")
    && contextValue(context.values, ["比例尺", "要素5"]) === compact("中等")
    && contextValue(context.values, ["单位"]) === compact("个")
    && (price === "" || price === "3203")
  );
}
