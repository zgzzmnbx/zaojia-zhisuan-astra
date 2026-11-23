import {createWorkstationLabels} from './workstation-labels.js';
import {getWorkstationEditState} from './workstation-settings.js';
import {bindOfficeCamera,defaultPersonFocusDistance} from './office-camera.js';
import { createFloorFocusTiming, motionProgress } from './navigation-motion.js?v=office-0.46.2';
import {VERSION,OFFICE_MODEL,PRESENTATION_VERSION} from './release.js?v=0.8.0';
import {officeCameraLimits,officeSweepDirection,minimumOfficeZoom} from './office-camera-limits.js?v=office-0.54.7';
import {createOfficeOrbit,bindOfficeOrbitHold} from './office-orbit.js';
import {prepareRenderer,warmOfficeSurfaces,yieldToBrowser} from './prepare-renderer.js';
import {createFloorLabel} from './floor-label.js?v=office-0.54.1';
import {createRoofLabels} from './roof-labels.js?v=0.7.3';
import {batchStaticGeometry,cacheStaticTransforms} from './static-batches.js?v=0.44.2';
import {createFrameMeter} from './frame-meter.js';
import {createStreetTraffic} from './street-traffic.js';
import {createMiniatureFocus} from './miniature-focus.js';
import {mountPorcelainPalette} from './porcelain-palette.js';
import {createOfficeBoard,hideBoardCore} from './office-board.js';
import {bindPersonPointer} from './person-pointer.js';
import {createPersonDragOverlay} from './person-drag-overlay.js';
import {officeClient} from './office-client.js';
import { firstVisibleFloorHit,visibleSceneHit,outsideView } from './floor-picking.js?v=0.39.1';
import { summarizeMaterialPaths, materialCoverageCopy } from './material-provenance.js?v=0.6.7';
import { loadModelBytes, bindModelDownload } from './model-transport.js?v=0.7.0';
import {readSettings,applyRoomLabels,applyOfficeNameDOM,SETTINGS_KEY} from './office-settings-store.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { icon, paintIcons } from '../astra_ui/icons.js';
import { applyAstraTheme } from '../astra_ui/theme.js';
import { createPictureSettings } from './picture-settings.js?v=0.6.7';
import { contextVisibleForView, useHeroPriorityFraming, isolateContextMaterials } from './context-view-policy.js?v=0.6.7';
import { heroPriorityBounds } from './hero-framing.js?v=0.6.0';
import { createNightEnvironment } from './night-environment.js?v=0.6.7';
import { createPeopleDemo } from './host-people.js';
import { resolveView, VIEW_COPY, FLOOR_COUNT, DETAILED_FLOOR, PROTOCOL,
  floorElevation, floorPresentation, isTrustedHostMessage } from './scene-state.js?v=0.6.7';

