"""OIDN RTLightmap: linear-radiance texture denoising, not a screenshot filter."""
import ctypes as c, os
import numpy as np
from pathlib import Path
def denoise(rgb,size):
 libpath=Path(os.environ['ASTRA_OIDN_LIBRARY'])
 dll_dir=os.add_dll_directory(str(libpath.parent))
 lib=c.CDLL(str(libpath))
 specs={
 'oidnNewDevice':(c.c_void_p,[c.c_int]),'oidnCommitDevice':(None,[c.c_void_p]),
 'oidnNewFilter':(c.c_void_p,[c.c_void_p,c.c_char_p]),
 'oidnSetSharedFilterImage':(None,[c.c_void_p,c.c_char_p,c.c_void_p,c.c_int,c.c_size_t,c.c_size_t,c.c_size_t,c.c_size_t,c.c_size_t]),
 'oidnCommitFilter':(None,[c.c_void_p]),'oidnExecuteFilter':(None,[c.c_void_p]),
 'oidnGetDeviceError':(c.c_int,[c.c_void_p,c.POINTER(c.c_char_p)]),
 'oidnReleaseFilter':(None,[c.c_void_p]),'oidnReleaseDevice':(None,[c.c_void_p])}
 for name,(ret,args) in specs.items():fn=getattr(lib,name);fn.restype=ret;fn.argtypes=args
 device=lib.oidnNewDevice(1);lib.oidnCommitDevice(device)
 filt=lib.oidnNewFilter(device,b'RTLightmap')
 src=np.ascontiguousarray(rgb,dtype=np.float32);dst=np.empty_like(src)
 lib.oidnSetSharedFilterImage(filt,b'color',src.ctypes.data,3,size,size,0,0,0)
 lib.oidnSetSharedFilterImage(filt,b'output',dst.ctypes.data,3,size,size,0,0,0)
 lib.oidnCommitFilter(filt);lib.oidnExecuteFilter(filt)
 message=c.c_char_p();error=lib.oidnGetDeviceError(device,c.byref(message))
 error_text=message.value if error else None
 lib.oidnReleaseFilter(filt);lib.oidnReleaseDevice(device);dll_dir.close()
 if error:raise RuntimeError(error_text)
 return np.maximum(dst,0)
