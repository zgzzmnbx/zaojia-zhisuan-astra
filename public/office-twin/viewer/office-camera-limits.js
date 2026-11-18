export function officeCameraLimits(view){
  const front=view!=='building'?Math.atan2(.9,1.25):Math.atan2(1.1,1.5);
  return {minAzimuthAngle:front-Math.PI/4,maxAzimuthAngle:front+Math.PI/4,minPolarAngle:Math.PI/36,maxPolarAngle:70*Math.PI/180};
}
// Choose a complete 30-degree arc that fits inside the front-facing bounds.
export function officeSweepDirection(azimuth,limits){return azimuth-limits.minAzimuthAngle>=Math.PI/6?1:-1;}
