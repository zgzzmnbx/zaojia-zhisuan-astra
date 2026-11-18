"""Illustrative campus plan in metres. The surveyed H1 office uses its own coordinate system."""
import io

import cv2
import numpy as np
from PIL import Image

from geometry import Batch

H3_X, H3_Z = 64, -48

# Existing H1 neighbours and the pavilions around the second forecourt.
PAVILIONS = [
    (-49,-8,19,29,10,'office'), (65,9,20,13,7,'office'),
    (-10,-53,31,19,7,'office'), (12,60,20,11,4,'office'),
    (-56,59,22,14,6,'utility'), (52,65,19,16,7,'office'),
    (-58,-52,20,15,8,'office'), (111,-83,22,15,6,'office'),
    (15,-88,25,15,7,'studio'), (65,-91,29,13,8,'office'),
    (116,-49,19,25,10,'utility'), (89,65,22,14,6,'studio'),
]

# Each stroke is a drive centreline with its width. The two forecourts share the
# central street and the eastern return. The wider southern drive carries the cars.
DRIVES = [
    ([(-72,38.8),(115,38.8)], 10.8),
    ([(40,38.8),(40,-5),(40.6,-8.4),(42.6,-10.9),(46,-12),(112,-12),
      (115,-12.8),(117,-14.5),(118,-17),(118,-29)], 7.8),
    ([(96,52),(96,-89)], 7.0),
]
CROSSINGS = [(0,38.8,10.2),(H3_X,-12,7.4)]
PARKING_COURTS = [(114,-29),(97,52)]


def paving(receiver):
    """Day albedo plus a night road/marking mask in the opaque texture's alpha."""
    size, scale = receiver.size, receiver.scale
    def pixel(x,z):
        return tuple(np.rint((np.array([x,z])+receiver.half)*scale).astype(int))
    def rect(mask,x,z,w,d,value):
        cv2.rectangle(mask,pixel(x-w/2,z-d/2),pixel(x+w/2,z+d/2),value,-1,lineType=cv2.LINE_AA)
    def street_mask(extra):
        result=np.zeros((size,size),np.uint8)
        for line,width in DRIVES:
            points=np.array([pixel(x,z) for x,z in line],np.int32)
            cv2.polylines(result,[points],False,255,max(1,round((width+2*extra)*scale)),cv2.LINE_AA)
        # Paved turning heads match the existing two cars' tight return turns.
        for x in (-28,28):
            cv2.ellipse(result,pixel(x,42.6),(round((7.6+extra)*scale),round((5.6+extra)*scale)),0,0,360,255,-1,cv2.LINE_AA)
        return result

    walks,curbs,lanes=(street_mask(offset) for offset in [1.6,.32,0])
    for x,z in PARKING_COURTS:
        for mask,outset in [(walks,1.0),(curbs,.25),(lanes,0)]:
            rect(mask,x,z,17+2*outset,8+2*outset,255)
    for x,z in [(0,0),(H3_X,H3_Z)]:
        rect(walks,x,z+29.4,21,13,255)
    paint=np.zeros_like(lanes)
    for x,z in PARKING_COURTS:
        for off in (-7.6,-4.8,-2,.8):
            rect(paint,x+off,z-.9,.19,4.9,255)
        rect(paint,x-3.4,z-3.3,8.6,.19,255)
    for x in np.arange(-66,113,6.4):
        if all(abs(x-stop)>7 for stop in (0,40,96)):
            rect(paint,x,38.8,2.65,.24,255)
    for z in np.arange(-82,47,6.4):
        if min(abs(z+12),abs(z-38.8))>7:rect(paint,96,z,.22,2.6,255)
    for z in np.arange(1,33,6.4):rect(paint,40,z,.22,2.6,255)
    for x in np.arange(48,114,6.4):
        if min(abs(x-H3_X),abs(x-96))>6:rect(paint,x,-12,2.6,.22,255)
    for x,z,width in CROSSINGS:
        for i in range(-4,5):rect(paint,x+i*.77,z,.36,width-.45,255)
    rgb=np.full((size,size,3),[246,249,253],np.uint8)
    for mask,color in [(walks,(233,239,245)),(curbs,(187,202,221)),(lanes,(207,219,233)),(paint,(249,251,253))]:
        alpha=mask[:,:,None].astype(np.float32)/255
        rgb=np.rint(rgb*(1-alpha)+np.array(color)*alpha).astype(np.uint8)
    level=np.maximum(np.rint(lanes.astype(np.float32)*.47).astype(np.uint8),paint)
    # Keep colour in transparent texels through browser image decoding.
    ink=np.rint(128+level.astype(np.float32)*(127/255)).astype(np.uint8)
    return rgb,ink


