"""Small indexed mesh and glTF helpers. Coordinates are metres, Y up."""
import json
import math
import struct

import numpy as np


def linear(rgb):
    v = np.asarray(rgb, dtype=float) / 255
    return np.where(v <= .04045, v / 12.92, ((v + .055) / 1.055) ** 2.4)


PALETTE = {
    'porcelain': (245, 246, 250), 'chalk': (233, 237, 245),
    'stone': (211, 218, 232), 'metal': (161, 177, 202),
    'reveal': (116, 132, 165), 'joint': (176, 187, 207),
    'glass': (98, 135, 222), 'ice': (163, 191, 239),
    'cobalt': (40, 79, 192), 'ultra': (29, 59, 152),
    'leaf': (72, 110, 210), 'bud': (109, 144, 227), 'ink': (51, 68, 104),
    'fabric': (102, 133, 208), 'linen': (210, 219, 235),
}
INK = {k: linear(v) for k, v in PALETTE.items()}
KEY = np.array([-.46, .73, .55])
KEY /= np.linalg.norm(KEY)


def studio_color(normals, pigment, gain=1):
    """Broad overhead softbox, cool skylight, subtle directional shape."""
    n = np.asarray(normals, dtype=float)
    daylight = (.49 + .22 * n[..., 1] + .42 * np.maximum(0, n @ KEY))
    warmth = np.clip(n[..., 1] * .05 + .04, 0, .09)
    tint = np.array([.89, .925, 1.0]) + warmth[..., None] * [1, .7, 0]
    return np.clip(INK[pigment] * daylight[..., None] * tint * np.asarray(gain)[..., None], 0, 1)


def matrix(node):
    if 'matrix' in node:
        return np.asarray(node['matrix']).reshape(4, 4).T
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    rot = np.array([[1-2*(y*y+z*z), 2*(x*y-w*z), 2*(x*z+w*y)],
                    [2*(x*y+w*z), 1-2*(x*x+z*z), 2*(y*z-w*x)],
                    [2*(x*z-w*y), 2*(y*z+w*x), 1-2*(x*x+y*y)]])
    m = np.eye(4)
    m[:3, :3] = rot @ np.diag(node.get('scale', [1, 1, 1]))
    m[:3, 3] = node.get('translation', [0, 0, 0])
    return m


TYPES = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


class Source:
    def __init__(self, path):
        data = path.read_bytes()
        length, = struct.unpack_from('<I', data, 12)
        self.doc = json.loads(data[20:20 + length])
        self.bin = memoryview(data)[28 + length:]
        self.named = {n['name']: i for i, n in enumerate(self.doc['nodes'])}
        self.arrays = {}

    def array(self, index):
        if index not in self.arrays:
            a = self.doc['accessors'][index]
            v = self.doc['bufferViews'][a['bufferView']]
            width, dtype = WIDTH[a['type']], np.dtype(TYPES[a['componentType']])
            self.arrays[index] = np.ndarray((a['count'], width), dtype, self.bin,
                offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                strides=(v.get('byteStride', width*dtype.itemsize), dtype.itemsize))
        return self.arrays[index]

    def walk(self, node_id, parent=None):
        node = self.doc['nodes'][node_id]
        transform = matrix(node) if parent is None else parent @ matrix(node)
        yield node, transform
        for child in node.get('children', []):
            yield from self.walk(child, transform)


