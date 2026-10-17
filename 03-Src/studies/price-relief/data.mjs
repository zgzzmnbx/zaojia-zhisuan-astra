// Screenshot-derived examples only. No task, workbook, model or storage access.
export const fields=['工程类别','测量层级','测量等级','复杂程度'];
export const target=['控制测量','首级控制测量','GPS测量C级','中等'];
export const candidates=[
 {price:4274,row:24,values:[...target]},
 {price:3203,row:18,values:[...target.slice(0,2),'GPS测量E级','中等']},
 {price:3632,row:21,values:[...target.slice(0,2),'GPS测量D级','中等']},
 {price:3727,row:23,values:[...target.slice(0,3),'简单']},
 {price:5500,row:25,values:[...target.slice(0,3),'复杂']},
 {price:2821,row:17,values:[...target.slice(0,2),'GPS测量E级','简单']},
].map(c=>({...c,matches:c.values.filter((v,i)=>v===target[i]).length}));
export const format=n=>n.toLocaleString('en-US');
