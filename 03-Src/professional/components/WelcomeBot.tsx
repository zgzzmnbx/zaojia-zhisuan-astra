import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ZhisuanAvatar from './ZhisuanAvatar';

/** Anchor the bot behind the preview without reserving space above the heading. */
export default function WelcomeBot() {
  const slot = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ host: HTMLElement; left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const host = slot.current?.closest<HTMLElement>('.welcome-shell');
    const card = host?.querySelector<HTMLElement>('.welcome-product-frame, .welcome-board');
    if (!host || !card) return;
    const update = () => {
      const size = slot.current!.getBoundingClientRect().width;
      const next = { host, left: card.offsetLeft + card.offsetWidth * 0.80 - size / 2, top: card.offsetTop - size * 0.55 };
      setAnchor(previous => previous?.left === next.left && previous?.top === next.top ? previous : next);
    };
    const resize = new ResizeObserver(update);
    resize.observe(host);
    resize.observe(card);
    resize.observe(slot.current!);
    window.addEventListener('resize', update);
    update();
    return () => { resize.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  return <>
    <span ref={slot} className="welcome-bot-slot" aria-hidden="true" />
    {anchor && createPortal(<div className="welcome-bot-peek" style={{ left: anchor.left, top: anchor.top }}>
      <ZhisuanAvatar welcome className="welcome-bot" size="large" />
      <span className="welcome-bot-notice" aria-hidden="true" />
    </div>, anchor.host)}
  </>;
}
