"""Record the exact SDK snapshot and source hashes, without changing upstream."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
origin = Path('D:/Codex-Temp/260920-【公文格式】公文格式智能体v2.0-astra')
snapshot = root/'03-Src/vendor/gongwen-core'
files = []
for file in sorted(snapshot.rglob('*')):
    if not file.is_file() or '__pycache__' in file.parts:
        continue
    name = file.relative_to(snapshot).as_posix()
    source = origin/'03-Src/backend/app/artifact_names.py' if name == 'artifact_names.py' else origin/'03-Src/packages/gongwen-core/pyproject.toml' if name == 'pyproject.toml' else origin/'03-Src/packages/gongwen-core/src'/name
    sha = hashlib.sha256(file.read_bytes()).hexdigest()
    assert sha == hashlib.sha256(source.read_bytes()).hexdigest(), name
    files.append({'path': name, 'sha256': sha, 'source': source.relative_to(origin).as_posix(), 'local_only': file.suffix == '.ttf'})
commit = subprocess.check_output(['git', '-C', str(origin), 'rev-parse', 'HEAD'], text=True).strip()
(root/'config/gongwen-core-source.json').write_text(json.dumps({'source_project': str(origin), 'source_git_head': commit,
 'core_version':'2.5.4', 'profile_version':'1.4.0', 'captured_at':'2026-10-10',
 'note':'工作树内容按逐文件SHA256冻结，Git HEAD不代表未提交源码。字体仅在本机使用，不纳入Git；不复用原服务、配置、凭证或运行资料。',
 'files':files}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(files)} source files verified')
