"""Build the entrance fascia and freestanding roof wordmark from the approved artwork."""
import io
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from geometry import Batch, linear

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
    prim=out.primitive(pos,board.norm,board.indices,board.col,material,uv,night_colors=board.night_col)
    mesh=out.append('meshes',{'name':name,'primitives':[prim]})
    out.node(name,parent,mesh=mesh,extras={'night_role':'brand_sign','porcelainBatch':True})


def solid_geometry(asset, node):
    primitive, = asset.doc['meshes'][node['mesh']]['primitives']
    attrs = primitive['attributes']
    pos = asset.array(attrs['POSITION']).astype(float)
    normal = asset.array(attrs['NORMAL']).astype(float)
    if 'indices' in primitive:
        return pos, normal, asset.array(primitive['indices']).reshape(-1, 3)
    # The archived emblem is triangle soup. Share coincident vertices only
    # where their normals also agree, retaining the bevel around each red band.
    vertices, indices = np.unique(np.column_stack((pos, normal)), axis=0, return_inverse=True)
    return vertices[:, :3], vertices[:, 3:], indices.reshape(-1, 3)


def mount_eave_letters(out, parent, source, emblem, top, shell, roof):
    height, depth, z = 2.48, .13, 19.41
    base = top + .64
    logo = [solid_geometry(emblem, n) for n in emblem.doc['nodes'] if 'mesh' in n]
    glyphs = [solid_geometry(source, source.doc['nodes'][source.named[f'V064_Brand_Lobby_PipeChina_Name_{i}']])
              for i in range(1, 5)]
    # Use the flat face to size the emblem. Its tiny rolled edge stays proud.
    caps = np.concatenate([p[n[:, 2] > .999] for p, n, _ in logo])
    labels = np.concatenate([p for p, _, _ in glyphs])
    logo_min, logo_max = caps.min(0), caps.max(0)
    text_min, text_max = labels.min(0), labels.max(0)
    logo_scale = height / (logo_max[1] - logo_min[1])
    text_scale = .91 * height / (text_max[1] - text_min[1])
    logo_width = (logo_max[0] - logo_min[0]) * logo_scale
    gap = .46 * height
    left = -(logo_width + gap + (text_max[0] - text_min[0]) * text_scale) / 2
    positions, normals, indices, colors = [], [], [], []
    pins = [left + .46 * logo_width]
    vertex_count = 0
    def add_parts(parts, is_logo):
        nonlocal vertex_count
        all_pos = np.concatenate([p for p, _, _ in parts])
        lo, hi = (logo_min, logo_max) if is_logo else (text_min, text_max)
        xy = logo_scale if is_logo else text_scale
        scale = np.array([xy, xy, depth / np.ptp(all_pos[:, 2])])
        origin = [lo[0], (lo[1] + hi[1]) / 2, all_pos[:, 2].min()]
        offset = [left if is_logo else left + logo_width + gap, base + height / 2, z]
        front_color = linear([192, 0, 0] if is_logo else [20, 22, 25])
        edge_color = linear([149, 24, 32] if is_logo else [74, 76, 80])
        for pos, norm, triangles in parts:
            vertices = (pos - origin) * scale + offset
            transformed_normals = norm / scale
            transformed_normals /= np.linalg.norm(transformed_normals, axis=1, keepdims=True)
            face = abs(norm[:, 2]) if is_logo else norm[:, 2]
            positions.append(vertices)
            normals.append(transformed_normals)
            colors.append(np.where(face[:, None] > .75, front_color, edge_color))
            indices.append(triangles.astype(np.int32) + vertex_count)
            vertex_count += len(vertices)
            if not is_logo:
                pins.append((vertices[:, 0].min() + vertices[:, 0].max()) / 2)
            # Only solid strokes cast onto the roof. Counters and the gaps
            # between logo bands remain open in the shadow as well as the mesh.
            front = triangles[(norm[triangles, 2] > .98).all(axis=1)]
            projected = vertices[:, [0, 2]] + (vertices[:, 1:2] - top - .075) * [.43, -.32]
            for triangle in projected[front]:
                roof.stamp(roof.cast, triangle)
    add_parts(logo, True)
    add_parts(glyphs, False)
    for x in pins:
        shell.tube((x, base - .135, z + .018), (x, base + .155, z + .018), .038, .036, 'metal', 7)
    rgb = np.concatenate(colors)
    material = out.material('Porcelain / PipeChina channel letters')
    part = out.primitive(np.concatenate(positions), np.concatenate(normals),
                         np.concatenate(indices), rgb, material, night_colors=rgb)
    # 16-bit linear colors retain near-black type and the subtle return edges.
    rgba = np.column_stack((rgb, np.ones(len(rgb))))
    part['attributes']['COLOR_0'] = out.attr(np.rint(rgba * 65535), 5123, normalized=True)
    mesh = out.append('meshes', {'name':'PipeChina_Roof', 'primitives':[part]})
    out.node('PipeChina_Roof', parent, mesh=mesh, extras={'night_role':'brand_sign','porcelainBatch':True})