class Glb:
    def __init__(self):
        self.doc = {'asset': {'version': '2.0', 'generator': 'Astra / Porcelain Office 0.1.0'},
                    'extensionsUsed': ['KHR_materials_unlit'], 'scene': 0, 'scenes': [{'nodes': []}],
                    'samplers':[{'wrapS':33071,'wrapT':33071,'magFilter':9729,'minFilter':9987}],
                    **{k: [] for k in ['nodes','meshes','materials','textures','images','accessors','bufferViews']}}
        self.buffer = bytearray()
        self.accessors = {}
        self.materials = {}

    def append(self, section, value):
        dest = self.doc[section]
        dest.append(value)
        return len(dest) - 1

    def view(self, data):
        self.buffer.extend(b'\0' * (-len(self.buffer) % 4))
        offset = len(self.buffer)
        self.buffer.extend(data)
        return self.append('bufferViews', {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)})

    def attr(self, array, component=5126, normalized=False, bounds=False):
        a = np.ascontiguousarray(array, dtype=TYPES[component])
        if a.ndim == 1:
            a = a.reshape(-1, 1)
        key = (component, a.shape, normalized, bounds, a.tobytes())
        if key in self.accessors:
            return self.accessors[key]
        spec = {'bufferView': self.view(key[-1]), 'componentType': component, 'count': len(a),
                'type': ('SCALAR','VEC2','VEC3','VEC4')[a.shape[1]-1]}
        if normalized:
            spec['normalized'] = True
        if bounds:
            spec.update(min=a.min(axis=0).tolist(), max=a.max(axis=0).tolist())
        index = self.append('accessors', spec)
        self.accessors[key] = index
        return index

    def texture(self, name, png):
        image = self.append('images', {'name': name, 'bufferView': self.view(png), 'mimeType': 'image/png'})
        return self.append('textures', {'source': image,'sampler':0})

    def material(self, name, texture=None, extra=None):
        if name not in self.materials:
            surface = {'metallicFactor': 0, 'roughnessFactor': .83}
            if texture is not None:
                surface['baseColorTexture'] = {'index': texture}
            self.materials[name] = self.append('materials', {'name': name, 'pbrMetallicRoughness': surface,
                'extensions': {'KHR_materials_unlit': {}}, 'extras': {'porcelain': True, **(extra or {})}})
        return self.materials[name]

    def node(self, name, parent=None, **props):
        index = self.append('nodes', {'name': name, **props})
        if parent is None:
            self.doc['scenes'][0]['nodes'].append(index)
        else:
            self.doc['nodes'][parent].setdefault('children', []).append(index)
        return index

    def primitive(self, pos, norm, indices, colors, material, uv=None, night_uv=None):
        rgba = np.column_stack((np.clip(np.rint(colors*255),0,255), np.full(len(pos),255)))
        attrs = {'POSITION': self.attr(pos, bounds=True), 'NORMAL': self.attr(norm),
                 'COLOR_0': self.attr(rgba, 5121, normalized=True)}
        if uv is not None:
            attrs['TEXCOORD_0'] = self.attr(uv)
        if night_uv is not None:
            attrs['TEXCOORD_1'] = self.attr(night_uv)
        ids = np.asarray(indices).ravel()
        return {'attributes': attrs, 'indices': self.attr(ids, 5123 if ids.max() < 65536 else 5125),
                'material': material}

    def compact(self):
        """Drop superseded pre-lighting meshes and color streams before delivery."""
        def retain(section, ids):
            ids=sorted(set(ids))
            old=self.doc[section]
            self.doc[section]=[old[i] for i in ids]
            return {old_id:new_id for new_id,old_id in enumerate(ids)}
        nodes=[n for n in self.doc['nodes'] if 'mesh' in n]
        mesh_map=retain('meshes',(n['mesh'] for n in nodes))
        for n in nodes: n['mesh']=mesh_map[n['mesh']]
        parts=[p for mesh in self.doc['meshes'] for p in mesh['primitives']]
        attrs=retain('accessors',(i for p in parts for i in [p['indices'],*p['attributes'].values()]))
        for p in parts:
            p['indices']=attrs[p['indices']]
            p['attributes']={k:attrs[i] for k,i in p['attributes'].items()}
        stream_users=self.doc['accessors']+self.doc['images']
        ids=retain('bufferViews',(v['bufferView'] for v in stream_users))
        for v in stream_users: v['bufferView']=ids[v['bufferView']]
        packed=bytearray()
        for v in self.doc['bufferViews']:
            start=v['byteOffset'];packed.extend(b'\0'*(-len(packed)%4))
            v['byteOffset']=len(packed);packed.extend(self.buffer[start:start+v['byteLength']])
        self.buffer=packed

    def write(self, path):
        self.doc['buffers'] = [{'byteLength': len(self.buffer)}]
        meta = json.dumps(self.doc, ensure_ascii=False, separators=(',',':')).encode()
        meta += b' ' * (-len(meta) % 4)
        self.buffer.extend(b'\0' * (-len(self.buffer) % 4))
        with path.open('wb') as f:
            f.write(struct.pack('<4sII', b'glTF', 2, 28 + len(meta) + len(self.buffer)))
            f.write(struct.pack('<I4s', len(meta), b'JSON') + meta)
            f.write(struct.pack('<I4s', len(self.buffer), b'BIN\0')); f.write(self.buffer)


