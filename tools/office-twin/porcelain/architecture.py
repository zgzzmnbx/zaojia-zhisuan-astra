"""Twenty separable storeys, a civic entry, rooftop plant and a miniature campus."""
import math
import random
from collections import defaultdict

import numpy as np

from brand import mount_eave_letters
from campus_plan import H3_X, H3_Z, PAVILIONS, paving
from geometry import Batch
from receivers import Receiver
from streetscape import place_streetscape


class Kit:
    def __init__(self):
        self.parts=defaultdict(Batch)

    def finish(self,out,parent,prefix):
        for role,batch in self.parts.items():
            batch.emit(out,parent,prefix+'_'+role,role,out.material('Porcelain_'+role))


def strip(batch,side,offset,y,length,height,depth,pigment,edge=20.9,bevel=0):
    """A facade module measured on the tangent of any of the four elevations."""
    if side in (0,2):
        batch.box(offset,y,edge*(1 if side==0 else -1),length,height,depth,pigment,bevel)
    else:
        batch.box(edge*(1 if side==1 else -1),y,offset,depth,height,length,pigment,bevel)


def storey(out,parent,n,height):
    kit=Kit()
    wall,glass,accent=kit.parts['shell'],kit.parts['window'],kit.parts['accent']
    # The upper two floors are a recessed lantern; both middle wings are
    # articulated by a continuous solid pier instead of four identical fronts.
    inset=1.25 if n>=19 else .58 if n>=16 else 0
    edge=20.62-inset
    width=2*edge
    podium=n<=2
    wall.box(0,0,0,width+.47,.42,width+.47,'porcelain',.065,.72)
    wall.box(0,.39,0,width-.44,height-.48,width-.44,'chalk',.05,.55)
    wall.box(0,height-.31,0,width+.25,.31,width+.25,'porcelain',.045,.65)
    for side in range(4):
        areas=([(-13.25,8.5),(.9,11.5),(13.3,6.9)] if side%2==0
               else [(-13.5,7.8),(-2.7,10.2),(11.1,12.2)])
        wy=.99 if not podium else .58
        wh=(1.22 if n<19 else 1.52) if not podium else height-1.08
        if n in (8,14): wh+=.26
        for ci,(cx,length) in enumerate(areas):
            if podium and side==0 and ci==1: continue
            length-=inset*.7
            strip(wall,side,cx,wy-.065,length+.27,wh+.15,.12,'reveal',edge-.13)
            # Inset cobalt glazing, head shadow, sill and widely spaced mullions.
            strip(glass,side,cx,wy,length,wh,.14,'ice' if n in (1,2,19,20) else 'glass',edge-.075)
            strip(glass,side,cx,wy+wh-.18,length,.18,.15,'fabric',edge-.06)
            strip(wall,side,cx,wy-.13,length+.39,.105,.37,'porcelain',edge-.01)
            for f in ([.25,.5,.75] if podium else [1/3,2/3]):
                strip(wall,side,cx+length*(f-.5),wy,.095,wh,.18,'stone',edge-.02)
        # High white fins catch a narrow highlight; the inset at 9F belongs
        # solely to the removable facade and cannot obscure the floor plan.
        # The entrance fascia spans this bay. Vertical fins end on adjacent
        # floors, leaving the full front of the sign and both ends clear.
        if n!=2 or side!=0:
            for x in ([-7.9,8.2] if side%2==0 else [-8.8,4.0]):
                strip(wall,side,x,.42,.37,height-.48,.48,'porcelain',edge+.02,.035)
        if 3<=n<=18:
            for x in (-.40,.40):
                strip(wall,side,-19.05+inset+x,.43,.14,height-.55,.25,'stone',edge-.015)
        if n in (2,8,14,18):
            strip(wall,side,0,height-.34,width+.9,.22,.94,'porcelain',edge+.10,.055)
    if n==9:
        strip(accent,0,8.7,.24,14,.12,.19,'cobalt',edge+.26)
    if n==1:
        # Suspended entry blade, twelve inset glass door panels and solid jambs.
        for dx in (-8.3,8.3):
            wall.box(dx,0,23.55,.38,4.45,.40,'metal',.035)
        wall.box(0,4.42,23.15,18.6,.33,6.5,'porcelain',.10,.42)
        accent.box(0,4.30,23.28,18.12,.13,6.05,'cobalt',.035,.24)
        for i in range(8):
            glass.box(-6.38+i*1.82,.27,20.62,1.71,3.62,.12,'ice')
        for i in range(3):
            wall.box(0,-.29+i*.12,23.75-i*.37,19.7-i*.52,.12,6.4-i*.35,'chalk',.02)
    kit.finish(out,parent,f'Porcelain_F{n:02}')


