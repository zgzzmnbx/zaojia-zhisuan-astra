// Combinations of my-office's MIT chibi hair, clothing and accessories.
// Palette/style/accessory choices come from its workers.js; suit from director.js.
export const appearances=[
  {id:'inherit',label:'跟随画面风格'},
  {id:'blue-shirt',label:'蓝衬衫 · 短发',shirt:'#3F7CC4',hair:'#1E1E24',style:'plain',outfit:'shirt'},
  {id:'headphones',label:'耳机 · 连帽衫',shirt:'#2A9D8F',hair:'#3B2618',style:'plain',outfit:'hoodie',acc:'headphones'},
  {id:'glasses',label:'圆框眼镜 · 衬衫',shirt:'#6A8042',hair:'#5A3825',style:'plain',outfit:'shirt',acc:'glasses'},
  {id:'cap',label:'棒球帽 · 休闲装',shirt:'#E8742A',hair:'#1E1E24',style:'plain',outfit:'hoodie',acc:'cap'},
  {id:'beanie',label:'毛线帽 · 连帽衫',shirt:'#7A6FD0',hair:'#3B2618',style:'plain',outfit:'hoodie',acc:'beanie'},
  {id:'ponytail',label:'马尾 · 青绿衬衫',shirt:'#3E8E7E',hair:'#5A3825',style:'ponytail',outfit:'shirt'},
  {id:'bun',label:'丸子头 · 紫色衬衫',shirt:'#8C4FA8',hair:'#1E1E24',style:'bun',outfit:'shirt'},
  {id:'bob',label:'波波头 · 玫红衬衫',shirt:'#C2577A',hair:'#7A4E2D',style:'bob',outfit:'shirt'},
  {id:'curly',label:'卷发 · 连帽衫',shirt:'#C9A227',hair:'#3B2618',style:'curly',outfit:'hoodie'},
  {id:'spiky',label:'刺猬头 · 蓝紫休闲装',shirt:'#5B6CD8',hair:'#1E1E24',style:'spiky',outfit:'hoodie'},
  {id:'suit',label:'深蓝西装 · 眼镜',shirt:'#2B3A55',hair:'#3A3A40',style:'plain',acc:'glasses',outfit:'suit',pants:'#262B35',shoes:'#1B1B1E'},
  {id:'red-shirt',label:'红衬衫 · 短发',shirt:'#D64550',hair:'#9A4A24',style:'plain',outfit:'shirt'},
  {id:'long-black',label:'黑长直 · 米白连衣裙',shirt:'#DAD9D1',hair:'#171A22',style:'long-straight',outfit:'dress',shoes:'#E7E5E0',pants:'#3B4352'},
  {id:'long-black-lilac',label:'黑长直 · 浅紫连衣裙',shirt:'#ADA5C9',hair:'#171A22',style:'long-straight',outfit:'dress',shoes:'#E7E5E0',pants:'#3B4352'},
  {id:'long-wavy',label:'大波浪 · 奶油连衣裙',shirt:'#DDCFBA',hair:'#50362C',style:'long-wavy',outfit:'dress',shoes:'#E7E5E0',pants:'#42434E'},
  {id:'long-wavy-rose',label:'大波浪 · 豆沙连衣裙',shirt:'#BB8B99',hair:'#2C242A',style:'long-wavy',outfit:'dress',shoes:'#E7E5E0',pants:'#42434E'},
];
export const normalizeAppearance=id=>appearances.some(a=>a.id===id)?id:'inherit';
export const appearanceConfig=id=>appearances.find(a=>a.id===id&&a.id!=='inherit');