const MODEL_URL = new URL('../models/'+OFFICE_MODEL, import.meta.url);
const DATA_ROOT = new URL('../data/', import.meta.url);
const VIEW_DIRECTION = new THREE.Vector3(1.1, .83, 1.5).normalize();
const CAMPUS_DIRECTION = new THREE.Vector3(.72, 1.12, 1.48).normalize();
const ROOM_DIRECTION = new THREE.Vector3(.9, 1.25, 1.25).normalize();
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Independently mounted viewer; person/task records are explicitly demo-only. */
export async function mountOfficeViewer() {
  const $ = selector => document.querySelector(selector);
  const viewport = $('#viewport');
  const canvasHost = $('#canvas-host');
  const frameMeter=createFrameMeter($('#office-fps'));
  let staticBatches=null,renderWidth=0,renderHeight=0;
  const aborter = new AbortController();
  const listenerRemovers = [];
  const params = new URLSearchParams(location.search);
  const embedded = params.get('mode') === 'embed';
  const entryView = resolveView(params.get('view')) ?? 'building';
  const floorFocus = createFloorFocusTiming();
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  document.body.classList.toggle('office-embed', embedded);
  let theme = { palette: 'astra', scheme: 'light' };
  let view = entryView;
  let disposed = false, requestedVisible = true, inView = true, pageSuspended = false;
  let renderReady = false, renderStatus = 'loading', frame = 0, transition = null;
  let gpuPrepared=false,lastFrameTime=null;
  let streetTraffic=null,trafficWake=0,trafficAdvancing=false;
  let miniatureFocus=null,openness=null,interiorLabels=false;
  let renderer, scene, camera, controls, model, buildingRoot, contextRoot, twinRoot, officeRoot, facade9, roomOutline;
  let resizeObserver, intersectionObserver;
  let people, nightEnvironment, orbit, releaseOrbitHold;
  let floorLabel,roofLabels,previewCamera,officeBoard,seatLabels;
  let orbitDirection=1,wasOrbitRunning=false;
  let business=officeClient.getState(),bridgeContext={id:null,revision:0};
  const unsubscribeBusiness=officeClient.subscribe((kind,value)=>{
    if(kind==='snapshot'){
      business=value;officeBoard?.sync(value);people?.syncBusiness(value);
    }
    if(kind==='event'){people?.react(value);notify('employee-event',{seq:value.seq,employeeId:value.event.employeeId,eventType:value.event.type,contextId:bridgeContext.id});}
  });
  const loadStarted=performance.now();
  const loadReport={viewerVersion:VERSION,stage:'starting',lastError:null,modelURL:MODEL_URL.href, decodedModelBytes:null, fetchMs:null, parseMs:null,
    firstRenderMs:null, modelReadyMs:null, textures:[], webglRendered:false};
  let layout, buildingMetadata, officeMetadata, furnitureIntegration;
  let officeName='H1 办公室';
  let fitHeight = 100, selectedFloor = null, selectedRoom = null;
  let overviewHeight = fitHeight, focusOrigin = null;
  let personFocusDistance=defaultPersonFocusDistance,personFrameHeight=0;
  let campusProjection=null;
  const floors = new Map(), rooms = new Map(), movingFloors = [];

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listenerRemovers.push(() => target.removeEventListener(type, handler, options));
  }
  function active() { return !disposed && requestedVisible && inView && !pageSuspended && !document.hidden && !$('#office-admin-settings')?.open; }
  function notify(type, data = {}) {
    if (embedded && window.parent !== window) window.parent.postMessage({ namespace: PROTOCOL, type, ...data }, location.origin);
  }
  function getState() {
    return { version: VERSION, presentationVersion:PRESENTATION_VERSION, assemblyOpenness:openness,traffic:{running:!!streetTraffic&&picture.trafficEnabled()&&active(),positions:streetTraffic?.positions()??[]}, miniatureFocus:miniatureFocus?.state()??null, porcelainBlue:porcelainPalette?.id??null,assetVersion:PRESENTATION_VERSION, eventService:{connection:officeClient.getState().connection,cursor:business.cursor??0,taskCount:business.tasks?.length??0,messageCount:business.messages?.length??0,demo:true}, context:{...bridgeContext},renderMode:'porcelain', bakedMaterialCount:picture.bakedMaterialCount(), mode: embedded ? 'embed' : 'standalone', view, floorId: selectedFloor ? `H1-F${String(selectedFloor).padStart(2,'0')}` : null,
      officeBoard:officeBoard?.state()??null,performance:{...frameMeter.state(),staticBatches,drawCalls:renderer?.info.render.calls??0,triangles:renderer?.info.render.triangles??0},roomId: selectedRoom, visible: requestedVisible, active: active(), status: renderStatus,
      entrance:{phase:loadReport.webglRendered?'complete':'waiting',elapsed:0,running:false}, theme: { ...theme }, picture:picture.getState(),pictureRecord:picture.getRecord(),cameraLimits:officeCameraLimits(view), people:people?.getState()??null, nightEnvironment:nightEnvironment?.state()??null, orbit:orbit?.state()??null,camera:camera&&controls?{position:camera.position.toArray(),target:controls.target.toArray()}:null,businessConnected: false, loadReport:structuredClone(loadReport) };
  }
  let loadingMessage='正在读取办公室资料', loadingTimer=null;
  const formatMB=n=>(n/1024/1024).toFixed(1)+' MiB';
  function diagnosticText(){return JSON.stringify({viewerVersion:loadReport.viewerVersion,renderMode:'porcelain',stage:loadReport.stage,elapsedSeconds:Math.round((performance.now()-loadStarted)/1000),decodedModelBytes:loadReport.decodedModelBytes,fetchMs:loadReport.fetchMs,parseMs:loadReport.parseMs,firstRenderMs:loadReport.firstRenderMs,webglRendered:loadReport.webglRendered,materialPaths:loadReport.materialPaths??null,colorPipeline:loadReport.colorPipeline??null,lastError:loadReport.lastError},null,2);}
  function refreshDiagnostic(){const box=$('#load-diagnostic-text');if(box)box.value=diagnosticText();}
  function renderLoading(){
    if(disposed||renderStatus!=='loading')return;
    const seconds=Math.floor((performance.now()-loadStarted)/1000);
    $('#render-status').textContent=loadingMessage+' · '+seconds+'秒';
    $('#fallback-message').textContent=loadingMessage+'（'+seconds+'秒）。当前显示静态占位图，三维就绪后才能拖动。';
    refreshDiagnostic();
  }
  function loadingStage(stage,message){loadReport.stage=stage;loadingMessage=message;renderLoading();}
  function status(message) { $('#render-status').textContent = message; }
  function stopLoading(){if(loadingTimer)clearInterval(loadingTimer);loadingTimer=null;refreshDiagnostic();}
  function transportState(info){
    if(info.phase==='manifest')loadingStage('manifest','正在连接并读取模型清单');
    else if(info.phase==='download')loadingStage('download','正在读取模型 0 / '+formatMB(info.bytes));
    else if(info.phase==='verify')loadingStage('verify','模型已下载，正在校验完整性');
    else if(info.phase==='retry-wait')loadingStage('retry',`连接未完成，准备第${info.attempt+1}/${info.maxAttempts}次尝试`);
  }
  function paintState() {
    const copy = VIEW_COPY[view];
    $('#scene-label').textContent = renderStatus === 'fallback' ? 'H1 / H3 · 园区预览' : `白瓷 · ${copy.label}`;
    $('#view-description').textContent = renderStatus === 'fallback' ? '当前显示整楼静态预览，可在工作栏查看空间资料。' : copy.description;
    document.querySelectorAll('[data-view]').forEach(button => {
      const chosen = button.dataset.view === view;
      button.classList.toggle('btn-primary', chosen); button.classList.toggle('btn-ghost', !chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    document.querySelectorAll('[data-floor]').forEach(button => {
      const chosen = Number(button.dataset.floor) === selectedFloor;
      button.classList.toggle('btn-primary', chosen); button.classList.toggle('btn-ghost', !chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    document.querySelectorAll('[data-room]').forEach(button => {
      const chosen = button.dataset.room === selectedRoom;
      button.classList.toggle('btn-primary', chosen); button.classList.toggle('btn-ghost', !chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    $('#room-label').hidden = !selectedRoom || renderStatus === 'fallback';
    const room = layout?.rooms?.find(item => item.id === selectedRoom);
    if (room) $('#room-label').textContent = room.label;
    $('#selection-name').textContent = room ? `9 楼 · ${room.label}` : selectedFloor ? `${officeName} · ${selectedFloor} 楼` : '天津运营中心 · H1 / H3';
    $('#selection-basis').textContent = selectedFloor === 9 ? '已有 9 楼平面图描摹' : selectedFloor ? '楼层外壳示意' : 'H1 九楼平面图、园区示意布局';
    const seats = room ? layout?.workstations?.filter(item => item.room_id === room.id && item.assignable!==false).length : 0;
    const floorRecord = buildingMetadata?.floors?.find(item => item.floor_number === selectedFloor);
    const elevation = selectedFloor ? (Number.isFinite(floorRecord?.elevation_m) ? floorRecord.elevation_m : floorElevation(selectedFloor)) : null;
    $('#selection-detail').textContent = room ? `${seats || 0} 个已建工位 · 员工未绑定` : selectedFloor === 9 ? `${officeMetadata?.workstation_count ?? layout?.workstations?.length ?? '—'} 个已建工位 · 员工未绑定` : selectedFloor ? `基底标高约 ${elevation.toFixed(1)} 米 · 内部未建模` : '双楼各 20 层 · 造价中心在 H1 九楼';
    document.documentElement.dataset.viewerView = view;
  }
  function selectTab(name) {
    $('#floor-panel').hidden = name !== 'floors'; $('#room-panel').hidden = name !== 'rooms'; $('#people-panel').hidden = false;
    for (const which of ['floors', 'rooms', 'people']) {
      const button = $(`#tab-${which}`), chosen = which === name;
      button.classList.toggle('btn-primary', chosen); button.classList.toggle('btn-ghost', !chosen);
      button.setAttribute('aria-pressed', String(chosen));
    }
    $('#navigation-count').textContent = name === 'people' ? '演示数据' : name === 'rooms' ? `${layout?.rooms?.length ?? 0} 个区域` : '20 层';
    document.querySelectorAll('.office-selection,.office-business-note,.office-assumptions').forEach(node=>node.hidden=name==='people');
  }
  function createLists() {
    $('#floor-list').innerHTML = Array.from({length:FLOOR_COUNT}, (_, i) => FLOOR_COUNT-i).map(number =>
      `<button class="btn btn-ghost" data-floor="${number}" aria-pressed="false"><span><strong class="office-floor-num">${number}F</strong>${number === DETAILED_FLOOR ? '办公室白模' : '楼层外壳'}</span><small>${number === DETAILED_FLOOR ? '有平面依据' : '示意'}</small></button>`).join('');
    $('#room-list').innerHTML = (layout?.rooms ?? []).filter(room=>!room.merged_into).map(room => `<button class="btn btn-ghost" data-room="${escapeHTML(room.id)}" aria-pressed="false"><span>${escapeHTML(room.label)}</span><small>${escapeHTML(room.id)}</small></button>`).join('') || '<p class="office-description">房间数据暂不可用。</p>';
    listen($('#floor-list'), 'click', event => {
      const button = event.target.closest('[data-floor]');
      if (button) selectFloor(Number(button.dataset.floor));
    });
    listen($('#room-list'), 'click', event => {
      const button = event.target.closest('[data-room]');
      if (button) focusRoom(button.dataset.room);
    });
  }
  function paintFurnitureInfo() {
    if (!furnitureIntegration) return;
    const summary = furnitureIntegration.summary;
    const description = typeof summary === 'string' ? summary :
      typeof summary?.text === 'string' ? summary.text :
      typeof summary?.description === 'string' ? summary.description : null;
    const layoutStatus = typeof summary?.layout_status === 'string' ? summary.layout_status : '器具布置示意';
    const text = description || '已读取器具清单；数量来自本次模型的布置记录。';
    $('#furniture-description').textContent = text.includes(layoutStatus) ? text : `${text} ${layoutStatus}。`;
    const counts = furnitureIntegration.asset_counts;
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return;
    const values = Object.values(counts).map(value => typeof value === 'number' ? value : value?.count);
    if (!values.length || !values.every(value => Number.isSafeInteger(value) && value >= 0)) return;
    const total = values.reduce((sum, value) => sum + value, 0);
    const sourcePrefix = Number.isSafeInteger(summary?.source_asset_count) && summary.source_asset_count >= 0 ? `${summary.source_asset_count} 个来源资产 · ` : '';
    $('#furniture-counts').textContent = `${sourcePrefix}${values.filter(value => value > 0).length} 类器具模型 · ${total} 个布置实例`;
    $('#furniture-counts').hidden = false;
  }
  function fail(error) {
    if (disposed || renderStatus === 'fallback' || error?.name === 'AbortError') return;
    renderStatus = 'fallback'; renderReady = false;suspendMotion();orbit?.sync();
    $('#office-theme-blue').disabled=true;
    if(!loadReport.materialPaths)$('#material-coverage').textContent='三维初始化或模型读取未完成，无法统计材质覆盖。';
    loadReport.lastError={code:error?.code??'VIEWER_ERROR',message:String(error?.message??error),stage:loadReport.stage};stopLoading();
    miniatureFocus?.dispose();miniatureFocus=null;
    nightEnvironment?.dispose(); nightEnvironment=null;
    picture.dispose();
    officeBoard?.dispose();officeBoard=null;
    people?.dispose();seatLabels?.dispose();seatLabels=null;
    floorLabel?.dispose();floorLabel=null;
    roofLabels?.dispose();roofLabels=null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0; transition = null;
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    controls?.dispose(); clearOutline(); disposeObject(model);
    scene?.traverse(object => object.shadow?.dispose());
    renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
    floors.clear(); rooms.clear(); movingFloors.length=0;
    controls = null; renderer = null; scene = null; model = null; buildingRoot = null; contextRoot = null; twinRoot = null; officeRoot = null; facade9 = null;
    $('#preview-fallback').hidden = false;
    $('#fallback-message').textContent = `加载中断：${loadReport.lastError.message}。当前显示白瓷沙盘预览图，可点“重新加载”重试。`;
    $('#loading-tools').hidden=false;$('#load-diagnostics').open=true;refreshDiagnostic();
    $('#canvas-host').hidden = true;
    document.querySelectorAll('[data-view], #back-building, [data-camera]').forEach(button => button.disabled = true);
    paintState();
    document.documentElement.dataset.viewerStatus = 'fallback';
    status('加载未完成 · '+loadReport.lastError.code);
    console.warn('Office viewer fallback:', error?.message ?? error);
    notify('ready', { ...getState(), capabilities: ['theme', 'visibility', 'spatial-metadata'], rendererAvailable: false });
  }
  function setTheme(next) {
    theme = applyAstraTheme({ ...theme, ...next });
    $('#theme-toggle').innerHTML = `<span class="astra-icon">${icon(theme.scheme === 'dark' ? 'sun' : 'moon')}</span>`;
    $('#theme-toggle').setAttribute('aria-label', theme.scheme === 'dark' ? '切换浅色主题' : '切换深色主题');
    const styles = getComputedStyle(document.documentElement);
    if (scene&&!nightEnvironment) scene.background = new THREE.Color(theme.scheme === 'dark' ? '#040813' : picture.getState().backgroundColor);
    picture.setTheme(theme.scheme);
    nightEnvironment?.setTheme(theme.scheme);
    officeBoard?.setTheme(theme.scheme);
    roofLabels?.setTheme();
    if (roomOutline) roomOutline.material.color.set(styles.getPropertyValue('--astra-primary').trim() || '#284bd4');
    requestFrame(); return { ...theme };
  }
  function setVisible(visible) {
    if (typeof visible !== 'boolean') throw new TypeError('visible must be boolean');
    const returning=visible&&!requestedVisible&&loadReport.webglRendered;
    requestedVisible = visible;window.dispatchEvent(new CustomEvent('office-scene-visibility',{detail:visible}));if(!visible)releaseOrbitHold?.();orbit?.sync();
    if(!visible){frameMeter.suspend();floorLabel?.restore();people?.suspend();people?.closeMenu();suspendMotion();}
    if(returning&&params.get('entrance')==='office')setView(entryView,{animate:false});
    if (!active() && frame) { cancelAnimationFrame(frame); frame = 0; }
    if (active()) requestFrame();
    return getState();
  }
  function suspendMotion(){
    clearTimeout(trafficWake);trafficWake=0;trafficAdvancing=false;lastFrameTime=null;
  }
  function requestFrame() {
    clearTimeout(trafficWake);trafficWake=0;
    if (active() && renderReady && gpuPrepared && !frame) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    if (!active() || !renderReady) return;
    const delta=lastFrameTime===null?0:Math.max(0,Math.min(100,now-lastFrameTime));lastFrameTime=now;
    const blurLevel = picture.getRenderSettings().miniatureBlur / 100;
    const reduced = motionPreference.matches;
    const hadTransition = !!transition;
    const clearing = transition?.toOpen === 0 && blurLevel > 0 && !reduced && floorFocus.clearBeforeMove(delta);
    let moving = false;
    if (transition && !clearing) {
      transition.elapsed+=delta;
      const { progress, amount } = motionProgress(transition.elapsed, 0, transition.duration, reduced);
      setAssembly(progress === 1 ? transition.toOpen :
        transition.fromOpen + (transition.toOpen - transition.fromOpen) * amount);
      if (transition.camera) {
        const { from, to } = transition.camera;
        camera.position.lerpVectors(from.position, to.position, amount);
        controls.target.lerpVectors(from.target, to.target, amount);
        fitHeight = from.height + (to.height-from.height)*amount;
        camera.zoom = from.zoom + (to.zoom-from.zoom)*amount;
        camera.lookAt(controls.target); resize();
      }
      moving = progress < 1;
      if (!moving) transition = null;
    }
    const motion=orbit.step(now);
    if(orbit.state().running&&!wasOrbitRunning)orbitDirection=officeSweepDirection(controls.getAzimuthalAngle(),officeCameraLimits(view));
    wasOrbitRunning=orbit.state().running;
    if(motion.angle)camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),-motion.angle*orbitDirection).add(controls.target);
    controls.autoRotate=motion.full;
    const controlsChanged = transition?.camera ? false : controls.update(motion.delta||1/60);
    const expanded = view === 'exploded' && openness === 1;
    if (reduced || blurLevel === 0) floorFocus.snap(expanded);
    else if (view === 'exploded') {
      floorFocus.reveal(delta, expanded && !hadTransition && (!controlsChanged || orbit.state().running));
    }
    camera.updateMatrixWorld();
    const runTraffic=!!streetTraffic && picture.trafficEnabled();
    if(runTraffic)streetTraffic.step(trafficAdvancing?delta/1000:0);
    trafficAdvancing=runTraffic;
    if (roomOutline) roomOutline.update();
    const detailView = interiorLabels ? 'exploded' : 'building';
    people?.update(camera,detailView,now);seatLabels?.update(camera,detailView);
    floorLabel?.update();
    nightEnvironment?.update();
    // Night replaces PBR lighting with the authored display shader, so a fresh
    // directional shadow pass contributes nothing to its output.
    renderer.shadowMap.autoUpdate=theme.scheme!=='dark';
    renderer.info.reset();
    try {
      const reveal = floorFocus.amount;
      const strength = blurLevel * reveal;
      if (strength <= 0) miniatureFocus.release();
      const drawScene = emission => {
        if (strength > 0) miniatureFocus.render(strength, emission, reveal);
        else renderer.render(scene, camera);
      };
      if (!nightEnvironment?.render(drawScene)) drawScene(false);
    }
    catch(error){error.code??='MODEL_GPU';fail(error);return;}
    frameMeter.frame(now);
    if(!loadReport.webglRendered){
      loadReport.webglRendered=true;renderStatus='ready';loadReport.stage='ready';stopLoading();
      $('#loading-tools').hidden=true;$('#preview-fallback').hidden=true;document.documentElement.dataset.viewerStatus='ready';
      if(porcelainPalette)$('#office-theme-blue').disabled=false;
      document.querySelectorAll('[data-view], #back-building, [data-camera]').forEach(button=>button.disabled=false);
      status('白瓷办公室已就绪');
      loadReport.firstRenderMs=Math.round((performance.now()-loadStarted)*10)/10;refreshDiagnostic();
      console.info('Office viewer load report',structuredClone(loadReport));
      notify('ready', { ...getState(), capabilities: ['theme','visibility','view','focus-room','focus-person','set-context','office-event','dispose'], rendererAvailable: true, model: buildingMetadata?.asset_id ?? 'h1-building-office-v0.3' });
    }
    const revealing = expanded && blurLevel > 0 && floorFocus.pending;
    if (transition || revealing || moving || controlsChanged || people?.isAnimating() || orbit.state().running) requestFrame();
    else if(runTraffic)trafficWake=setTimeout(requestFrame,30);
    else frameMeter.idle();
  }
  let hostLeft=0;
  listen(window,'office-host-layout',event=>{hostLeft=event.detail.left;resizeLayout();});
  function panelInsets() {
    const left=parseFloat(document.documentElement.style.getPropertyValue('--host-chat-width'))||hostLeft;
    const rail=$('#space-cards-panel'),artifact=$('#host-artifact');
    let right=artifact?.offsetWidth||!rail?.hidden?300:0;
    // Standalone already dedicates a grid column to the rail. Only the embedded
    // cards overlay the campus viewport and need additional camera clearance.
    if(twinRoot&&view==='building')right=embedded ? Math.max(rail?.offsetWidth||0,artifact?.offsetWidth||0) : 0;
    if(getWorkstationEditState().open)right=($('#office-workstations')?.getBoundingClientRect().width||380)+24;
    return {left,right};
  }
  function campusHeight(size){
    const {left,right}=panelInsets(),width=viewport.clientWidth;
    const available=Math.max(width*.18,width-left-right-32);
    return Math.max(6,size.y,size.x*viewport.clientHeight/Math.max(1,available))*1.12;
  }
  function resizeLayout(){
    if(campusProjection&&view==='building'&&viewport.clientWidth&&viewport.clientHeight){
      const height=campusHeight(campusProjection);
      if(!focusOrigin)overviewHeight=height;
      if(transition?.camera)transition.camera.to.height=height;
      else fitHeight=height;
    }
    resize();
  }
  function resize() {
    if (!renderer || disposed) return;
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    if(width!==renderWidth||height!==renderHeight){renderer.setSize(width,height,false);renderWidth=width;renderHeight=height;}
    const aspect = width/height;
    camera.left = -fitHeight*aspect/2; camera.right = fitHeight*aspect/2;
    camera.top = fitHeight/2; camera.bottom = -fitHeight/2;
    controls.minZoom = minimumOfficeZoom(fitHeight,overviewHeight);
    const {left,right}=panelInsets();
    camera.setViewOffset(width,height,-(left-right)/2,0,width,height);
    camera.updateProjectionMatrix(); requestFrame();
  }
  function visibleBounds(object) {
    const bounds = new THREE.Box3();
    object.updateWorldMatrix(true, true);
    object.traverseVisible(child => {
      if (!child.isMesh || !child.geometry || child.userData.roofSign) return;
      if(!child.geometry.boundingBox)child.geometry.computeBoundingBox();
      if (child.geometry.boundingBox) bounds.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
    });
    return bounds;
  }
  function fitObject(object, direction = VIEW_DIRECTION) {
    if (!renderReady || !object) return;
    let bounds, towerBoxes;
    if(object===model&&contextRoot?.visible&&useHeroPriorityFraming(view)){
      const hero=visibleBounds(buildingRoot);
      if(hero.isEmpty())return;
      if(twinRoot&&view==='building'){
        if(direction===VIEW_DIRECTION)direction=CAMPUS_DIRECTION;
        const padding=new THREE.Vector3(7,2,10);
        towerBoxes=[hero,visibleBounds(twinRoot)].map(box=>box.expandByVector(padding));
        bounds=towerBoxes[0].clone().union(towerBoxes[1]);
      }else{
        const context=visibleBounds(contextRoot);
        const fit=heroPriorityBounds({min:hero.min.toArray(),max:hero.max.toArray()},context.isEmpty()?null:{min:context.min.toArray(),max:context.max.toArray()});
        bounds=new THREE.Box3(new THREE.Vector3(...fit.min),new THREE.Vector3(...fit.max));
      }
    }else bounds=visibleBounds(object);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    if(towerBoxes)center.y-=5.5; // Include the entry squares and their shared street in the overview.
    // Orthographic scale is independent of eye distance. Keep surrounding
    // buildings in front of the near plane when pulling back from a detail.
    const overviewDistance = focusOrigin ? focusOrigin.pose.position.distanceTo(focusOrigin.pose.target) : 0;
    const distance = Math.max(30, overviewDistance, bounds.getSize(new THREE.Vector3()).length()*2);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(center); camera.updateMatrixWorld(true);
    const projected = new THREE.Box3();
    for(const box of towerBoxes??[bounds]){
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
        projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
    }
    const size = projected.getSize(new THREE.Vector3());
    const {left,right}=panelInsets();
    const clearance=getWorkstationEditState().open?left+right+24:0;
    const aspect = Math.max(.1, (viewport.clientWidth-clearance)/Math.max(1, viewport.clientHeight));
    const margin=view==='building'&&object===model?1.01:1.18;
    campusProjection=towerBoxes?size:null;
    fitHeight = campusProjection?campusHeight(size):Math.max(6, size.y, size.x/aspect)*margin;
    // Preserve the established expanded tray framing at every viewport size.
    if(view==='exploded'&&object===officeRoot)fitHeight*=1.3;
    personFrameHeight=object.userData.demoPersonId ? fitHeight : 0;
    if(personFrameHeight)fitHeight=personFrameHeight*personFocusDistance/100;
    if(!focusOrigin)overviewHeight=fitHeight;
    camera.zoom = 1; camera.far = Math.max(600, distance*4);
    resize(); controls.update(); requestFrame();
  }
  function clearOutline() {
    if (!roomOutline) return;
    scene.remove(roomOutline); roomOutline.geometry.dispose(); roomOutline.material.dispose(); roomOutline = null;
  }
  function setAssembly(value) {
    roofLabels?.setVisible(view==='building' && value===0);
    if (value === openness) return;
    openness = value;
    for (const {object, original, offset} of movingFloors) {
      object.position.copy(original).addScaledVector(offset, value);
      object.updateMatrix();
      object.updateMatrixWorld();
    }
    // Refit the cover only after docking, including when a hover reverses.
    facade9.visible = value === 0;
    officeRoot.visible = value > 0;
    interiorLabels = value >= .9;
  }

  function setView(next, { animate = true, focus = null, labelPreview = false, cameraTarget = null } = {}) {
    next = resolveView(next);
    if (!next) throw new TypeError('Unknown view');
    if (focus && renderReady && !focusOrigin) {
      focusOrigin = {view, pose:transition?.camera?.to ?? cameraPose()};
    } else if (!focus && !labelPreview) {
      focusOrigin = null;
    }
    if(next==='building' && !labelPreview)people?.closeMenu();
    if(!labelPreview)floorLabel?.cancel();
    orbit?.focus(false);
    view = next;officeBoard?.setView(next);if(controls)Object.assign(controls,officeCameraLimits(view)); selectedRoom = null; selectedFloor = next==='exploded' ? 9 : null;
    clearOutline(); paintState();
    if (!renderReady) return getState();
    // Capture the displayed state, not the previous destination, so reversals never jump.
    const cameraFrom = cameraPose();
    // Drain any remaining OrbitControls damping without changing the displayed pose.
    const damping = controls.enableDamping;
    controls.enableDamping=false; controls.update(); controls.enableDamping=damping;
    applyCameraPose(cameraFrom);
    transition = null;
    const fromOpen = openness ?? 0, toOpen = next === 'exploded' ? 1 : 0;
    setAssembly(toOpen);
    if(contextRoot)contextRoot.visible=contextVisibleForView(next);
    if(focus?.userData.demoPersonId)people?.update(camera,view);
    // Follow the projecting ninth floor, rather than fitting the enlarged whole tower.
    fitObject(focus ?? (next==='exploded' ? officeRoot : useHeroPriorityFraming(next)&&contextRoot ? model : buildingRoot), next==='exploded' ? ROOM_DIRECTION : VIEW_DIRECTION);
    if(cameraTarget)applyCameraPose(cameraTarget);
    const cameraTo = cameraPose();
    const shouldAnimate = animate && !motionPreference.matches;
    if (shouldAnimate) {
      setAssembly(fromOpen);
      applyCameraPose(cameraFrom);
      transition = {elapsed:0, duration:1050, fromOpen, toOpen, camera:{from:cameraFrom,to:cameraTo}};
    } else floorFocus.snap(toOpen === 1);
    people?.update(camera,interiorLabels ? 'exploded' : 'building');
    const state=getState();requestFrame();notify('view-changed',state);return state;
  }
  function cameraPose() {
    return {position:camera.position.clone(),target:controls.target.clone(),height:fitHeight,zoom:camera.zoom};
  }
  function applyCameraPose(pose) {
    camera.position.copy(pose.position); controls.target.copy(pose.target);
    fitHeight=pose.height; camera.zoom=pose.zoom; camera.lookAt(controls.target); resize();
  }
  // A drag/wheel gives the user camera control while assembly movement finishes.
  function takeCameraControl() { floorLabel?.cancel();if (transition) transition.camera=null; }
  function selectFloor(number) {
    if (!Number.isInteger(number) || number < 1 || number > FLOOR_COUNT) return;
    if (number === DETAILED_FLOOR) { setView('exploded'); selectTab('rooms'); }
    else {
      setView('building', { focus: floors.get(number) }); selectedFloor = number;
      paintState();
    }
    notify('floor-selected', { floorId: `H1-F${String(number).padStart(2,'0')}`, floorNumber: number, schematic: number !== 9 });
  }
  function focusRoom(id) {
    id=layout?.rooms?.find(r=>r.id===id)?.merged_into||id;
    const roomData = layout?.rooms?.find(item => item.id === id);
    if (!roomData) return false;
    setView('exploded', { focus: rooms.get(id) ?? officeRoot });
    selectedRoom = id; orbit?.focus(true); selectedFloor = 9; selectTab('rooms'); paintState();
    if (renderReady && rooms.has(id)) {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--astra-primary').trim() || '#284bd4';
      roomOutline = new THREE.BoxHelper(rooms.get(id), new THREE.Color(color));
      roomOutline.material.depthTest = false;
      roomOutline.renderOrder = 10;
      nightEnvironment?.prepareObject(roomOutline);scene.add(roomOutline);requestFrame();
    }
    notify('room-selected', { floorId: 'H1-F09', roomId: id }); return true;
  }
  function zoom(factor) {
    if (!renderReady) return;
    takeCameraControl();
    camera.zoom = THREE.MathUtils.clamp(camera.zoom*factor, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix(); requestFrame();
  }
  function resetCamera(top = false) {
    orbit?.focus(false);
    if (!renderReady) return;
    takeCameraControl();
    if (!top && focusOrigin) {
      setView(focusOrigin.view, {cameraTarget:focusOrigin.pose});
      return;
    }
    const target = selectedRoom && rooms.has(selectedRoom) ? rooms.get(selectedRoom) : view==='exploded' ? officeRoot : selectedFloor && view === 'building' ? floors.get(selectedFloor) : useHeroPriorityFraming(view)&&contextRoot ? model : buildingRoot;
    fitObject(target, top ? new THREE.Vector3(.001, 1, .001).normalize() : view==='exploded' ? ROOM_DIRECTION : VIEW_DIRECTION);
  }
  function disposeObject(object) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    object?.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      for (const material of (Array.isArray(child.material) ? child.material : child.material ? [child.material] : [])) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const item of [...textures, ...materials, ...geometries]) item.dispose();
  }
  function dispose() {
    suspendMotion();
    if (disposed) return;
    orbit?.dispose();
    disposed = true; renderReady = false; renderStatus = 'disposed'; aborter.abort();stopLoading();
    $('#office-theme-blue').disabled=true;
    unsubscribeBusiness();window.dispatchEvent(new Event('office-disposed'));
    miniatureFocus?.dispose();miniatureFocus=null;
    nightEnvironment?.dispose(); nightEnvironment=null;
    picture.dispose();
    officeBoard?.dispose();officeBoard=null;
    people?.dispose();seatLabels?.dispose();seatLabels=null;
    floorLabel?.dispose();
    roofLabels?.dispose();
    if (frame) cancelAnimationFrame(frame);
    frame = 0; transition = null;
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    for (const remove of listenerRemovers) remove();
    controls?.dispose(); clearOutline(); disposeObject(model);
    scene?.traverse(object => object.shadow?.dispose());
    renderer?.dispose(); renderer?.forceContextLoss();
    renderer?.domElement.remove();
    floors.clear(); rooms.clear(); movingFloors.length=0;
    controls = null; renderer = null; scene = null; model = null; buildingRoot = null; contextRoot = null; twinRoot = null; officeRoot = null; facade9 = null;
    $('#preview-fallback').hidden = false; $('#fallback-message').textContent = '三维资源已释放。刷新页面可重新打开。';
    status('已关闭'); document.documentElement.dataset.viewerStatus = 'disposed';
    notify('disposed');
  }

  const picture = createPictureSettings({listen,requestFrame,getRenderer:()=>renderer,allowTraffic:true,motionPreference});
  const porcelainPalette = mountPorcelainPalette($('#office-theme-blue'),listen,requestFrame);
  const orbitButton=document.createElement('button');orbitButton.type='button';orbitButton.className='btn btn-ghost btn-square btn-sm';orbitButton.id='office-orbit-toggle';
  $('#space-card-toggle').before(orbitButton);
  const paintOrbit=state=>{
    if(!state.running)wasOrbitRunning=false;
    const paused=state.paused||!state.enabled;
    orbitButton.disabled=motionPreference.matches||!state.enabled;
    orbitButton.title=motionPreference.matches?'已遵循减少动效':paused?'恢复自动环游':'暂停自动环游';
    orbitButton.setAttribute('aria-label',orbitButton.title);orbitButton.setAttribute('aria-pressed',String(!paused));
    orbitButton.innerHTML=icon(paused?'play':'pause');
    orbitButton.querySelector('svg').style.pointerEvents='none';
  };
  orbit=createOfficeOrbit({requestFrame,change:paintOrbit,canRun:()=>!getWorkstationEditState().open&&active()&&renderReady&&!motionPreference.matches&&!transition});
  bindOfficeCamera({listen,configure:value=>{
    orbit.configure(value);
    if(value.personFocusDistance===personFocusDistance)return;
    personFocusDistance=value.personFocusDistance;
    if(!personFrameHeight)return;
    // This orthographic camera frames a person by its visible height.
    const height=personFrameHeight*personFocusDistance/100;
    if(transition?.camera)transition.camera.to.height=height;
    else {fitHeight=height;resize();}
  }});
  function editWorkstations(event){
    const state=event.detail;people?.closeMenu();orbit.sync();resize();
    if(state.open&&(state.action==='all'||state.action==='focus'||view!=='exploded')){
      const seat=layout?.workstations.find(s=>s.seat_id===state.seatId);
      setView('exploded',{focus:state.action==='focus'&&seat?rooms.get(seat.room_id):null});
    }
    requestFrame();
  }
  listen(window,'office-workstations-change',editWorkstations);
  listen(window,'office-person-menu',event=>orbit.focus(event.detail.open));
  listen(orbitButton,'click',()=>orbit.toggle());
  releaseOrbitHold=bindOfficeOrbitHold({listen,document,window,orbit});
  for(const type of ['wheel','keydown'])listen(document,type,()=>orbit.activity(),{capture:true,passive:true});
  listen(document,'click',()=>{orbit.sync();orbit.activity();requestFrame();});
  listen(document,'input',()=>orbit.activity(),true);

  listen(window,'pageshow',event=>{if(event.persisted)location.reload();});
  listen(window,'storage',event=>{if(event.key===SETTINGS_KEY){$('#connection-state').textContent='配置已更新，刷新应用';$('#connection-state').title='另一标签页更新了本地配置，请刷新以同步沙盘和同事。';}});
  const api = Object.freeze({ setView, setTheme, setVisible, focusRoom, focusPerson:id=>people?.select(id)??false, selectFloor, getState, dispose });
  window.officeTwin = api;
  paintIcons(); setTheme(theme);
  listen($('#retry-model'),'click',()=>location.reload());
  listen($('#load-diagnostic-text'),'click',event=>event.target.select());
  loadingTimer=setInterval(renderLoading,1000);renderLoading();
  const download=$('#model-download');download.href=MODEL_URL.href;download.download=OFFICE_MODEL;
  bindModelDownload(download, MODEL_URL, { signal: aborter.signal });
  const info=$('#picture-info');info.title='滑块即时预览，保存参数后下次沿用；恢复默认不会覆盖已保存参数。明暗层次调节现有烘焙阴影的对比。';info.setAttribute('aria-label',info.title);
  $('#material-coverage').textContent=materialCoverageCopy(null).summary;
  listen($('#theme-toggle'), 'click', () => setTheme({ scheme: theme.scheme === 'light' ? 'dark' : 'light' }));
  listen($('#view-controls'), 'click', event => { const button = event.target.closest('[data-view]'); if (button) setView(button.dataset.view); });
  listen($('#back-building'), 'click', () => { setView('building'); selectTab('floors'); });
  listen($('#zoom-in'), 'click', () => zoom(1.25));
  listen($('#zoom-out'), 'click', () => zoom(.8));
  listen($('#reset-camera'), 'click', () => resetCamera());
  listen($('#top-camera'), 'click', () => resetCamera(true));
  listen($('#tab-floors'), 'click', () => selectTab('floors'));
  listen($('#tab-rooms'), 'click', () => selectTab('rooms'));
  listen($('#tab-people'), 'click', () => {
    selectTab('people');
    if(view!=='exploded')setView('exploded');
    window.dispatchEvent(new CustomEvent('office-panel',{detail:{tab:'people'}}));
  });
  listen(viewport, 'keydown', event => {
    if (['+','=','-','Home','Escape'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Home') resetCamera(); else if (event.key === 'Escape') setView('building'); else zoom(event.key === '-' ? .8 : 1.25);
    }
  });
  listen(window,'office-admin-visibility',()=>{orbit.sync();if(active()){requestFrame();}else{frameMeter.suspend();people?.suspend();suspendMotion();if(frame){cancelAnimationFrame(frame);frame=0;}}});
  listen(document, 'visibilitychange', () => { orbit.sync();if(!active()){frameMeter.suspend();people?.suspend();suspendMotion();} if (active()) requestFrame(); else if (frame) { cancelAnimationFrame(frame); frame = 0; } });
  listen(window, 'pagehide', event => {
    if (event.persisted) {
      pageSuspended = true;frameMeter.suspend();suspendMotion();orbit.sync();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else dispose();
  });
  listen(window, 'pageshow', event => {
    if (event.persisted && !disposed) { pageSuspended = false; resize(); requestFrame(); }
  });
  listen(window, 'message', event => {
    if (!embedded || !isTrustedHostMessage(event, window.parent, location.origin)) return;
    const message = event.data;
    try {
      if (message.type === 'theme' && message.theme) setTheme(message.theme);
      else if (message.type === 'visibility' && typeof message.visible === 'boolean') setVisible(message.visible);
      else if (message.type === 'view' && resolveView(message.view)) setView(message.view);
      else if (message.type === 'focus-room' && typeof message.roomId === 'string') focusRoom(message.roomId);
      else if (message.type === 'focus-person' && typeof message.employeeId === 'string') notify('person-focused',{employeeId:message.employeeId,found:people?.select(message.employeeId)??false,requestId:String(message.requestId||'').slice(0,64)});
      else if (message.type === 'set-context') {
        if(typeof message.contextId!=='string'||!message.contextId||message.contextId.length>100||!Number.isSafeInteger(message.revision)||message.revision<1)throw new Error('上下文格式无效');
        if(message.revision<=bridgeContext.revision)throw new Error('上下文版本已过期');
        bridgeContext={id:message.contextId,revision:message.revision};notify('context-set',{...bridgeContext,requestId:String(message.requestId||'').slice(0,64)});
      }
      else if (message.type === 'office-event') {
        if(!bridgeContext.id||message.contextId!==bridgeContext.id||message.revision!==bridgeContext.revision||typeof message.requestId!=='string'||!message.requestId||message.requestId.length>64)throw new Error('事件与当前上下文不一致');
        const requestId=message.requestId,contextId=bridgeContext.id;
        officeClient.send(message.event).then(result=>{if(!disposed)notify('event-accepted',{...result,requestId,contextId});}).catch(error=>{if(!disposed)notify('error',{code:'EVENT_REJECTED',message:error.message,requestId,contextId});});
      }
      else if (message.type === 'get-state') notify('state', { ...getState(), requestId: typeof message.requestId === 'string' ? message.requestId.slice(0,64) : null });
      else if (message.type === 'dispose') dispose();
    } catch (error) { notify('error', { code: 'INVALID_MESSAGE', message: error.message, requestId: typeof message.requestId==='string'?message.requestId.slice(0,64):null }); }
  });

  async function getJSON(name) {
    const response = await fetch(new URL(name, DATA_ROOT), { signal: aborter.signal });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.json();
  }
  const data = await Promise.allSettled([getJSON('office_layout.json'), getJSON('model_metadata.json'), getJSON('building_metadata.json'), getJSON('furniture_integration.json')]);
  if (disposed) return api;
  layout = data[0].status === 'fulfilled' ? data[0].value : null;
  if(layout){const local=readSettings(layout);officeName=local.config.officeName;layout=applyRoomLabels(layout,local.config);applyOfficeNameDOM(local.config);}
  officeMetadata = data[1].status === 'fulfilled' ? data[1].value : null;
  buildingMetadata = data[2].status === 'fulfilled' ? data[2].value : null;
  furnitureIntegration = data[3].status === 'fulfilled' ? data[3].value : null;
  createLists(); paintState(); paintFurnitureInfo();
  if (data.slice(0,3).some(result => result.status === 'rejected')) $('#package-info').textContent = '部分模型说明数据未加载；可用空间资料仍可查看。';

  try {
    loadingStage('webgl','正在初始化三维显示');
    scene = new THREE.Scene();
    // Identity scene root must not force every static descendant dirty each frame.
    scene.updateMatrix();scene.matrixAutoUpdate=false;
    camera = new THREE.OrthographicCamera(-50,50,50,-50,.1,1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.info.autoReset=false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = picture.getState().realtimeShadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = false;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    canvasHost.append(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .12;controls.autoRotateSpeed=.22;
    controls.maxZoom = 15;
    Object.assign(controls,officeCameraLimits(view));
    listen(controls, 'change', requestFrame);
    listen(controls, 'start', takeCameraControl);
    listen(motionPreference, 'change', ()=>{orbit.sync();requestFrame();});
    const ambient = new THREE.HemisphereLight(0xffffff, 0xe0e4e6, .8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-65,135,90); key.target.position.set(0,30,0);
    key.castShadow = true; key.shadow.mapSize.set(2048,2048);
    Object.assign(key.shadow.camera, { left:-90, right:90, top:90, bottom:-90, near:1, far:300 });
    key.shadow.bias = -.0005; key.shadow.normalBias = .06;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xeaf0ff, .45);
    fill.position.set(80,60,-60); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff,.25);
    rim.position.set(-20,100,-80);scene.add(rim);
    setTheme(theme);
    loadingStage('download','正在连接模型文件');
    const fetchStarted=performance.now();
    const modelBytes=await loadModelBytes(MODEL_URL, { signal: aborter.signal,
      onState: transportState,
      onProgress: (loaded,total) => {
        const bar=$('#model-progress');
        loadingStage('download',`正在读取模型 ${formatMB(loaded)}`+(total?` / ${formatMB(total)} · ${Math.min(100,Math.floor(loaded/total*100))}%`:''));
        if(total){bar.max=total;bar.value=loaded;}else bar.removeAttribute('value');
      } });
    loadReport.decodedModelBytes=modelBytes.byteLength;
    loadReport.fetchMs=Math.round((performance.now()-fetchStarted)*10)/10;
    loadingStage('parse','下载与校验完成，正在解析模型和纹理');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const parseStarted=performance.now();
    const gltf = await new GLTFLoader().parseAsync(modelBytes, new URL('../models/', import.meta.url).href);
    loadReport.parseMs=Math.round((performance.now()-parseStarted)*10)/10;
    if (disposed) { disposeObject(gltf.scene); return api; }
    loadingStage('scene','正在准备模型材质与场景');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    model = gltf.scene;
    buildingRoot = model.getObjectByName('H1_Building');
    contextRoot = model.getObjectByName('ContextBuildings');
    twinRoot = contextRoot?.getObjectByName('H3_Building');
    officeRoot = model.getObjectByName('H1_F09_Office');
    facade9 = model.getObjectByName('Facade_09');
    for (let number=1; number<=FLOOR_COUNT; number++) {
      const object = model.getObjectByName(`Floor_${String(number).padStart(2,'0')}`);
      if (!object) continue;
      floors.set(number,object);
      const {offsetY,offsetZ} = floorPresentation(number,'exploded');
      if (offsetY || offsetZ) movingFloors.push({object, original:object.position.clone(),
        offset:new THREE.Vector3(0,offsetY,offsetZ)});
    }
    if (!buildingRoot || !officeRoot || !facade9 || floors.size !== FLOOR_COUNT) {
      const error = new Error('H1_Building / 20 Floor nodes / Facade_09 / H1_F09_Office required');
      error.code = 'MODEL_CONTRACT'; throw error;
    }
    model.traverse(object => {
      if (object.userData.entity_type === 'room' && object.userData.room_id) rooms.set(object.userData.room_id, object);
      if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    // Names are retained as a fallback for the unchanged v0.1 office export.
    for (const room of layout?.rooms ?? []) if (!rooms.has(room.id)) {
      const object = model.getObjectByName(`Room_${room.id}`); if (object) rooms.set(room.id,object);
    }
    scene.add(model);
    isolateContextMaterials(buildingRoot,contextRoot);
    hideBoardCore(officeRoot);
    loadReport.removedWorkstationTowers=0;
    officeRoot.traverse(object=>{
      if(object.userData.furniture_asset_id!=='tower')return;
      loadReport.removedWorkstationTowers++;
      object.traverse(part=>{part.visible=false;});
    });
    staticBatches=batchStaticGeometry(model);
    cacheStaticTransforms(model);
    streetTraffic=createStreetTraffic(contextRoot);
    await yieldToBrowser();if(disposed)return api;
    picture.attach({key,fill,ambient,rim},model);
    await yieldToBrowser();if(disposed)return api;
    loadReport.materialPaths=summarizeMaterialPaths(model);
    const coverage=materialCoverageCopy(loadReport.materialPaths);
    $('#material-coverage').textContent=coverage.summary;info.title=coverage.summary;info.setAttribute('aria-label',info.title);
    loadReport.colorPipeline={outputColorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping,toneMappingExposure:renderer.toneMappingExposure,bakedMaps:"Porcelain / directional daylight and horizon occlusion, Standard sRGB",unlitSolids:"linear baseColor/COLOR_0 forwarded, no inferred AgX conversion",physicalShadows:"lit PBR only; unlit ignores receiveShadow"};
    const seenTextures=new Set();
    model.traverse(object=>{
      for(const mat of (Array.isArray(object.material)?object.material:object.material?[object.material]:[])){
        if(!mat.map||seenTextures.has(mat.map))continue;
        seenTextures.add(mat.map);
        loadReport.textures.push({name:mat.map.name,width:mat.map.image?.width??null,
          height:mat.map.image?.height??null,anisotropy:mat.map.anisotropy,
          colorSpace:mat.map.colorSpace,toneMapped:mat.toneMapped});
      }
    });
    loadReport.modelReadyMs=Math.round((performance.now()-loadStarted)*10)/10;
    loadingStage('gpu','模型已解析，正在准备显卡资源与首帧');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    renderReady = true;
    people = createPeopleDemo({onRebuild:()=>nightEnvironment?.refresh(scene),scene,model,layout,viewport,listen,requestFrame,getPicture:()=>picture.getState(),onSelect:employeeId=>notify('person-selected',{employeeId,contextId:bridgeContext.id}),onCandidates:employeeIds=>notify('review-candidates-changed',{employeeIds,contextId:bridgeContext.id,demo:true}),focusPerson:group=>{
      setView('exploded',{focus:group});orbit.focus(true);people.update(camera,view);
    }});
    people.syncBusiness(business);
    seatLabels=createWorkstationLabels({model,layout,viewport,listen,requestFrame});
    nightEnvironment=createNightEnvironment({scene,renderer,camera,layout,porcelainPalette,streetTraffic,requestFrame,getExposure:()=>picture.getRenderSettings().exposure,getBlue:()=>picture.getRenderSettings().blue,getSettings:picture.getRenderSettings});
    nightEnvironment.attach(scene);nightEnvironment.setTheme(theme.scheme);
    officeBoard=createOfficeBoard({office:officeRoot,viewport,requestFrame,scheme:theme.scheme,snapshot:business});
    roofLabels=createRoofLabels(model,viewport,requestFrame);
    await nightEnvironment.prepare();if(disposed)return api;
    const gpuStarted=performance.now();
    miniatureFocus=createMiniatureFocus(renderer,scene,camera,model,floors.get(DETAILED_FLOOR));
    await prepareRenderer(renderer,scene,camera,()=>disposed,nightEnvironment.passMaterials(),miniatureFocus);
    if(disposed)return api;
    warmOfficeSurfaces(renderer,scene,camera,[officeRoot,people.root],nightEnvironment,miniatureFocus);
    officeBoard.setView(view);
    loadReport.gpuPrepareMs=Math.round(performance.now()-gpuStarted);
    gpuPrepared=true;
    floorLabel=createFloorLabel({viewport,facade:facade9,camera,listen,getView:()=>view,canPreview:()=>active()&&renderStatus==='ready'&&view==='building',requestFrame,
      beginPreview:()=>{previewCamera=cameraPose();setView('exploded',{labelPreview:true});},
      endPreview:()=>{setView('building',{labelPreview:true,cameraTarget:previewCamera,animate:active()});previewCamera=null;},
      enter:()=>{
        previewCamera=null;
        if(view!=='exploded')setView('exploded');
        else requestFrame();
      }});
    resizeObserver = new ResizeObserver(resizeLayout);
    for(const panel of [viewport,$('#space-cards-panel'),$('#host-artifact')])if(panel)resizeObserver.observe(panel);
    intersectionObserver = new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);if(!inView)releaseOrbitHold?.();orbit.sync();if(!active()){frameMeter.suspend();people?.suspend();suspendMotion();}
      if (active()) requestFrame(); else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    });
    intersectionObserver.observe(viewport);
    listen(renderer.domElement, 'webglcontextlost', event => {
      event.preventDefault(); fail(new Error('WebGL context lost'));
      if (frame) cancelAnimationFrame(frame); frame = 0;
    });
    const pointerStart = new THREE.Vector2();let pointerMoved=false;
    listen(renderer.domElement, 'pointerdown', event => {pointerStart.set(event.clientX,event.clientY);pointerMoved=false;});
    listen(renderer.domElement, 'pointermove', event => {if(event.buttons&&pointerStart.distanceTo(new THREE.Vector2(event.clientX,event.clientY))>5)pointerMoved=true;},true);
    listen(renderer.domElement, 'click', event => {
      if (getWorkstationEditState().open || transition || pointerMoved || event.button !== 0 || pointerStart.distanceTo(new THREE.Vector2(event.clientX,event.clientY)) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(pointer,camera);
      if (view === 'building') {
        const hit=ray.intersectObjects(twinRoot?[buildingRoot,twinRoot]:[buildingRoot],true).find(visibleSceneHit);
        const number=hit?firstVisibleFloorHit([hit],floors):null;
        if(number!==null)selectFloor(number);
        return;
      }
      if (people?.pick(ray,{x:event.clientX,y:event.clientY})) return;
      const officeHits=ray.intersectObject(officeRoot,true).filter(visibleSceneHit);
      const back=outsideView(view,officeHits.length?officeHits:ray.intersectObject(buildingRoot,true));
      if(back){people?.closeMenu();setView(back);return;}
      for (const hit of officeHits) {
        let node = hit.object;
        while (node && node !== officeRoot) { if (rooms.get(node.userData.room_id) === node) { focusRoom(node.userData.room_id); return; } node = node.parent; }
      }
    });
    const dragVisual=createPersonDragOverlay({renderer,scene,camera,getPerson:people.object,getShape:people.hitShape,setOverlay:people.dragOverlay});
    const pointer=bindPersonPointer({canvas:renderer.domElement,camera,controls,people,listen,canInteract:()=>!getWorkstationEditState().open&&active()&&view==='exploded',takeCameraControl,dragVisual});
    listenerRemovers.push(()=>pointer.dispose());
    loadingStage('first-frame','场景已就绪，正在绘制第一帧');
    setView(view, {animate:false});
    selectTab('people');

  } catch (error) { fail(error); }
  return api;
}
