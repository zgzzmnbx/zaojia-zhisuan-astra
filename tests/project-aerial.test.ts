import test from 'node:test';
import assert from 'node:assert/strict';
import {aerialCoordinates,aerialCorridors} from '../03-Src/professional/components/project-spatial-map/aerialGeometry.ts';
import {DEMO_MAP_ITEMS} from '../03-Src/professional/components/project-spatial-map/projectSpatialMapUtils.ts';
import {globeColumns,globeProjectScale} from '../03-Src/professional/components/project-spatial-map/globe-columns.ts';
import {pickGlobeColumn} from '../03-Src/professional/components/project-spatial-map/globe-column-picking.ts';

test('globe column picking includes elevated tops and ignores the far hemisphere',()=>{
  const sample=DEMO_MAP_ITEMS[0];
  const front={...sample,places:[{...sample.places[0],longitude:0,latitude:0}]};
  const data=globeColumns([front]).data;
  const projection={mainMatrix:[1,0,0,0,0,1,0,0,0,0,-.2,0,0,0,0,1],clippingPlane:[0,0,1,-.2],projectionTransition:1};
  assert.equal(pickGlobeColumn(data,projection,1000,1000,{x:506,y:500}),sample.project_id);
  assert.equal(pickGlobeColumn(data,projection,1000,1000,{x:520,y:500}),null);
  const back={...front,places:[{...front.places[0],longitude:180}]};
  assert.equal(pickGlobeColumn(globeColumns([back]).data,projection,1000,1000,{x:500,y:500}),null);
  assert.equal(pickGlobeColumn(data,null,1000,1000,{x:500,y:500}),null);
});

test('column heights use a shared zero-based linear scale and one anchor per project',()=>{
  const items=DEMO_MAP_ITEMS.slice(0,3).map((item,index)=>({...item,is_demo:false,artifact_summary:{artifact_count:1,input_rows:[100,200,0][index],matched_rows:0,experience_hint_rows:0,review_rows:0}}));
  const before=JSON.stringify(items);const result=globeColumns(items,'square');
  assert.equal(result.entries.length,3);assert.equal(result.data.features.length,2);assert.equal(result.max,200);
  assert.equal(result.data.features[1].properties.height,2*result.data.features[0].properties.height);
  assert.equal(result.data.features[0].geometry.coordinates[0].length,5);
  assert.equal(result.data.features.filter(feature=>feature.id===items[1].project_id).length,1);
  assert.deepEqual(result.entries[1].center,aerialCoordinates(items[1])[0]);assert.equal(JSON.stringify(items),before);
});

test('round, hexagonal and square columns preserve the same project and value scale',()=>{
  const results=(['round','hex','square'] as const).map(shape=>globeColumns(DEMO_MAP_ITEMS,shape));
  assert.deepEqual(results.map(result=>result.data.features[0].geometry.coordinates[0].length),[25,7,5]);
  assert.deepEqual(results.map(result=>result.data.features.map(f=>f.properties)),[results[0].data.features.map(f=>f.properties),results[0].data.features.map(f=>f.properties),results[0].data.features.map(f=>f.properties)]);
});
test('illustrative scales never cross into real projects and missing values are not zero',()=>{
  const demo=DEMO_MAP_ITEMS[0];assert.deepEqual(globeProjectScale(demo),{value:320,illustrative:true});
  const real={...demo,is_demo:false};assert.deepEqual(globeProjectScale(real),{value:null,illustrative:false});
  for(const input_rows of [null,NaN,Infinity,-1,'100',1.5]){
    const item={...real,artifact_summary:{input_rows} as never};assert.equal(globeProjectScale(item).value,null);
  }
  const result=globeColumns([real,{...real,map_ready:false}]);assert.equal(result.entries.length,1);assert.equal(result.missing,1);assert.equal(result.data.features.length,0);
  assert.deepEqual(globeColumns([]).data.features,[]);
});

test('aerial locations exclude unconfirmed, missing and incompatible coordinates',()=>{
  const sample=DEMO_MAP_ITEMS[0];
  assert.equal(aerialCoordinates(sample).length,1);
  assert.deepEqual(aerialCoordinates({...sample,is_demo:false,recognition_status:'proposed'}),[]);
  assert.deepEqual(aerialCoordinates({...sample,map_ready:false}),[]);
  for(const place of [{...sample.places[0],longitude:NaN},{...sample.places[0],latitude:91},{...sample.places[0],longitude:null as unknown as number},{...sample.places[0],coordinate_system:'GCJ02'}]){
    assert.deepEqual(aerialCoordinates({...sample,places:[place]}),[]);
  }
});
test('corridors follow confirmed sequence without changing source data or inventing endpoints',()=>{
  const corridor=DEMO_MAP_ITEMS.find(item=>item.spatial_type==='CORRIDOR')!;
  const unordered={...corridor,places:[...corridor.places].reverse()};
  const before=JSON.stringify(unordered);
  const features=aerialCorridors([unordered,DEMO_MAP_ITEMS[0],{...corridor,places:[corridor.places[0]]}]).features;
  assert.equal(features.length,1);
  assert.deepEqual(features[0].geometry.coordinates,aerialCoordinates(corridor));
  assert.equal(JSON.stringify(unordered),before);
  assert.equal(aerialCorridors([]).features.length,0);
});
