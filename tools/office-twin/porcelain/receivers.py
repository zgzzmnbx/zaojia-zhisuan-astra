"""Paint one directional silhouette and a narrow contact shadow per receiver."""
import io

import cv2
import numpy as np
from PIL import Image


class Receiver:
    def __init__(self, half, resolution, kind):
        self.half, self.size, self.kind = half, resolution, kind
        self.scale = (resolution - 1) / (2 * half)
        self.cast = np.zeros((resolution, resolution), dtype=np.uint8)
        self.contact = np.zeros_like(self.cast)

    def uv(self, points):
        return .5 + points[:, [0,2]] / (2*self.half)

    def caster(self, vertices, above=0., grounded=None):
        y = vertices[:,1] - above
        top = float(y.max())
        if top < .06:
            return
        foot = float(max(0.,y.min()))
        grounded = foot < .24 if grounded is None else grounded
        hull = cv2.convexHull(np.asarray(vertices[:,[0,2]], dtype=np.float32))
        if grounded:
            self.stamp(self.contact, hull)
            foot = 0.
        # The same upper-left light defines every shadow. Limit the length on
        # the site so the tower's silhouette leaves its neighbours readable.
        reach = {'site': 7.8, 'roof': 2.2, 'interior': .82, 'plant': 2.2}[self.kind]
        direction = np.array([.42,-.34],np.float32)
        def offset(height):
            return direction * min(height, reach / .54)
        sweep = cv2.convexHull(np.concatenate([hull+offset(foot), hull+offset(top)]))
        self.stamp(self.cast, sweep)

    def stamp(self, mask, hull):
        # Sub-pixel edges survive the distant camera without staircase shadows.
        contour = np.rint((hull+self.half)*self.scale*16).astype(np.int32)
        cv2.fillConvexPoly(mask,contour,255,lineType=cv2.LINE_AA,shift=4)

    def block(self, x,z,w,d,top):
        self.caster(np.array([[x-w/2,top,z-d/2],[x+w/2,top,z-d/2],
                              [x+w/2,top,z+d/2],[x-w/2,top,z+d/2]]),grounded=True)

    def canopy(self, x, z, height):
        angles = np.arange(24)*np.pi/12
        r = height*.255
        crown = np.column_stack((x+r*np.cos(angles), np.full(24,height*.67), z+r*np.sin(angles)))
        self.caster(crown,grounded=False)
        self.block(x,z,.18,.18,height*.48)

    def cylinder(self,x,z,radius,height):
        angles = np.arange(24)*np.pi/12
        ring = np.column_stack((x+radius*np.cos(angles),np.full(24,height),z+radius*np.sin(angles)))
        self.caster(ring,grounded=True)

    def image(self, layout=None, origin=None, px_per_m=None):
        paper, soft_edge, contact_radius = {
            'site': ((246,249,253),.32,.38),
            'roof': ((252,253,251),.12,.18),
            'plant': ((255,255,255),.14,.19),
            'interior': ((245,248,251),.09,.08)
        }[self.kind]
        pixels = np.full((self.size,self.size,3),paper,dtype=np.float32)
        if layout:
            def point(p):
                return tuple(np.rint(((np.asarray(p)-origin)/px_per_m+self.half)*self.scale).astype(int))
            for room in layout['rooms']:
                x0,y0,x1,y1=room['bounds_px']
                rgb=(232,240,250) if room.get('kind')=='shared_office' else (245,248,251)
                cv2.rectangle(pixels,point((x0,y0)),point((x1,y1)),rgb,-1)
        def soft(mask, metres):
            return cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),max(.5,metres*self.scale))
        # Use the stronger of the two inks at overlaps. A cluster of parts can
        # never turn into a dirty multiply stain.
        shadow = soft(self.cast,soft_edge)[:,:,None]*[24,21,12]
        contact = soft(self.contact,contact_radius)[:,:,None]*[39,32,19]
        pixels -= np.maximum(shadow,contact)
        output=io.BytesIO()
        Image.fromarray(np.rint(pixels).astype(np.uint8)).save(output,format='PNG',compress_level=7)
        return output.getvalue()
