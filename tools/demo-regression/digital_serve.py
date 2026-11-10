"""Start the installed module with copied data and no outbound transport."""
import socket
import sys
from pathlib import Path

root=Path(sys.argv[sys.argv.index('--data-dir')+1]).resolve()
assert root.parent.name=='digital' and root.parent.parent.parent.name=='demo-regression'
original_connect=socket.socket.connect
def local_only(sock,address):
    if isinstance(address,tuple) and (address[0] not in ('127.0.0.1','localhost','::1') or address[1] in (5189,18768)):
        raise OSError('Regression module blocks external/formal transport')
    return original_connect(sock,address)
socket.socket.connect=local_only
from digital_cost.server import main
main()
