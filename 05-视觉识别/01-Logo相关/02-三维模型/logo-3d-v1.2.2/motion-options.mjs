export const LOGO_MOTIONS=[
  {id:'static',name:'静止',duration:1,clip:'Pose_Static'},
  {id:'sway',name:'左右摇摆',duration:8,clip:'Pose_Sway'},
  {id:'tail',name:'尾块飞回',duration:10,clip:'Pose_Tail_Flyby'},
  {id:'scatter',name:'打散恢复',duration:12,clip:'Pose_Scatter_Return'},
];
export const normalizeMotion=id=>LOGO_MOTIONS.some(m=>m.id===id)?id:'tail';