def rooftop(out,parent,top,source,emblem):
    kit=Kit(); wall,blue=kit.parts['shell'],kit.parts['accent']
    roof=Receiver(22,512,'roof')
    # Surveyed rooms end at 9F; all equipment on this independent roof is illustrative.
    deck=Batch();finish=top+.075
    deck.face([(-19.5,finish,-19.5),(-19.5,finish,19.5),(19.5,finish,19.5),(19.5,finish,-19.5)],'porcelain')
    deck.col=[np.ones(3) for _ in deck.pos]
    for side in range(4):
        strip(wall,side,0,top,39.1,.58,.28,'porcelain',19.49,.05)
    mount_eave_letters(out,parent,source,emblem,top,wall,roof)
    wall.box(-7,top,-4,14.2,4.2,9.2,'chalk',.16,.55)
    wall.box(-7,top+4.17,-4,14.8,.28,9.8,'porcelain',.08,.58)
    roof.block(-7,-4,14.75,9.8,4.47)
    for i in range(15):
        wall.box(-13.35+i*.9,top+.35,.64,.24,3.2,.24,'joint')
    for x,z in [(5,-8),(12,-8),(5,-1),(12,-1)]:
        blue.box(x,top,z,4.5,.30,4.4,'cobalt',.045)
        wall.box(x,top+.28,z,4.22,1.46,4.14,'porcelain',.09,.23)
        roof.block(x,z,4.5,4.4,1.85)
        for off in (-.93,.93):
            wall.tube((x+off,top+1.74,z),(x+off,top+1.91,z),.68,.68,'stone',20)
            for slat in (-.34,0,.34):
                wall.box(x+off+slat,top+1.91,z,.065,.055,1.06,'chalk')
    for x in (-10.7,-7.6,-4.5):
        wall.tube((x,top+4.4,-4),(x,top+5.55,-4),.61,.60,'metal',24)
        wall.tube((x,top+5.5,-4),(x,top+5.70,-4),.81,.81,'porcelain',24)
    for z in (5.7,6.35):
        wall.tube((-14,top+.46,z),(11,top+.46,z),.17,.17,'metal',12)
        for x in [-12,-5,2,9]:
            wall.box(x,top,z,.28,.32,.74,'stone')
    kit.finish(out,parent,'Porcelain_Roof')
    tex=out.texture('Roof / daylight',roof.image())
    deck.emit(out,parent,'Porcelain_Roof_Court','shell',out.material('Roof Court',tex),roof.uv)


