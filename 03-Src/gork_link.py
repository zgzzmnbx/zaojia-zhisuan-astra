"""Read-only console discovery. Gork alone owns polling and robot output."""
import asyncio
import httpx
from fastapi import APIRouter

router = APIRouter(prefix='/api/astra/gork')
CONSOLE = 'http://127.0.0.1:8766'


async def console_status(transport=None):
    base = {'console_url': CONSOLE + '/#cost', 'source': 'astra',
            'tracking': False, 'robot_connected': False}
    try:
        async with httpx.AsyncClient(base_url=CONSOLE, timeout=3, trust_env=False,
                                     follow_redirects=False, transport=transport) as client:
            health, sources = await asyncio.gather(client.get('/api/health'), client.get('/api/cost/sources'))
            health.raise_for_status()
            h = health.json()
            if not isinstance(h, dict) or not isinstance(h.get('robot'), dict) or not isinstance(h.get('version'), str):
                raise ValueError('identity')
            base.update(version=h['version'][:40], robot_connected=h['robot'].get('connected') is True)
            if sources.status_code == 404:
                return {**base, 'state': 'upgrade_required', 'message': 'Gork 正在运行旧后台，请从托盘退出并重新打开控制台，加载 Astra 任务来源。'}
            sources.raise_for_status()
            identity = sources.json()
            if identity.get('service') != 'gork-console' or identity.get('schema_version') != 1:
                raise ValueError('identity')
            reply = await client.get('/api/cost/sentinel')
            reply.raise_for_status()
            monitor = reply.json()
            if monitor.get('source') not in {'legacy', 'astra'} or type(monitor.get('enabled')) is not bool:
                raise ValueError('monitor')
            selected = monitor['source'] == 'astra'
            error = str(monitor.get('connection_error') or '')
            state = ('other_source' if not selected else 'paused' if not monitor['enabled']
                     else 'error' if error else 'tracking' if monitor.get('last_success_at') else 'connecting')
            labels = {'other_source': '当前跟踪原版智算，请在 Gork 控制台选择「智算 Astra」。',
                      'paused': 'Astra 任务哨兵已暂停，可在 Gork 控制台开启。',
                      'error': 'Gork 尚未读取到 Astra 状态，请到控制台查看连接提示。',
                      'tracking': 'Gork 正在跟踪 Astra 的真实任务节点。',
                      'connecting': 'Gork 已启用 Astra 来源，正在建立首次基线。'}
            return {**base, 'state': state, 'message': labels[state], 'tracking': state == 'tracking',
                    'selected_source': monitor['source'], 'mode': monitor.get('mode'),
                    'target': monitor.get('target'), 'sound': monitor.get('sound') is True,
                    'last_success_at': monitor.get('last_success_at') if selected else None,
                    'task_id': monitor.get('task_id') if selected else '',
                    'history_count': len(monitor.get('history') or []) if selected else 0}
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        return {**base, 'state': 'offline', 'message': '暂未连接 Gork 控制台。打开本机控制台后可重新检测。'}


@router.get('/status')
async def status():
    return await console_status()
