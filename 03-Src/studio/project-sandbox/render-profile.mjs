// Enhanced daytime only. Intensities and color channels are linear, not CSS values.
export const dayProfile=Object.freeze({
 sunPosition:[18,27,23],sun:3.8,fill:.12,hemisphere:.04,environment:1.05,
 exposure:1.08,gi:.42,backgroundWhiteMix:.72,shadowIntensity:.85,normalBias:.025,shadowBias:-.0003,shadowRadius:1.2,shadowSize:2048,shadowAngularRadius:.10,
 surfaces:{
  'Warm plaster':{roughness:.76,normal:.030},
  'Porcelain white':{roughness:.66,normal:.025},
  'Limestone foundation':{normal:.025},
  'coated-tank':{roughness:.26,metalness:.12,normal:0,environment:1.5},
  'coated-pipe':{roughness:.30,metalness:.08,normal:0,environment:1.35},
 },
});