def tree(batch,x,z,height,seed,receiver):
    rng=random.Random(seed)
    trunk=height*.48
    batch.tube((x,.05,z),(x,trunk,z),height*.028,height*.018,'metal',8)
    # Off-axis secondary branches and several overlapping irregular lobes give
    # each crown a distinct silhouette at walking and architectural scale.
    centers=[(0,0,.69,.27)]
    for i in range(5):
        angle=i*math.tau/5+rng.uniform(-.23,.23)
        ox,oz=math.cos(angle)*.16,math.sin(angle)*.16
        centers.append((ox,oz,rng.uniform(.55,.73),rng.uniform(.17,.24)))
        batch.tube((x,trunk*.64,z),(x+ox*height,height*.65,z+oz*height),height*.013,.035,'metal',7)
    for ox,oz,cy,r in centers:
        loc=np.array([x+ox*height,cy*height,z+oz*height])
        rings=[]; normals=[]
        for j in range(7):
            phi=-math.pi/2+j*math.pi/6
            row=[]; ns=[]
            for i in range(12):
                a=i*math.tau/12+(j%2)*.12
                n=np.array([math.cos(phi)*math.cos(a),math.sin(phi),math.cos(phi)*math.sin(a)])
                jitter=1+.105*math.sin(a*4+phi*7+seed)+rng.uniform(-.035,.035)
                row.append(loc+n*[r*height,r*height*1.18,r*height]*np.array(jitter));ns.append(n)
            rings.append(row);normals.append(ns)
        for j in range(6):
            for i in range(12):
                k=(i+1)%12
                p=[rings[j][i],rings[j+1][i],rings[j+1][k],rings[j][k]]
                ns=[normals[j][i],normals[j+1][i],normals[j+1][k],normals[j][k]]
                batch.face(p,'leaf',rng.uniform(.84,1.16),ns)
        # Small sprays break the large lobes at the silhouette without cards
        # or alpha sorting. Retain coherent skylight across each little cluster.
        for j in range(11):
            angle=j*2.39996+rng.uniform(-.26,.26)
            up=rng.uniform(-.55,.88);side=math.sqrt(1-up*up)
            normal=np.array([side*math.cos(angle),up,side*math.sin(angle)])
            tip=loc+normal*[r*height,r*height*1.18,r*height]
            size=rng.uniform(.11,.22)*r*height
            rim=[tip+size*np.array([math.cos(a),-.10,math.sin(a)]) for a in np.arange(5)*math.tau/5]
            for k in range(5):
                pigment='bud' if (j+k)%6==0 else 'leaf'
                batch.face([rim[k],tip+[0,size,0],rim[(k+1)%5]],pigment,rng.uniform(.89,1.17))
                batch.face([rim[(k+1)%5],tip-[0,size*.8,0],rim[k]],'leaf',.84)
    receiver.canopy(x,z,height)


def pavilion(wall,windows,x,z,w,d,h,kind,receiver,roof_shade,roof_vertices):
    wall.box(x,-.4,z,w+.8,.78,d+.8,'stone',.12,.55)
    wall.box(x,.38,z,w,h-.38,d,'chalk',.16,.48)
    cap_start=len(wall.pos)
    wall.box(x,h,z,w+.48,.31,d+.48,'porcelain',.085,.52)
    roof_vertices.extend(i for i in range(cap_start,len(wall.pos)) if wall.norm[i][1]>.999)
    receiver.block(x,z,w,d,h+.3)
    floor_count=2 if h>7 else 1
    for floor in range(floor_count):
        y=h-1.95-floor*3.25
        for side in (-1,1):
            for i in range(3):
                windows.box(x+w*(i-1)*.29,y,z+side*(d/2+.035),w*.237,.80,.085,'glass')
            for i in (-1,1):
                windows.box(x+side*(w/2+.03),y,z+i*d*.22,.085,.80,d*.29,'ice')
    if kind=='studio':
        # A low clerestory differentiates the two workshops from the plant rooms.
        roof_shade.block(x,z,w*.68,d*.24,1.65)
        windows.box(x,h+.32,z,w*.68,.93,d*.23,'ice',.04)
        wall.box(x,h+1.25,z,w*.71,.58,d*.26,'porcelain',.10)
        for offset in (-.24,0,.24):
            wall.box(x+w*offset,h+.32,z,.26,.94,d*.24,'chalk')
    elif kind=='utility':
        for off in (-.28,0,.28):
            wx=x+w*off
            roof_shade.cylinder(wx,z,1.56,2.94)
            wall.tube((wx,h+.3,z),(wx,h+3,z),1.56,1.32,'porcelain',24)
            wall.tube((wx,h+2.9,z),(wx,h+3.25,z),1.49,1.49,'stone',24)
            wall.tube((wx,h+3.245,z),(wx,h+3.26,z),1.13,1.13,'reveal',24)
        for dz in (-2.6,2.6):
            roof_shade.caster(np.array([[x+dx,.80,z+dz+dd] for dx in (-w*.4,w*.4) for dd in (-.26,.26)]))
            wall.tube((x-w*.4,h+.89,z+dz),(x+w*.4,h+.89,z+dz),.26,.26,'metal',12)
    else:
        for off in (-.22,.22):
            roof_shade.block(x+w*off,z,3.8,3.45,1.8)
            windows.box(x+w*off,h+.32,z,3.8,.3,3.45,'cobalt',.055)
            wall.box(x+w*off,h+.62,z,3.64,1.5,3.32,'porcelain',.09,.22)
            for slat in range(6):
                wall.box(x+w*off-1.26+slat*.5,h+2.12,z,.12,.08,2.61,'joint')


