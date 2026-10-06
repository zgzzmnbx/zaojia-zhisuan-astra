const paths = {
  'sidebar-close':'M3 3h18v18H3ZM9 3v18M17 8l-4 4 4 4',
  'sidebar-open':'M3 3h18v18H3ZM9 3v18M13 8l4 4-4 4',
  pause:'M9 5v14M15 5v14',play:'m8 5 11 7-11 7Z',
  plus:'M12 5v14M5 12h14',close:'m6 6 12 12M18 6 6 18',chevron:'m8 10 4 4 4-4', 'arrow-up':'M12 19V5m-6 6 6-6 6 6','arrow-right':'M5 12h14m-6-6 6 6-6 6','arrow-up-right':'M7 17 17 7M7 7h10v10',
  message:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3H13a8 8 0 0 1 8 8.5Z M7 9h10M7 13h6',
  folder:'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3Z',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',book:'M12 5v16M3 3c4 0 6 1 9 3 3-2 5-3 9-3v15c-4 0-6 1-9 3-3-2-5-3-9-3Z',
  sheet:'M14 2H5v20h14V7ZM14 2v6h5M8 12h8M8 16h8M12 10v10',file:'M14 2H5v20h14V7ZM14 2v6h5M8 12h8M8 16h6',settings:'m10 3-1 3-3 1-3 3v4l3 3 3 1 1 3h4l1-3 3-1 3-3v-4l-3-3-3-1-1-3ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  spark:'m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6ZM20 2v4M18 4h4',shield:'m12 3 9 4v6c0 4-5 7-9 9-4-2-9-5-9-9V7ZM8 12l3 3 5-6',
  check:'M20 6 9 17l-5-5',circlecheck:'M22 11v1a10 10 0 1 1-6-9M22 4 12 14l-3-3',clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  route:'M5 5h10a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h10M5 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6M19 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  moon:'M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z',sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  info:'M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',menu:'M3 6h18M3 12h18M3 18h18',edit:'m16 3 5 5-12 12H4v-5ZM14 5l5 5',dots:'M5 12h.1M12 12h.1M19 12h.1',expand:'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',panel:'M3 3h18v18H3ZM10 3v18',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',filter:'M3 4h18l-7 8v7l-4 2v-9Z',search:'m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  database:'M3 5c0-4 18-4 18 0s-18 4-18 0Zm0 0v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0',columns:'M3 3h18v18H3ZM9 3v18M15 3v18',users:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M21 21v-3a4 4 0 0 0-3-4M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 2a4 4 0 0 1 0 8',
  network:'M12 5 5 16M12 5l7 11M5 16h14M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6M5 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6M19 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6',pin:'M20 9c0 6-8 13-8 13S4 15 4 9a8 8 0 1 1 16 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',monitor:'M2 3h20v14H2ZM8 21h8M12 17v4',
  orbit:'M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0ZM16 12c0 5-2 9-4 9s-4-4-4-9 2-9 4-9 4 4 4 9ZM3 12h18',alert:'m12 3 10 18H2ZM12 9v5M12 17v1',upload:'M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6',stop:'M6 6h12v12H6z',refresh:'M21 4v6h-6M3 20v-6h6M20 10a8 8 0 0 0-14-5M4 14a8 8 0 0 0 14 5',link:'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l2-2',
};
export function icon(name,cls=''){return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;}
export function paintIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);el.removeAttribute('data-icon');});}
