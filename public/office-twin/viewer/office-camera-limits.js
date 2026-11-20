export function officeCameraLimits(view){
  const front=view!=='building'?Math.atan2(.9,1.25):Math.atan2(1.1,1.5);
  return {minAzimuthAngle:front-Math.PI/4,maxAzimuthAngle:front+Math.PI/4,minPolarAngle:Math.PI/36,maxPolarAngle:70*Math.PI/180};
}
// Orthographic visible height is frameHeight / zoom. Keep the overview reachable
// when a room or a person gets a much smaller projection frame.
export function minimumOfficeZoom(frameHeight,overviewHeight){
  return .35 * Math.min(1, frameHeight / overviewHeight);
}
// Choose a complete 30-degree arc that fits inside the front-facing bounds.
export function officeSweepDirection(azimuth,limits){return azimuth-limits.minAzimuthAngle>=Math.PI/6?1:-1;}