def pedestrian(wall,blue,x,z,angle,receiver):
    # Stationary scale figures belong to the site, separate from the editable
    # employees upstairs. Legs, torso and head share the two existing batches.
    def p(u,y,v): return (x+math.cos(angle)*u-math.sin(angle)*v,y-.39,z+math.sin(angle)*u+math.cos(angle)*v)
    for s in (-1,1):
        blue.tube(p(s*.087,.72,0),p(s*.12,.055,s*.14),.071,.045,'ink',7)
        wall.tube(p(s*.17,1.28,0),p(s*.23,.81,-s*.09),.056,.04,'linen',7)
    blue.tube(p(0,.70,0),p(0,1.31,0),.125,.176,'cobalt',10)
    wall.tube(p(0,1.34,0),p(0,1.57,0),.09,.12,'chalk',10)
    blue.tube(p(0,1.55,0),p(0,1.62,0),.121,.086,'ink',10)
    receiver.block(x,z,.34,.28,1.23)


def plant_court(wall,blue,ground):
    # A service court with two vessels, bent process lines and an open gantry.
    # Its exposed frame gives the foreground a finer scale than the office tower.
    x,z=83,8
    wall.box(x,-.40,z,15.4,.37,11.2,'chalk',.07,.26)
    for ox,h,r in [(-3.6,7.5,1.30),(1.1,5.7,1.55)]:
        xx=x+ox
        wall.tube((xx,.0,z),(xx,.6,z),r+1,r+.55,'stone',24)
        wall.tube((xx,.6,z),(xx,2.5,z),r+.52,r,'chalk',24)
        wall.tube((xx,2.5,z),(xx,h,z),r,r*.70,'porcelain',32)
        for y in [2.55,h-.80,h-.12]:
            factor=(1-(y-2.5)/(h-2.5)*.30)*r
            wall.tube((xx,y,z),(xx,y+.13,z),factor+.13,factor+.13,'metal',24)
        wall.tube((xx,h,z),(xx,h+.08,z),r*.55,r*.55,'reveal',20)
        ground.block(xx,z,2*r,2*r,h)
    for dz in (-3.9,3.9):
        for dx in (-6.5,-2.2,2.2,6.5):
            wall.box(x+dx,0,z+dz,.15,3.08,.15,'metal')
        wall.box(x,2.85,z+dz,13.4,.14,.17,'chalk')
        for dx in (-4.35,0,4.35):
            wall.tube((x+dx-2.10,.12,z+dz),(x+dx+2.10,2.85,z+dz),.055,.055,'metal',7)
    for dz in (-2.7,-1.95,2.7):
        wall.tube((x-6.5,3.25,z+dz),(x+5.9,3.25,z+dz),.16,.16,'metal',12)
        wall.tube((x+5.9,.0,z+dz),(x+5.9,3.25,z+dz),.155,.155,'chalk',12)
        for dx in (-4,0,4):
            blue.tube((x+dx,3.25,z+dz),(x+dx+.12,3.25,z+dz),.19,.19,'fabric',12)
    for dx in (-6.5,-2.2,2.2,6.5):
        wall.box(x+dx,2.98,z,.14,.13,8.0,'metal')


