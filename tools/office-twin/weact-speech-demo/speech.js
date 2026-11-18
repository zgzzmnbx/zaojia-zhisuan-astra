const panel = document.querySelector('.weact-demo-panel');
const markers = document.querySelector('#people-markers');
const locate = document.querySelector('#weact-demo-locate');
const status = document.querySelector('#weact-demo-status');
const announcement = document.querySelector('#weact-demo-announcement');
const speakerSelector = '[data-person-id="' + CSS.escape(panel.dataset.speaker) + '"]';
const bubble = document.createElement('span');
bubble.className = 'weact-speech-bubble';
bubble.hidden = true;
bubble.setAttribute('aria-hidden', 'true');

const pollDelay = 5000;
let pollTimer;
let request;
let hideTimer;
let sequence = 0;
let pending;
let initialFocus = false;

function focusSpeaker() {
  if (window.officeTwin?.focusPerson(panel.dataset.speaker)) {
    document.querySelector('#host-person-popover:popover-open')?.hidePopover();
  }
}

function attachToSpeaker() {
  const marker = markers.querySelector(speakerSelector);
  const ready = Boolean(marker && document.documentElement.dataset.viewerStatus === 'ready');
  locate.disabled = !ready;
  if (!ready) {
    paintStatus();
    return;
  }
  if (!initialFocus) {
    initialFocus = true;
    document.title = '造价智算 · WeAct 发言气泡 Demo';
    focusSpeaker();
  }
  paintStatus();
  if (!pending && bubble.hidden) return;
  if (bubble.parentElement !== marker) marker.append(bubble);
  if (!pending) return;

  if (marker.hidden) focusSpeaker();
  bubble.textContent = pending.text;
  bubble.hidden = false;
  announcement.textContent = '石萌说，' + pending.text;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    bubble.hidden = true;
    bubble.textContent = '';
  }, Math.min(20000, Math.max(12000, pending.text.length * 110)));
  pending = undefined;
}

function paintStatus() {
  const state = panel.dataset.feedState;
  const message = !initialFocus ? '正在加载办公室'
    : state === 'unavailable' ? '读取暂不可用 · 自动重试'
    : state !== 'ready' ? '正在连接 WeAct'
    : sequence ? '已收到你的发言' : '等待石萌在群里发文字';
  if (status.textContent !== message) status.textContent = message;
}

function setStatus(state) {
  panel.dataset.feedState = state;
  paintStatus();
}

async function poll() {
  if (document.hidden || request) return;
  clearTimeout(pollTimer);
  request = new AbortController();
  const timeout = setTimeout(() => request.abort(), 25000);
  try {
    const response = await fetch('/api/weact-demo/feed', { cache: 'no-store', signal: request.signal });
    if (!response.ok) throw new Error('无法读取群消息');
    const snapshot = await response.json();
    if (snapshot.state !== 'ready') {
      setStatus('unavailable');
      return;
    }
    if (snapshot.message && snapshot.message.sequence > sequence) {
      sequence = snapshot.message.sequence;
      pending = snapshot.message;
      attachToSpeaker();
    }
    setStatus('ready');
  } catch {
    if (!document.hidden) setStatus('unavailable');
  } finally {
    clearTimeout(timeout);
    request = undefined;
    if (!document.hidden) pollTimer = setTimeout(poll, pollDelay);
  }
}

function stopPolling() {
  clearTimeout(pollTimer);
  request?.abort();
}

const anchorObserver = new MutationObserver(attachToSpeaker);
anchorObserver.observe(markers, { childList: true });
anchorObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-viewer-status'] });
locate.addEventListener('click', focusSpeaker);
document.addEventListener('visibilitychange', () => document.hidden ? stopPolling() : void poll());
window.addEventListener('pagehide', stopPolling);
window.addEventListener('pageshow', () => void poll());
attachToSpeaker();
void poll();
