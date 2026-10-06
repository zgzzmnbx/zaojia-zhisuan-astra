export type ZhisuanMessageRevealMode = "character" | "block";

export function nextZhisuanMessageReveal(
  content: string,
  displayedContent: string,
  mode: ZhisuanMessageRevealMode,
) {
  if (displayedContent.length >= content.length) return content;
  if (mode === "character") {
    return content.slice(0, displayedContent.length + 2);
  }

  const remaining = content.slice(displayedContent.length);
  const paragraphBreak = remaining.match(/\n\s*\n/);
  if (!paragraphBreak || paragraphBreak.index === undefined) return content;
  return content.slice(
    0,
    displayedContent.length + paragraphBreak.index + paragraphBreak[0].length,
  );
}

export function zhisuanMessageRevealDelay(mode: ZhisuanMessageRevealMode) {
  return mode === "block" ? 260 : 24;
}