def campus(out,parent):
    kit=Kit(); wall=kit.parts['context']; blue=kit.parts['accent']
    ground=Receiver(140,1536,'site')
    ground.block(0,0,42,42,76)
    ground.block(H3_X,H3_Z,42,42,76)
    base=Batch()
    base.face([(-460,-.41,-460),(-460,-.41,460),(460,-.41,460),(460,-.41,-460)],'porcelain')
    base.col=[np.ones(3) for _ in base.pos]
    # A sunken joint and curb define the central civic square without blocking
    # the ground's continuous daylight bake.
    for side in range(4):
        if side==0:
            for offset in (-21,21):strip(wall,side,offset,-.405,23,.16,.28,'stone',32.3,.025)
        else:
            strip(wall,side,0,-.405,65,.16,.28,'stone',32.3,.025)
    roof_shade=Receiver(140,1024,'plant')
    roof_vertices=[]
    for args in PAVILIONS: pavilion(wall,blue,*args,ground,roof_shade,roof_vertices)
    plant_court(wall,blue,ground)
    for i,(x,z) in enumerate([(-6,26),(4,27),(8,32),(-18,21),(25,6),(-34,15),(33,-3),(-10,46),(34,20),(-2,-30),
                              (61,-20),(67,-19),(73,-22)]):
        pedestrian(wall,blue,x,z,i*.91,ground)
    # Cobalt silk-finish trees line the approaches, with clear pavement at the entry.
    points=[(-27,-25),(-27,-13),(-27,3),(-27,19),(-24,28),(-12,29),(14,29),(25,28),
            (28,12),(28,-2),(28,-17),(-58,20),(-43,27),(47,8),(51,14),
            (20,49),(-18,48),(-37,-35),(26,-43),(-4,-37),(7,-37),(64,-2),(-65,-30),
            (48,-22),(79,-21),(88,-29),(88,-47),(88,-63),(36,-45),(36,-63),
            (47,-74),(70,-74),(78,-3),(50,21),(76,27),(104,20),(105,-65),(18,-70)]
    vegetation=kit.parts['vegetation']
    for i,(x,z) in enumerate(points):
        h=4.05+(i*7%11)*.16
        wall.box(x,-.39,z,2.24,.42,2.24,'porcelain',.08,.2)
        wall.box(x,.03,z,1.78,.07,1.78,'joint',.025,.14)
        tree(vegetation,x,z,h,470+i,ground)
    for x,z in [(-18,24),(17,24),(-24,-2),(24,-12),(-41,22),(46,11),(-8,32),(51,-20),(76,-19)]:
        for dx in (-1.22,1.22):
            wall.box(x+dx,-.39,z,.24,.77,.86,'stone')
        for off in (-.26,0,.26):
            wall.box(x,.36,z+off,3.45,.15,.22,'chalk',.035)
        ground.block(x,z,3.45,.8,.55)
    out.doc['nodes'][parent]['extras'].update(place_streetscape(kit,ground,out,parent))
    # Only pavilion roof faces sample the equipment shadows. All
    # other vertices sample blank paper at the corner of the same atlas.
    def roof_uv(pos):
        uv=np.zeros((len(pos),2),dtype=np.float32)
        uv[roof_vertices]=roof_shade.uv(pos[roof_vertices])
        return uv
    mask=out.texture('Pavilions / equipment shadows',roof_shade.image())
    mat=out.material('Porcelain_context',mask,{'porcelainDayMap':True})
    kit.parts.pop('context').emit(out,parent,'Porcelain_Campus_context','context',mat,roof_uv)
    kit.finish(out,parent,'Porcelain_Campus')
    tex=out.texture('Campus drives and squares / daylight',ground.image(pavement=paving(ground)))
    base.emit(out,parent,'ContextWeb_RoadsBases_Porcelain','ground',out.material('Porcelain Paving',tex,{'porcelainRoadAtlas':True}),ground.uv)
