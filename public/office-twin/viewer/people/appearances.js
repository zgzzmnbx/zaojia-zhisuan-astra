// Combinations of my-office's MIT chibi hair, clothing and accessories.
// Style/accessory choices come from its workers.js; suit from director.js.
// Astra's soft office palette; soft charcoal/brown hair retains sculpted highlights.
export const personPalette={shirts:['#B7D9E8','#CADBE5','#C3DED5'],pants:'#A8B8C9',shoes:'#A1AAB7',skin:'#FFE4D3'};
export const appearances=[
  {id:'inherit',label:'跟随画面风格'},
  {id:'blue-shirt',label:'蓝衬衫 · 短发',shirt:'#A8D2EB',hair:'#555963',style:'plain',outfit:'shirt'},
  {id:'headphones',label:'耳机 · 连帽衫',shirt:'#B4DCD4',hair:'#756355',style:'plain',outfit:'hoodie',acc:'headphones'},
  {id:'glasses',label:'圆框眼镜 · 衬衫',shirt:'#D1DDC1',hair:'#896D59',style:'plain',outfit:'shirt',acc:'glasses'},
  {id:'cap',label:'棒球帽 · 休闲装',shirt:'#F2C9AD',hair:'#555963',style:'plain',outfit:'hoodie',acc:'cap'},
  {id:'beanie',label:'毛线帽 · 连帽衫',shirt:'#CEC9E9',hair:'#756355',style:'plain',outfit:'hoodie',acc:'beanie'},
  {id:'ponytail',label:'马尾 · 青绿衬衫',shirt:'#B7DCD0',hair:'#896D59',style:'ponytail',outfit:'shirt'},
  {id:'bun',label:'丸子头 · 紫色衬衫',shirt:'#D8C3E3',hair:'#555963',style:'bun',outfit:'shirt'},
  {id:'bob',label:'波波头 · 浅玫瑰衬衫',shirt:'#E8BDCE',hair:'#997658',style:'bob',outfit:'shirt'},
  {id:'curly',label:'卷发 · 连帽衫',shirt:'#E8D8A9',hair:'#756355',style:'curly',outfit:'hoodie'},
  {id:'spiky',label:'刺猬头 · 蓝紫休闲装',shirt:'#BCC9EB',hair:'#555963',style:'spiky',outfit:'hoodie'},
  {id:'suit',label:'雾蓝西装 · 眼镜',shirt:'#B1C7DF',hair:'#666871',style:'plain',acc:'glasses',outfit:'suit',pants:'#9BAEC4',shoes:'#8E9CAD'},
  {id:'red-shirt',label:'红衬衫 · 短发',shirt:'#E8B6BD',hair:'#AF7956',style:'plain',outfit:'shirt'},
  {id:'long-black',label:'黑长直 · 米白连衣裙',shirt:'#F1EFE5',hair:'#4B505B',style:'long-straight',outfit:'dress',shoes:'#E7E5E0',pants:'#A8B8C9'},
  {id:'long-black-lilac',label:'黑长直 · 浅紫连衣裙',shirt:'#DCD6EE',hair:'#4B505B',style:'long-straight',outfit:'dress',shoes:'#E7E5E0',pants:'#A8B8C9'},
  {id:'long-wavy',label:'大波浪 · 奶油连衣裙',shirt:'#EFE4D1',hair:'#7B655A',style:'long-wavy',outfit:'dress',shoes:'#E7E5E0',pants:'#A8B8C9'},
  {id:'long-wavy-rose',label:'大波浪 · 豆沙连衣裙',shirt:'#E4C3CE',hair:'#62565F',style:'long-wavy',outfit:'dress',shoes:'#E7E5E0',pants:'#A8B8C9'},
];
export const normalizeAppearance=id=>appearances.some(a=>a.id===id)?id:'inherit';
export const appearanceConfig=id=>appearances.find(a=>a.id===id&&a.id!=='inherit');