class Batch:
    """Combine static details within one floor/lighting role, before delivery."""
    def __init__(self):
        self.pos, self.norm, self.col, self.indices = [], [], [], []

    def face(self, vertices, pigment, gain=1., normals=None):
        points = np.asarray(vertices, dtype=float)
        if normals is None:
            cross = np.cross(points[1]-points[0], points[2]-points[0])
            norm = cross / max(np.linalg.norm(cross), 1e-8)
            normals = np.repeat(norm[None, :], len(points), axis=0)
        start = len(self.pos)
        self.pos.extend(points); self.norm.extend(normals)
        self.col.extend(studio_color(normals, pigment, gain))
        for i in range(1, len(points)-1):
            self.indices.extend((start, start+i, start+i+1))

    def box(self, x, y, z, w, h, d, pigment, bevel=0., radius=0., gain=1.):
        """Bevel both the silhouette and horizontal reveals. y is the bottom."""
        b = min(bevel, h*.32, w*.18, d*.18)
        r = min(max(radius, b), w*.48, d*.48)
        if not r:
            base=np.array([(x+w/2,y,z+d/2),(x-w/2,y,z+d/2),(x-w/2,y,z-d/2),(x+w/2,y,z-d/2)])
            top=base+[0,h,0]
            self.face(base,pigment,gain*.85); self.face(top[::-1],pigment,gain)
            for i in range(4):
                j=(i+1)%4
                self.face([base[i],top[i],top[j],base[j]],pigment,np.array([.91,1,1,.91])*gain)
            return
        rings = []
        for inset, dy in ([(b,0),(0,b),(0,h-b),(b,h)] if b else [(0,0),(0,h)]):
            hw, hd, rr = w/2-inset, d/2-inset, max(.002,r-inset)
            ring = []
            for sx, sz, angle in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
                cx, cz = x+sx*(hw-rr), z+sz*(hd-rr)
                for a in np.linspace(angle, angle+90, 5 if radius > .3 else 2):
                    rad=math.radians(a)
                    ring.append((cx+rr*math.cos(rad),y+dy,cz+rr*math.sin(rad)))
            rings.append(np.array(ring))
        self.face(rings[0],pigment,gain*.87)
        self.face(rings[-1][::-1],pigment,gain)
        for low, high in zip(rings, rings[1:]):
            for i in range(len(low)):
                j=(i+1)%len(low)
                if np.linalg.norm(low[i]-low[j])<.0001: continue
                self.face([low[i],high[i],high[j],low[j]],pigment,gain)

    def tube(self, a, b, r1, r2, pigment, segments=12, gain=1.):
        a,b = np.asarray(a,dtype=float),np.asarray(b,dtype=float)
        axis = b-a; axis /= np.linalg.norm(axis)
        ref = np.array([1.,0,0]) if abs(axis[0]) < .9 else np.array([0.,0,1])
        u = np.cross(axis,ref); u /= np.linalg.norm(u)
        v = np.cross(axis,u)
        rays=[math.cos(k*math.tau/segments)*u+math.sin(k*math.tau/segments)*v for k in range(segments)]
        normal=np.array(rays)
        lo=a+r1*normal; hi=b+r2*normal
        self.face(hi,pigment,gain); self.face(lo[::-1],pigment,gain*.90)
        for i in range(segments):
            j=(i+1)%segments
            self.face([lo[i],lo[j],hi[j],hi[i]],pigment,gain,[rays[i],rays[j],rays[j],rays[i]])

    def emit(self, out, parent, name, role, material, uv=None):
        if not self.indices: return
        pos = np.asarray(self.pos)
        p = out.primitive(pos,self.norm,self.indices,np.asarray(self.col),material,uv(pos) if uv else None)
        mesh = out.append('meshes', {'name': name,'primitives':[p]})
        out.node(name,parent,mesh=mesh,extras={'night_role':role,'porcelainBatch':True})
