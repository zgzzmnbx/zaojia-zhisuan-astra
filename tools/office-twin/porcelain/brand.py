"""Build the two porcelain fascia signs from the approved emblem and native lettering."""
import io
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from geometry import Batch

CONTOURS = Path('05-视觉识别/03-Logo-管网logo/contours.json')
# Sign-local coordinates are measured in emblem heights. Positive Y is up.
ART_WIDTH, ART_HEIGHT = 8., 1.75
SIZE = (2048,448)


def sign_art(source, contour_file):
    contours=json.loads(contour_file.read_bytes())
    rings=[np.asarray(p['outer'],dtype=float) for p in contours['polygons']]
    bounds=np.concatenate(rings)
    base,peak=bounds.min(axis=0),bounds.max(axis=0)
    h=peak[1]-base[1]
    emblem_width=(peak[0]-base[0])/h
    # Project the approved front triangles of each character. Holes remain empty.
    faces=[]
    for i in range(1,5):
        n=source.doc['nodes'][source.named[f'V064_Brand_Lobby_PipeChina_Name_{i}']]
        for prim in source.doc['meshes'][n['mesh']]['primitives']:
            attrs=prim['attributes']
            pos=source.array(attrs['POSITION'])
            indices=source.array(prim['indices']).ravel().reshape(-1,3)
            front=source.array(attrs['NORMAL'])[indices]
            faces.extend(pos[indices[(front[:,:,2]>.98).all(axis=1)],:2])
    faces=np.asarray(faces,dtype=float)
    lo,hi=faces.min(axis=(0,1)),faces.max(axis=(0,1))
    text_scale=.89/(hi[1]-lo[1])
    width=emblem_width+.52+(hi[0]-lo[0])*text_scale
    left=-width/2
    scale=SIZE[0]*2/ART_WIDTH
    def pixels(xy):
        return np.rint((xy+[ART_WIDTH/2,ART_HEIGHT/2])*scale-.5).astype(np.int32)
    def emblem(points):
        points=np.asarray(points)
        return pixels((points-base)/h+[left,-.5])
    def mask():
        return np.zeros((SIZE[1]*2,SIZE[0]*2),np.uint8)
    logo,words=mask(),mask()
    for polygon in contours['polygons']:
        cv2.fillPoly(logo,[emblem(polygon['outer'])],255)
        for hole in polygon['holes']:
            cv2.fillPoly(logo,[emblem(hole)],0)
    faces[:,:,0]=(faces[:,:,0]-lo[0])*text_scale+left+emblem_width+.52
    faces[:,:,1]=((hi[1]+lo[1])*.5-faces[:,:,1])*text_scale
    for triangle in pixels(faces):
        cv2.fillConvexPoly(words,triangle,255)
    logo,words=[cv2.resize(m,SIZE,interpolation=cv2.INTER_AREA).astype(np.float32)/255 for m in (logo,words)]
    ink=np.maximum(logo,words)
    # RGB is a normal opaque daytime base colour. Alpha stores local night spill
    # above 0.5, so image decoders preserve even white texels far away from ink.
    rgb=np.ones((*ink.shape,3),np.float32)*(1.-ink[:,:,None])
    red=int(contours['color'][1:3],16)/255
    rgb[:,:,0]+=logo*((red+.055)/1.055)**2.4
    rgb+=words[:,:,None]*.0052
    srgb=np.where(rgb<=.0031308,12.92*rgb,1.055*rgb**(1/2.4)-.055)
    near=cv2.GaussianBlur(ink,(0,0),5.5)
    far=cv2.GaussianBlur(ink,(0,0),19)
    # More precision in the dim outer halo keeps the falloff smooth at night.
    rgba=np.dstack([np.clip(srgb,0,1)*255,128+127*np.sqrt(.64*near+.36*far)])
    buf=io.BytesIO()
    Image.fromarray(np.rint(rgba).astype(np.uint8)).save(buf,format='PNG',compress_level=8)
    return buf.getvalue(),width


def mount_sign(out,parent,material,art_width,name,center_x,bottom,center_z,width,height,depth,bevel):
    board=Batch()
    board.box(center_x,bottom,center_z,width,height,depth,'porcelain',bevel)
    pos=np.asarray(board.pos)
    facing=np.asarray(board.norm)[:,2]>.99
    emblem_height=min(.66*height,.82*width/art_width)
    uv=np.zeros((len(pos),2),dtype=np.float32)
    uv[facing,0]=.5+(pos[facing,0]-center_x)/(ART_WIDTH*emblem_height)
    uv[facing,1]=.5-(pos[facing,1]-bottom-height*.5)/(ART_HEIGHT*emblem_height)
    prim=out.primitive(pos,board.norm,board.indices,np.asarray(board.col),material,uv)
    mesh=out.append('meshes',{'name':name,'primitives':[prim]})
    out.node(name,parent,mesh=mesh,extras={'night_role':'brand_sign','porcelainBatch':True})
