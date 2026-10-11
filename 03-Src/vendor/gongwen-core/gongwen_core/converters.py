"""Local DOC conversion provider with a disposable, restricted office profile."""

import os
import shutil
import signal
import struct
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import RLock

import olefile

from .models import FormatError
from .validation import read_package


_OFFICE_SPAWN_LOCK = RLock()
DOC_CONVERTER_REQUIRED_MESSAGE = (
    "当前未提供旧式DOC转换器，请先将.doc另存为.docx后上传。"
    "DOCX和Markdown排版、预览不受影响，无需安装LibreOffice。"
)


@contextmanager
def office_launch_context():
    """External Office must not inherit the frozen application's DLL directory."""
    if os.name != "nt" or not getattr(sys, "frozen", False):
        yield
        return
    import ctypes
    from ctypes import wintypes

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    get_directory = kernel.GetDllDirectoryW
    get_directory.argtypes = [wintypes.DWORD, wintypes.LPWSTR]
    get_directory.restype = wintypes.DWORD
    set_directory = kernel.SetDllDirectoryW
    set_directory.argtypes = [wintypes.LPCWSTR]
    set_directory.restype = wintypes.BOOL
    with _OFFICE_SPAWN_LOCK:
        buffer = ctypes.create_unicode_buffer(get_directory(0, None) + 1)
        get_directory(len(buffer), buffer)
        if not set_directory(None):
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            yield
        finally:
            if not set_directory(buffer.value or None):
                raise ctypes.WinError(ctypes.get_last_error())


def validate_doc(data):
    if len(data) > 30_000_000:
        raise FormatError("INPUT_TOO_LARGE", "DOC超过30MB。")
    if not data.startswith(bytes.fromhex("d0cf11e0a1b11ae1")):
        raise FormatError("INVALID_DOC", "文件不是Word二进制DOC；请勿仅修改扩展名。")
    try:
        with olefile.OleFileIO(BytesIO(data)) as ole:
            if ole.exists("EncryptedPackage") or ole.exists("EncryptionInfo"):
                raise FormatError("ENCRYPTED_INPUT", "加密文档需要先在Office中解密。")
            if not ole.exists("WordDocument"):
                raise FormatError("INVALID_DOC", "OLE文件不包含Word正文流。")
            header = ole.openstream("WordDocument").read(32)
            if len(header) < 12 or header[:2] != b"\xec\xa5":
                raise FormatError("INVALID_DOC", "DOC文件头无效。")
            if struct.unpack_from("<H", header, 10)[0] & 0x8100:
                raise FormatError("ENCRYPTED_INPUT", "加密或混淆的DOC不能直接转换。")
            if any(
                any(
                    part.lower() in {"vba", "macros", "_vba_project_cur"}
                    for part in path
                )
                for path in ole.listdir()
            ):
                raise FormatError("MACRO_INPUT", "含宏的DOC需要另存为无宏文档。")
    except FormatError:
        raise
    except Exception:
        raise FormatError("INVALID_DOC", "DOC复合文档结构损坏。") from None


def find_libreoffice():
    configured = os.environ.get("GONGWEN_SOFFICE")
    if configured:
        return Path(configured) if Path(configured).is_file() else None
    candidates = [
        shutil.which("soffice.com"),
        shutil.which("soffice"),
        shutil.which("libreoffice"),
    ]
    if os.name == "nt":
        for env in ["PROGRAMFILES", "PROGRAMFILES(X86)"]:
            if os.environ.get(env):
                candidates.append(
                    str(Path(os.environ[env]) / "LibreOffice/program/soffice.com")
                )
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    return None


@dataclass
class Conversion:
    content: bytes
    provider: str
    version: str


