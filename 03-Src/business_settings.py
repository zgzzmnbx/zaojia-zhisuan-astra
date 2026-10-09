"""Shared Astra operation preferences; task parameters remain frozen in process-state."""
import json
from fastapi import APIRouter, Body, HTTPException

router=APIRouter(prefix='/api/astra/business-settings')
DEFAULT={'revision':0,'matchingMode':'mechanical','onlyMatchRowsWithValue':True,'matchValueFilterField':'数量','outputMatchReport':True,'mergeVerticalCells':True,'mergeHorizontalCells':True}
def filename():
    from app import paths
    return paths.RUNTIME_DIR/'astra-working-assets'/'business-settings.json'
@router.get('')
def read():
    try: return {**DEFAULT,**json.loads(filename().read_text(encoding='utf-8'))}
    except FileNotFoundError: return dict(DEFAULT)
@router.put('')
def save(payload:dict=Body(...)):
    current=read()
    if payload.get('revision')!=current['revision']: raise HTTPException(409,'编制设置已被其他窗口修改，请重新读取后保存')
    if payload.get('matchingMode') not in {'mechanical','ai_enhanced'}:raise HTTPException(400,'编制模式无效')
    field=str(payload.get('matchValueFilterField','')).strip()
    from app import main as engine
    try: field=engine._parse_warning_filter_field(field)
    except ValueError as exc: raise HTTPException(400,str(exc)) from exc
    clean={key:payload.get(key,DEFAULT[key]) for key in DEFAULT}
    for key in ['onlyMatchRowsWithValue','outputMatchReport','mergeVerticalCells','mergeHorizontalCells']:
        if type(clean[key]) is not bool:raise HTTPException(400,'编制开关必须为布尔值')
    clean.update(revision=current['revision']+1,matchValueFilterField=field)
    filename().parent.mkdir(parents=True,exist_ok=True)
    engine.atomic_json(filename(),clean)
    return clean
