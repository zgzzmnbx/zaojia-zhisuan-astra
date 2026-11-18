"""Street furniture, parked vehicles and the two independently movable cars, in metres."""
import math

import numpy as np

from geometry import Batch


PAVEMENT = -.41
# x, z and bearing of each lantern arm, beside the two squares and connecting drives.
LAMPS = [
    (-23,25,0), (24,21,180), (-24,-22,-90), (24,-25,90),
    (-14,32.3,90), (34,12,0), (-40,29,0), (11,31.0,90), (31.2,-4.5,0),
    (49,-17.8,90), (78,-17.8,90), (90,-33,0), (90,24,0), (45.8,22,180),
]
# The moving vehicles follow the two lanes of the southern boulevard.
TRAFFIC = [('saloon', -13.4,35.6,'porcelain'), ('hatch', 14.8,35.6,'fabric')]
PARKING = [
    ('estate', 35.0,-5.2,-90,'stone'),
    ('hatch', -35.0,-8.4,90,'metal'),
    ('saloon', 110.6,-29.9,90,'ultra'),
]
# length, width, roof height, rear sill, rear roof edge, front roof edge, front sill
PROFILES = {
    'saloon': (4.64,1.85,1.46,-.68,-.42,.19,.53),
    'hatch':  (4.04,1.77,1.54,-.87,-.68,.10,.55),
    'estate': (4.76,1.89,1.55,-.87,-.72,.22,.56),
}


class PlacedBatch(Batch):
    """Apply the bearing before daylight shading and append to a shared material batch."""
    def __init__(self, target, x, z, bearing):
        self.target = target
        self.origin = np.array([x,PAVEMENT,z])
        angle = math.radians(bearing)
        co,si = math.cos(angle), math.sin(angle)
        self.rotation = np.array([[co,0,si],[0,1,0],[-si,0,co]])

    def world(self, points):
        return np.asarray(points) @ self.rotation + self.origin

    def face(self, vertices, pigment, gain=1., normals=None):
        normals = None if normals is None else np.asarray(normals) @ self.rotation
        self.target.face(self.world(vertices),pigment,gain,normals)


def lantern(surface, lens):
    surface.tube((0,.01,0),(0,.12,0),.19,.16,'metal',8)
    surface.tube((0,.10,0),(0,.67,0),.115,.092,'lamp_metal',8)
    surface.tube((0,.65,0),(0,4.18,0),.092,.054,'lamp_metal',8)
    surface.tube((0,4.15,0),(.16,4.37,0),.065,.051,'lamp_metal',8)
    surface.tube((.14,4.36,0),(1.00,4.46,0),.052,.042,'lamp_metal',8)
    surface.box(1.10,4.35,0,.80,.15,.31,'lamp_metal',.045,.10)
    # The recessed diffuser is visible from below and as a fine edge from above.
    lens.box(1.13,4.29,0,.66,.075,.25,'linen',.016,.07)


def coachwork(batch, half_length, half_width, axles, radius, paint):
    # Side sills follow the tyre openings. The longitudinal sections also taper
    # the bumpers in plan, keeping a rounded nose and shoulders at small scale.
    stations = {-1.,-.95,-.86,-.30,.18,.77,.92,.98,1.}
    clearance = radius+.035
    for axle in axles:
        for angle in np.linspace(0,math.pi,7):
            stations.add((axle+clearance*math.cos(angle))/half_length)
    rings = []
    for t in sorted(stations):
        x = t*half_length
        bottom = .29
        for axle in axles:
            gap = clearance**2-(x-axle)**2
            if gap >= -1e-8:
                bottom = max(bottom,radius+math.sqrt(max(0,gap)))
        w = half_width*np.interp(t,[-1,-.94,-.78,.72,.93,1],[.70,.91,1,1,.92,.68])
        belt = np.interp(t,[-1,-.86,-.42,.4,.79,1],[.72,.84,.91,.88,.79,.64])
        low = min(bottom,belt-.07)
        rings.append([(x,low,-w*.90),(x,low+.035,-w*.99),(x,belt-.065,-w),
                      (x,belt,-w*.89),(x,belt+.025,0),(x,belt,w*.89),
                      (x,belt-.065,w),(x,low+.035,w*.99),(x,low,w*.90)])
    batch.face(rings[0][::-1],paint)
    for rear,front in zip(rings,rings[1:]):
        for i in range(len(rear)):
            j = (i+1)%len(rear)
            batch.face([rear[i],rear[j],front[j],front[i]],paint)
    batch.face(rings[-1],paint)


