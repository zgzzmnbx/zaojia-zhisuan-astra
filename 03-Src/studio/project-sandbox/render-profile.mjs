// Enhanced daytime only. Intensities and color channels are linear, not CSS values.
export const dayProfile=Object.freeze({
 sunPosition:[-18,28,20],sun:4.2,fill:.18,hemisphere:.06,environment:.26,
 exposure:1.03,gi:.62,backgroundWhiteMix:.42,shadowIntensity:.72,normalBias:.035,shadowBias:-.00045,shadowRadius:1.2,shadowSize:2048,
 surfaces:{
  'Warm plaster':{roughness:.76,normal:.030},
  'Porcelain white':{roughness:.66,normal:.025},
  'Limestone foundation':{normal:.025},
  'coated-tank':{roughness:.34,metalness:0,normal:0},
  'coated-pipe':{roughness:.42,metalness:0,normal:0},
 },
});