class LibreOfficeConverter:
    def __init__(self, executable=None, timeout=90, cancelled=None):
        self.executable = Path(executable) if executable else find_libreoffice()
        self.timeout = timeout
        self.cancelled = cancelled or (lambda: False)

    def convert(self, data):
        validate_doc(data)
        if self.executable is None or not self.executable.is_file():
            raise FormatError(
                "CONVERTER_UNAVAILABLE",
                DOC_CONVERTER_REQUIRED_MESSAGE,
            )
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            with office_launch_context():
                version = (
                    subprocess.run(
                        [str(self.executable), "--version"],
                        stdin=subprocess.DEVNULL,
                        capture_output=True,
                        timeout=10,
                        creationflags=flags,
                    )
                    .stdout.decode(errors="replace")
                    .strip()[:200]
                )
        except (OSError, subprocess.TimeoutExpired):
            raise FormatError(
                "CONVERTER_UNAVAILABLE", "LibreOffice无法启动。"
            ) from None
        with TemporaryDirectory(prefix="gongwen-doc-") as tmp:
            folder = Path(tmp)
            profile = folder / "profile"
            process_tmp = folder / "tmp"
            (profile / "user").mkdir(parents=True)
            process_tmp.mkdir()
            (profile / "user/registrymodifications.xcu").write_text(
                """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting">
<prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop>
<prop oor:name="DisableActiveContent" oor:op="fuse"><value>true</value></prop>
<prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop>
<prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Save/Document"><prop oor:name="WarnAlienFormat" oor:op="fuse"><value>false</value></prop></item>
<item oor:path="/org.openoffice.Inet/Settings"><prop oor:name="ooInetProxyType" oor:op="fuse"><value>2</value></prop><prop oor:name="ooInetHTTPProxyName" oor:op="fuse"><value>127.0.0.1</value></prop><prop oor:name="ooInetHTTPProxyPort" oor:op="fuse"><value>9</value></prop><prop oor:name="ooInetHTTPSProxyName" oor:op="fuse"><value>127.0.0.1</value></prop><prop oor:name="ooInetHTTPSProxyPort" oor:op="fuse"><value>9</value></prop></item>
</oor:items>""",
                encoding="utf-8",
            )
            source = folder / "source.doc"
            source.write_bytes(data)
            command = [
                str(self.executable),
                "-env:UserInstallation=" + profile.as_uri(),
                "--headless",
                "--norestore",
                "--nodefault",
                "--convert-to",
                "docx:Office Open XML Text",
                "--outdir",
                str(folder),
                str(source),
            ]
            command = sandbox_command(command, folder)
            process_environment = os.environ.copy()
            process_environment.update(HOME=str(folder), TMPDIR=str(process_tmp))
            with (folder / "conversion.log").open("wb") as log:
                with office_launch_context():
                    process = subprocess.Popen(
                        command,
                        # Desktop stdin is a parent-lifetime pipe, not Office input.
                        stdin=subprocess.DEVNULL,
                        stdout=log,
                        stderr=log,
                        creationflags=flags,
                        start_new_session=os.name != "nt",
                        env=process_environment,
                    )
                deadline = time.monotonic() + self.timeout
                try:
                    while process.poll() is None:
                        if self.cancelled():
                            raise FormatError("CANCELLED", "DOC转换已取消。")
                        if time.monotonic() > deadline:
                            raise FormatError(
                                "CONVERSION_TIMEOUT",
                                "DOC转换超时，已结束本次转换进程。",
                            )
                        time.sleep(0.1)
                finally:
                    if process.poll() is None:
                        if os.name == "nt":
                            subprocess.run(
                                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL,
                                creationflags=flags,
                                timeout=10,
                            )
                        else:
                            os.killpg(process.pid, signal.SIGKILL)
                        process.wait(timeout=10)
            target = folder / "source.docx"
            if process.returncode != 0 or not target.is_file():
                raise FormatError(
                    "CONVERSION_FAILED", "LibreOffice未生成可用DOCX；源文档未改动。"
                )
            result = target.read_bytes()
            read_package(result)
            return Conversion(result, "LibreOffice", version)


def sandbox_command(command, workspace, mode=None, platform_name=None, resolver=None):
    mode = (
        mode
        if mode is not None
        else os.environ.get("GONGWEN_CONVERTER_SANDBOX", "none")
    ).strip().lower()
    if mode == "none":
        return command
    if mode != "bwrap":
        raise FormatError(
            "CONVERTER_SANDBOX_INVALID",
            "DOC转换隔离配置无效；请设置none或bwrap。",
        )
    if (platform_name or os.name) == "nt":
        raise FormatError(
            "CONVERTER_SANDBOX_UNAVAILABLE",
            "bwrap转换隔离仅用于Linux。",
        )
    configured_executable = os.environ.get("GONGWEN_BWRAP", "").strip()
    executable = configured_executable or (resolver or shutil.which)("bwrap")
    if not executable:
        raise FormatError(
            "CONVERTER_SANDBOX_UNAVAILABLE",
            "未找到bubblewrap，已阻止未隔离的DOC转换。",
        )
    executable_path = Path(executable)
    if not executable_path.is_file() or not os.access(executable_path, os.X_OK):
        raise FormatError(
            "CONVERTER_SANDBOX_UNAVAILABLE",
            "bubblewrap路径不可用，已阻止未隔离的DOC转换。",
        )
    workspace_path = Path(workspace).resolve()
    workspace = str(workspace_path)
    workspace_uri = workspace_path.as_uri().rstrip("/")
    sandbox_workspace = "/mnt"
    sandbox_uri = "file:///mnt"
    def map_argument(argument):
        value = str(argument)
        if workspace_uri in value:
            return value.replace(workspace_uri, sandbox_uri)
        if workspace in value:
            return value.replace(workspace, sandbox_workspace).replace("\\", "/")
        return value

    mapped_command = [map_argument(argument) for argument in command]
    wrapped = [
        str(executable_path),
        "--unshare-net",
        "--unshare-pid",
        "--unshare-ipc",
        "--unshare-uts",
        "--die-with-parent",
        "--new-session",
        "--cap-drop",
        "ALL",
        "--ro-bind",
        "/",
        "/",
        "--dev",
        "/dev",
        "--proc",
        "/proc",
        "--bind",
        workspace,
        sandbox_workspace,
    ]
    hidden_paths = ["/tmp", "/run", "/home", "/root"]
    data_root = os.environ.get("GONGWEN_DATA_DIR", "").rstrip("/")
    if data_root.startswith("/"):
        hidden_paths.append(data_root)
    hidden_paths.extend(
        path.strip().rstrip("/")
        for path in os.environ.get("GONGWEN_SANDBOX_HIDE_PATHS", "").split(os.pathsep)
        if path.strip()
    )
    normalized_hidden = []
    for hidden in sorted(set(hidden_paths), key=lambda value: (value.count("/"), value)):
        if not hidden.startswith("/") or hidden in {"/", workspace, sandbox_workspace}:
            continue
        if any(hidden == parent or hidden.startswith(parent + "/") for parent in normalized_hidden):
            continue
        normalized_hidden.append(hidden)
    for hidden in normalized_hidden:
        wrapped.extend(["--tmpfs", hidden])
    wrapped.extend(
        [
            "--chdir",
            sandbox_workspace,
            "--",
            "/usr/bin/env",
            "-i",
            "HOME=" + sandbox_workspace,
            "TMPDIR=" + sandbox_workspace + "/tmp",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "LANG=C.UTF-8",
            *mapped_command,
        ]
    )
    return wrapped