def cabin(batch, half_length, half_width, profile, paint):
    _,_,height,rear_sill,rear_roof,front_roof,front_sill = profile
    w = half_width*.89
    base = .86
    # Sections run from rear window to windscreen, with a narrow painted roof lip.
    def glazing_point(u, top, side):
        if top:
            x=(rear_roof+(front_roof-rear_roof)*u)*half_length
            return np.array([x,height-.065,side*w*.83])
        x=(rear_sill+(front_sill-rear_sill)*u)*half_length
        return np.array([x,base,side*w])

    for side in (-1,1):
        for lo,hi,pigment in [(0,.046,paint),(.046,.46,'auto_glass'),(.46,.507,'lamp_metal'),
                              (.507,.95,'auto_glass'),(.95,1,paint)]:
            p=[glazing_point(lo,False,side),glazing_point(lo,True,side),
               glazing_point(hi,True,side),glazing_point(hi,False,side)]
            gain=[.75,1.28,1.30,.76] if pigment=='auto_glass' else [1]*4
            batch.face(p if side<0 else p[::-1],pigment,gain if side<0 else gain[::-1])
        batch.box(half_length*.32,.93,side*(half_width+.034),.19,.095,.14,paint,.028)
        for t in (-.43,.006):
            batch.box(t*half_length,.785,side*(half_width-.014),.15,.027,.035,'metal')
    for u in (0,1):
        p=[glazing_point(u,False,-1),glazing_point(u,False,1),
           glazing_point(u,True,1),glazing_point(u,True,-1)]
        gain=np.array([.83,.83,1.31,1.31])*(1.18 if u else .9)
        batch.face(p if u==0 else p[::-1],'auto_glass',gain if u==0 else gain[::-1])
    back=[glazing_point(0,True,-1),glazing_point(0,True,1)]
    front=[glazing_point(1,True,-1),glazing_point(1,True,1)]
    br=back[0][0];fr=front[0][0]
    top_back=[(br+.045,height,-w*.72),(br+.045,height,w*.72)]
    top_front=[(fr-.065,height,-w*.72),(fr-.065,height,w*.72)]
    batch.face([top_back[0],top_back[1],top_front[1],top_front[0]],paint)
    batch.face([back[0],back[1],top_back[1],top_back[0]],paint)
    batch.face([top_front[0],top_front[1],front[1],front[0]],paint)
    for side in (0,1):
        p=[back[side],top_back[side],top_front[side],front[side]]
        batch.face(p if side==0 else p[::-1],paint)


def wheel(batch,x,width,radius,side):
    # The tyre and inset hub share the same polygon rings, with no hidden caps.
    angle=np.linspace(0,side*math.tau,13,endpoint=False)
    rays=np.column_stack([np.cos(angle),np.sin(angle),np.zeros(len(angle))])
    def ring(scale,offset):
        return np.array([x,radius,side*(width+offset)])+rays*(radius*scale)
    inner,edge,rim,hub=ring(1,-.20),ring(1,-.014),ring(.92,.012),ring(.55,.011)
    batch.face(inner[::-1],'tyre')
    for i in range(len(angle)):
        j=(i+1)%len(angle)
        batch.face([inner[i],inner[j],edge[j],edge[i]],'tyre',1,[rays[i],rays[j],rays[j],rays[i]])
        for outer,inside in [(edge,rim),(rim,hub)]:
            batch.face([outer[i],outer[j],inside[j],inside[i]],'tyre')
    batch.face(hub,'metal')


def car(batch, kind, paint):
    profile=PROFILES[kind]
    length,width=profile[:2]
    h,w=length*.5,width*.5
    r=.311 if kind=='hatch' else .333
    axles=(-h*.605,h*.61)
    batch.box(0,.245,0,length*.80,.15,width*.67,'tyre')
    coachwork(batch,h,w,axles,r,paint)
    cabin(batch,h,w,profile,paint)
    for x in axles:
        for side in (-1,1):
            wheel(batch,x,w,r,side)
    for side in (-1,1):
        # Parked cars have reflective lamp covers and no running headlights.
        batch.box(h*.972,.575,side*w*.53,.14,.071,w*.46,'ice',.019)
        batch.box(-h*.977,.627,side*w*.50,.11,.084,w*.47,'tail_lens',.017)
    batch.box(h*.995,.395,0,.036,.088,w*.89,'tyre')


def place_streetscape(kit, ground, out, parent):
    surface=kit.parts['street_surface']
    lenses=kit.parts['street_lens']
    pools=[]
    for x,z,bearing in LAMPS:
        body=PlacedBatch(surface,x,z,bearing)
        lantern(body,PlacedBatch(lenses,x,z,bearing))
        # Pavement illumination is slightly asymmetric in the direction of the arm.
        centre=body.world([1.65,0,0])
        rx,rz=(4.5,5.6) if bearing%180==0 else (5.6,4.5)
        pools.append([round(centre[0],3),round(centre[2],3),rx,rz])
        ground.block(x,z,.18,.18,4.45+PAVEMENT)
    footprints=[]
    for kind,x,z,paint in TRAFFIC:
        moving=Batch()
        car(moving,kind,paint)
        index=moving.emit(out,parent,'Porcelain_Traffic_'+kind,'street_surface',out.material('Porcelain_street_surface'))
        node=out.doc['nodes'][index]
        node['translation']=[x,PAVEMENT,z]
        length,width=PROFILES[kind][:2]
        node['extras']['trafficVehicle']={'halfSize':[length/2,width/2]}
    for kind,x,z,bearing,paint in PARKING:
        batch=PlacedBatch(surface,x,z,bearing)
        car(batch,kind,paint)
        length,width,height=PROFILES[kind][:3]
        hull=batch.world([[-length*.42,height,-width*.45],[-length*.42,height,width*.45],
                          [length*.42,height,width*.45],[length*.42,height,-width*.45]])
        ground.caster(hull,PAVEMENT)
        half_x,half_z=(width/2,length/2) if bearing%180 else (length/2,width/2)
        footprints.append([x,z,half_x,half_z])
    return {'streetLightPools':pools,'parkedCarFootprints':footprints}
