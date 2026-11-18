"""Bake directional penumbrae and contact shadows into horizontal receivers."""
import io
import math

import cv2
import numpy as np
from PIL import Image


class Receiver:
    def __init__(self, half, resolution, kind):
        self.half, self.size, self.kind = half, resolution, kind
        self.scale = (resolution - 1) / (2 * half)
        self.heights = np.zeros((resolution, resolution), dtype=np.float32)

    def uv(self, points):
        return .5 + points[:, [0,2]] / (2*self.half)

    def caster(self, vertices, above=0.0):
        y = float(vertices[:,1].max()-above)
        if y < .06: return
        xy = np.rint((vertices[:,[0,2]]+self.half)*self.scale).astype(np.int32)
        hull = cv2.convexHull(xy)
        x,z,w,d = cv2.boundingRect(hull)
        x0,z0,x1,z1 = max(x,0),max(z,0),min(x+w,self.size),min(z+d,self.size)
        if x0>=x1 or z0>=z1: return
        roi=self.heights[z0:z1,x0:x1]
        stamp=np.zeros_like(roi)
        cv2.fillConvexPoly(stamp,hull-np.array([x0,z0],np.int32),y)
        np.maximum(roi,stamp,out=roi)

    def block(self, x,z,w,d,top):
        self.caster(np.array([[x-w/2,top,z-d/2],[x+w/2,top,z-d/2],
                             [x+w/2,top,z+d/2],[x-w/2,top,z+d/2]]))

    def shift(self, dx, dz):
        return cv2.warpAffine(self.heights,np.float32([[1,0,dx*self.scale],[0,1,dz*self.scale]]),
                              (self.size,self.size),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)

    def image(self, layout=None, origin=None, px_per_m=None):
        interior=self.kind=='interior'
        # Horizon angles from the actual static casters. Several ray elevations
        # integrate a large area light; the small-radius rays seat furniture.
        radii=(.075,.16,.30,.52,.80,1.2,1.8,2.7,4) if interior else (.32,.75,1.4,2.5,4.5,8,14,24,40,62)
        occlusion=np.zeros_like(self.heights)
        for theta in np.arange(8)*math.tau/8:
            horizon=np.zeros_like(occlusion)
            for r in radii:
                h=self.shift(math.cos(theta)*r,math.sin(theta)*r)
                np.maximum(horizon,np.minimum(h/(r+.001),3.5),out=horizon)
            occlusion+=horizon/np.sqrt(1+horizon*horizon)
        occlusion/=8
        shade=np.zeros_like(occlusion)
        for angle,slope in [(2.59,.95),(2.75,1.25),(2.93,1.6),(2.68,1.95),(2.44,1.4)]:
            blocked=np.zeros_like(shade)
            for r in radii:
                h=self.shift(-math.cos(angle)*r,-math.sin(angle)*r)
                np.maximum(blocked,np.clip((h/r-slope)*1.6,0,1),out=blocked)
            shade+=blocked/5
        def blur(a,metres):
            return cv2.GaussianBlur(a,(0,0),max(.45,self.scale*metres))
        occ=.67*blur(occlusion,.09 if interior else .35)+.33*blur(occlusion,.26 if interior else 1.5)
        penumbra=blur(shade,.18 if interior else 1.1)
        pixels=np.full((self.size,self.size,3),[239,241,247] if interior else [242,244,249],dtype=np.float32)
        if layout:
            def point(p):
                return tuple(np.rint(((np.asarray(p)-origin)/px_per_m+self.half)*self.scale).astype(int))
            for room in layout['rooms']:
                x0,y0,x1,y1=room['bounds_px']
                rgb=(233,237,244) if room.get('kind')=='shared_office' else (237,239,246)
                cv2.rectangle(pixels,point((x0,y0)),point((x1,y1)),rgb,-1)
        # Fine paving joints remain readable at close zoom. Mipmapping naturally
        # removes them as the building recedes.
        axis=np.linspace(-self.half,self.half,self.size,dtype=np.float32)
        pitch=1.22 if interior else 5.4
        line=np.abs((axis+.5*pitch)%pitch-.5*pitch)
        seam=(np.maximum(np.exp(-(line/.019)**2)[:,None],np.exp(-(line/(.019 if interior else .055))**2)[None,:]))
        pixels-=seam[...,None]*(4 if interior else 5)
        pixels-=occ[...,None]*np.array([45,42,32])+penumbra[...,None]*np.array([30,29,23])
        output=io.BytesIO()
        Image.fromarray(np.uint8(np.clip(np.rint(pixels),0,255))).save(output,format='PNG',compress_level=7)
        return output.getvalue()
