export type WorkspaceLayoutMode = "classic" | "agent-primary";

export type WorkspaceLayoutDefaults = {
  defaultMode: WorkspaceLayoutMode;
  agentWidthPercent: number;
  previewOpen: boolean;
};

export function normalizeWorkspaceLayout(raw: unknown): WorkspaceLayoutDefaults {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    defaultMode: value.defaultMode === "agent-primary" ? "agent-primary" : "classic",
    agentWidthPercent: typeof value.agentWidthPercent === "number" && Number.isFinite(value.agentWidthPercent)
      ? Math.min(65, Math.max(42, value.agentWidthPercent)) : 55,
    previewOpen: value.previewOpen !== false,
  };
}

// Keep both workspaces usable; a smaller container uses one pane at a time.
export function workspaceSplitBounds(width: number) {
  return {
    compact: width < 980,
    min: Math.max(25, 360 / Math.max(width - 8, 1) * 100),
    max: Math.min(65, (1 - 400 / Math.max(width - 8, 1)) * 100),
  };
}

export function clampWorkspaceSplit(percent: number, width: number): number {
  const bounds = workspaceSplitBounds(width);
  return bounds.compact ? 55 : Math.min(bounds.max, Math.max(bounds.min, percent));
}
