export function surfaceIdentity(material){
 return {baseName:material.userData?.astraBaseMaterial??material.name,role:material.userData?.astraSurfaceRole??'base'};
}
