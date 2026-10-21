"""Run outside Blender after bake_web.py; raw radiance stays recoverable in Codex-Temp."""
from pathlib import Path
import numpy as np,json,time
from PIL import Image
from denoise_lightmap import denoise
root=Path(__file__).resolve().parent
assets=root/'public/assets'
cache=Path(__file__).resolve().parents[3]/'Codex-Temp/blender-mcp-setup/bake-cache'
manifest=json.loads((assets/'bake-manifest.json').read_text(encoding='utf-8'))
start=time.time()
for r in manifest['textures']:
 rgb=np.load(cache/(r['zone']+'.npy'))
 rgb=denoise(rgb,r['size'])/r['scale']
 srgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.power(np.maximum(rgb,0),1/2.4)-.055)
 pixels=np.clip(np.rint(srgb*255),0,255).astype(np.uint8).reshape(r['size'],r['size'],3)
 # bpy pixels start at lower left; PNG rows start at upper left.
 Image.fromarray(pixels[::-1]).save(assets/(r['zone']+'.png'),optimize=True)
 print('DENOISED',r['zone'],flush=True)
manifest['denoiser']='Intel Open Image Denoise 2.5.1 RTLightmap; linear HDR'
manifest['denoiseSeconds']=round(time.time()-start,1)
(assets/'bake-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('DENOISE_COMPLETE',manifest['denoiseSeconds'],flush=True)
