import {loadGlobeGeometry} from '../../../globe-resources';
const palettes={
 dark:{ocean:'#081e34',land:'#293e50',coast:'#547085',river:'#38637e',province:'#a1c3d6',label:'#d5e6ed',halo:'#182f42'},
 light:{ocean:'#a9cfe3',land:'#e6e8df',coast:'#809aa7',river:'#7ba9c5',province:'#758e96',label:'#344e5c',halo:'#edf1e9'},
 satellite:{province:'#ddedfa',label:'#f3f8ff',halo:'#1b3346'}
};
const labelPositions={
 '新疆维吾尔自治区':[85,41],'西藏自治区':[88,31.3],'青海省':[96,35.5],'甘肃省':[102,38.3],
 '内蒙古自治区':[111.5,43.2],'黑龙江省':[128,48],'吉林省':[126.5,43.5],'辽宁省':[123,41],
 '北京市':[116.3,40.3],'天津市':[117.8,39.2],'河北省':[115.2,38.5],'山西省':[112,37.4],
 '宁夏回族自治区':[106,37.4],'陕西省':[108.7,35.5],'山东省':[118.5,36.4],'河南省':[113.6,33.8],
 '江苏省':[119.6,33],'安徽省':[117,31.8],'上海市':[121.8,31.2],'浙江省':[120,28.6],
 '福建省':[118,26],'江西省':[115.5,27.5],'湖北省':[112.2,30.8],'湖南省':[111.7,27.2],
 '四川省':[102.3,30.5],'重庆市':[107.8,29.8],'贵州省':[106.7,26.4],'云南省':[101,24.5],
 '广西壮族自治区':[108.5,23.8],'广东省':[113.5,24],'海南省':[109.5,19.2],
 '台湾省':[121,23.7],'香港特别行政区':[114.2,22.2],'澳门特别行政区':[113.5,22.2]
};

const lineIds=['province-boundaries','province-reference-lines','province-labels'];
const vectorIds=['ocean','land','coast','province-land','lakes','rivers'];
function paint(map,mode){
 const p=palettes[mode],sat=mode==='satellite';
 vectorIds.forEach(id=>map.setLayoutProperty(id,'visibility',sat?'none':'visible'));
 map.setLayoutProperty('earth','visibility',sat?'visible':'none');
 if(!sat){map.setPaintProperty('ocean','background-color',p.ocean);map.setPaintProperty('land','fill-color',p.land);map.setPaintProperty('province-land','fill-color',p.land);map.setPaintProperty('coast','line-color',p.coast);map.setPaintProperty('lakes','fill-color',p.ocean);map.setPaintProperty('rivers','line-color',p.river);}
 ['province-boundaries','province-reference-lines'].forEach(id=>map.setPaintProperty(id,'line-color',p.province));
 map.setLayoutProperty('province-labels','icon-image',['case',['has','project'],'project-space',['concat',mode+'-', ['get','gb']]]);
 map.setSky({'atmosphere-blend':sat?.55:.38,'sky-color':'#071827','horizon-color':'#8ebfef','fog-color':'#294762','fog-ground-blend':.1,'horizon-fog-blend':.5});

}
function provinceVisibility(map,on){lineIds.forEach(id=>map.setLayoutProperty(id,'visibility',on?'visible':'none'));}
export async function installLayers(map,signal){
 const [provinces,land,lakes,rivers]=await loadGlobeGeometry();signal.throwIfAborted();
 map.addSource('land',{type:'geojson',data:land});
 map.addSource('lakes',{type:'geojson',data:lakes});
 map.addSource('rivers',{type:'geojson',data:rivers});
 map.addSource('provinces',{type:'geojson',data:provinces});
 map.addLayer({id:'ocean',type:'background',paint:{'background-color':palettes.dark.ocean}});
 map.addLayer({id:'land',type:'fill',source:'land',paint:{'fill-color':palettes.dark.land}});
 map.addLayer({id:'coast',type:'line',source:'land',paint:{'line-color':palettes.dark.coast,'line-width':.65}});
 map.addLayer({id:'province-land',type:'fill',source:'provinces',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':palettes.dark.land}});
 map.addLayer({id:'lakes',type:'fill',source:'lakes',paint:{'fill-color':palettes.dark.ocean}});
 map.addLayer({id:'rivers',type:'line',source:'rivers',paint:{'line-color':palettes.dark.river,'line-width':['interpolate',['linear'],['zoom'],1,.5,4,1.3],'line-opacity':.7}});
 map.addLayer({id:'province-boundaries',type:'line',source:'provinces',filter:['==',['geometry-type'],'Polygon'],paint:{'line-color':palettes.dark.province,'line-width':['interpolate',['linear'],['zoom'],1,.65,4,1.4],'line-opacity':.65}});
 map.addLayer({id:'province-reference-lines',type:'line',source:'provinces',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':palettes.dark.province,'line-width':1,'line-opacity':.65}});
 await document.fonts.ready;signal.throwIfAborted();
 const labels=provinces.features.filter(f=>labelPositions[f.properties.name]).map(f=>{
  const {name,gb}=f.properties;const short=name.replace(/维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市/g,'');
  for(const [mode,p] of Object.entries(palettes)){
   const c=document.createElement('canvas');const ctx=c.getContext('2d');c.width=short.length*28+16;c.height=48;ctx.font='28px Astra PingFang, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=5;ctx.strokeStyle=p.halo;ctx.strokeText(short,c.width/2,24);ctx.fillStyle=p.label;ctx.fillText(short,c.width/2,24);map.addImage(mode+'-'+gb,ctx.getImageData(0,0,c.width,c.height),{pixelRatio:2});
  }
  return {type:'Feature',properties:{gb,name},geometry:{type:'Point',coordinates:labelPositions[name]}};
 });
 // Reserve the same screen area as each HTML project marker before placing province names.
 map.addImage('project-space',{width:64,height:64,data:new Uint8Array(64*64*4)},{pixelRatio:2});
 const reservations=[].map(pos=>({type:'Feature',properties:{project:true,rank:-1},geometry:{type:'Point',coordinates:pos}}));
 map.addSource('province-label-data',{type:'geojson',data:{type:'FeatureCollection',features:[...reservations,...labels]}});
 map.addLayer({id:'province-labels',type:'symbol',source:'province-label-data',minzoom:1.25,layout:{'icon-image':['case',['has','project'],'project-space',['concat','dark-',['get','gb']]],'symbol-sort-key':['coalesce',['get','rank'],1],'icon-allow-overlap':false,'icon-padding':5,'icon-rotation-alignment':'viewport'}});
 paint(map,'dark');
 return {
   paint:mode=>paint(map,mode),
   provinces:on=>provinceVisibility(map,on),
   reserve:points=>map.getSource('province-label-data').setData({type:'FeatureCollection',features:[...points.map(pos=>({type:'Feature',properties:{project:true,rank:-1},geometry:{type:'Point',coordinates:pos}})),...labels]})
 };
}
