from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .paths import PROJECT_ROOT, RUNTIME_DIR
from .settlement_audit import RULE_VERSION, SettlementAuditEngine, SettlementAuditError


router = APIRouter(prefix="/api/settlement-audit", tags=["settlement-audit"])

MAX_SETTLEMENT_FILE_BYTES = 64 * 1024 * 1024
SETTLEMENT_AUDIT_RUNTIME_DIR = RUNTIME_DIR / "settlement-audit"
SETTLEMENT_REFERENCE_DIR = (
    PROJECT_ROOT
    / "03-知识库-二维数据库制作"
    / "05-260729-【结算】【前辈经验】结算和投标限价相关资料"
)
SETTLEMENT_REFERENCE_TEMPLATE = (
    SETTLEMENT_REFERENCE_DIR / "【结算模板】260723-勘察测量结算统一报价模板-v1.0.xlsx"
)
SETTLEMENT_SAMPLE_PATH = (
    PROJECT_ROOT
    / "00-PRD"
    / "01-模块PRD"
    / "10-结算审核助手模块"
    / "evals"
    / "结算审核演示样例-v0.1.xlsx"
)
JOB_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def _public_result(result: dict, job_id: str) -> dict:
    payload = dict(result)
    payload["job_id"] = job_id
    payload["downloads"] = {
        "excel": f"/api/settlement-audit/download/{job_id}/excel",
        "report": f"/api/settlement-audit/download/{job_id}/report",
        "result": f"/api/settlement-audit/download/{job_id}/result",
    }
    return payload


@router.get("/profile")
def settlement_audit_profile() -> dict[str, object]:
    return {
        "module": "settlement-audit",
        "name": "结算审核助手",
        "rule_version": RULE_VERSION,
        "status": "competition-demo",
        "supported_extensions": [".xlsx"],
        "max_file_mb": MAX_SETTLEMENT_FILE_BYTES // (1024 * 1024),
        "sample_available": SETTLEMENT_SAMPLE_PATH.is_file(),
        "rule_cards": [
            {"id": "JS-001", "name": "模板基价与系数", "mode": "deterministic"},
            {"id": "JS-002", "name": "明细金额算术", "mode": "deterministic"},
            {"id": "JS-003", "name": "深孔大于 300m", "mode": "deterministic"},
            {"id": "JS-004", "name": "室内试验技术费", "mode": "deterministic"},
            {"id": "JS-005", "name": "航测与走向图技术费", "mode": "deterministic"},
            {"id": "JS-006", "name": "其他费用全列合计", "mode": "deterministic"},
            {"id": "JS-007", "name": "其他费用证据", "mode": "manual-review"},
            {"id": "JS-008", "name": "框架与下浮参数", "mode": "manual-review"},
            {"id": "JS-009", "name": "工程量、成果与签章", "mode": "manual-review"},
        ],
        "boundary": "规则辅助审核，人工最终审定；不改变最高投标限价填价、经验池或知识库逻辑。",
    }


@router.get("/sample")
def download_settlement_audit_sample() -> FileResponse:
    if not SETTLEMENT_SAMPLE_PATH.is_file():
        raise HTTPException(status_code=404, detail="结算审核演示样例尚未生成。")
    return FileResponse(
        SETTLEMENT_SAMPLE_PATH,
        filename=SETTLEMENT_SAMPLE_PATH.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/review")
async def review_settlement_workbook(
    file: UploadFile = File(...),
    project_name: str = Form(""),
) -> dict:
    source_name = Path(file.filename or "结算审核.xlsx").name
    if Path(source_name).suffix.lower() != ".xlsx":
        raise HTTPException(
            status_code=400,
            detail="当前仅支持前辈统一模板及同结构的 .xlsx 文件，不支持旧版 .xls。",
        )

    content = await file.read(MAX_SETTLEMENT_FILE_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="上传文件为空。")
    if len(content) > MAX_SETTLEMENT_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"文件超过 {MAX_SETTLEMENT_FILE_BYTES // (1024 * 1024)} MB 限制。",
        )

    job_id = uuid4().hex
    job_dir = SETTLEMENT_AUDIT_RUNTIME_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    input_path = job_dir / f"原始上传{Path(source_name).suffix.lower()}"
    input_path.write_bytes(content)

    try:
        engine = SettlementAuditEngine(SETTLEMENT_REFERENCE_TEMPLATE)
        result = engine.review(
            input_path,
            job_dir,
            source_name=source_name,
            project_name=project_name.strip() or None,
        )
    except SettlementAuditError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"结算辅助审核失败：{exc}") from exc

    public_result = _public_result(result, job_id)
    result_path = job_dir / result["artifacts"]["result"]
    result_path.write_text(json.dumps(public_result, ensure_ascii=False, indent=2), encoding="utf-8")
    return public_result


@router.get("/download/{job_id}/{kind}")
def download_settlement_audit_artifact(job_id: str, kind: str) -> FileResponse:
    if not JOB_ID_PATTERN.fullmatch(job_id):
        raise HTTPException(status_code=404, detail="结算审核任务不存在。")
    if kind not in {"excel", "report", "result"}:
        raise HTTPException(status_code=404, detail="未知的结算审核成果类型。")

    job_dir = SETTLEMENT_AUDIT_RUNTIME_DIR / job_id
    result_path = job_dir / "审核结果.json"
    if not result_path.is_file():
        raise HTTPException(status_code=404, detail="结算审核任务不存在或成果尚未完成。")
    try:
        result = json.loads(result_path.read_text(encoding="utf-8"))
        artifact_name = result["artifacts"][kind]
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="结算审核成果索引损坏。") from exc

    artifact_path = (job_dir / artifact_name).resolve()
    if not artifact_path.is_relative_to(job_dir.resolve()) or not artifact_path.is_file():
        raise HTTPException(status_code=404, detail="结算审核成果不存在。")
    media_type = {
        "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "report": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "result": "application/json",
    }[kind]
    return FileResponse(artifact_path, filename=artifact_path.name, media_type=media_type)