def roof_identifier(out,parent,code,top):
    # Enamel H1/H3 laid flush on the clear roof return. All strokes have a
    # physical surface, follow the building and appear in the downloadable GLB.
    b=Batch()
    x,z=10.8,12.0
    # Glyph contours use X right and +Z towards the front edge of the roof.
    glyphs={
        'H':[[(0,0),(.57,0),(.57,1.18),(1.71,1.18),(1.71,0),(2.28,0),(2.28,2.92),(1.71,2.92),(1.71,1.72),(.57,1.72),(.57,2.92),(0,2.92)]],
        '1':[[(.2,.56),(1.00,0),(1.56,0),(1.56,2.92),(.95,2.92),(.95,.69),(.5,.99)]],
        '3':[[(0,.33),(.43,0),(1.78,0),(2.15,.34),(2.15,1.16),(1.81,1.46),(2.15,1.73),(2.15,2.53),(1.76,2.92),(.43,2.92),(0,2.61),(.33,2.18),(.61,2.38),(1.49,2.38),(1.59,2.25),(1.59,1.89),(1.38,1.74),(.64,1.74),(.64,1.21),(1.38,1.21),(1.58,1.05),(1.58,.69),(1.47,.54),(.62,.54),(.34,.75)]],
    }
    # An alpha-tested enamel stencil adds just two triangles per roof.
    coverage=np.zeros((136,256),np.uint8)
    for digit,offset in zip(code,(0,2.75)):
        for contour in glyphs[digit]:
            coords=np.rint((np.asarray(contour)+[offset+.17,.19])*40).astype(np.int32)
            cv2.fillPoly(coverage,[coords],255,lineType=cv2.LINE_AA)
    rgba=np.full((136,256,4),255,np.uint8);rgba[:,:,:3]=[52,82,139];rgba[:,:,3]=coverage
    encoded=io.BytesIO();Image.fromarray(rgba).save(encoded,format='PNG')
    mat=out.material('Roof number '+code,out.texture(code+' enamel',encoded.getvalue()),{'porcelainRoofNumber':True})
    out.doc['materials'][mat].update(alphaMode='MASK',alphaCutoff=.45)
    verts=[(x,top+.10,z),(x,top+.10,z+4.25),(x+8,top+.10,z+4.25),(x+8,top+.10,z)]
    b.face(verts,'porcelain')
    b.col=[np.ones(3) for _ in b.pos]
    b.emit(out,parent,code+'_roof_number','shell',mat,lambda pos:np.column_stack(((pos[:,0]-x)/8,(pos[:,2]-z)/4.25)))


def add_h3(out,parent,floors):
    """Instance the final baked facade mesh references. No office subtrees are copied."""
    nodes=out.doc['nodes']
    root=out.node('H3_Building',parent,translation=[H3_X,0,H3_Z],
                  extras={'entity_type':'building_shell','building_id':'H3','storeys':len(floors)})
    def instance(index,parent):
        source=nodes[index]
        attrs={k:v for k,v in source.items() if k in ('translation','rotation','scale','matrix','mesh')}
        target=out.node('H3_'+source['name'],parent,**attrs,
                        extras={k:v for k,v in source.get('extras',{}).items() if k in ('night_role','porcelainBatch')})
        for child in source.get('children',[]):instance(child,target)
        return target
    for number,(floor,facade) in enumerate(floors,1):
        xf={k:v for k,v in nodes[floor].items() if k in ('translation','rotation','scale','matrix')}
        level=out.node(f'H3_Storey_{number:02}',root,**xf)
        instance(facade,level)
        if number==20:roof_identifier(out,level,'H3',3.6)
    return root
