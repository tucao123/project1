"""RFR FastAPI 服务端骨架。

启动：pip install -r server/requirements.txt && uvicorn server.main:app --port 8000
容器：docker compose --env-file .env.server up -d --build

设计原则：所有外部依赖（MySQL / Qdrant / 模型）都可选。
没配置或连不上时服务照常启动，/health 如实标注降级原因，不假装已接线。
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import db, embedding, guard, llm, vector
from .config import WARNINGS, degradation_report, get_settings, public_dict

STARTUP: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    """启动自检：能建的建，不能建的如实记录，绝不因此阻断服务。"""
    STARTUP["schema"] = db.init_schema()
    STARTUP["collection"] = vector.ensure_collection()
    STARTUP["checkpointer"] = "ready" if db.make_checkpointer() else "degraded"
    yield


app = FastAPI(title="RFR 服务端骨架", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    s = get_settings()
    dependencies = {
        "mysql": db.ping(),
        "qdrant": vector.status(),
        "llm": llm.route_table(),
    }
    # 配置齐了但运行时连不上，也要如实说出来，不能只报「已配置」
    runtime_notes = [
        f"{name} 运行时不可用：{info.get('detail')}"
        for name, info in dependencies.items()
        if isinstance(info, dict) and info.get("ok") is False
    ]
    return {
        "status": "ok",
        "service": "rfr-server",
        "config": public_dict(s),
        "dependencies": dependencies,
        "startup": STARTUP,
        "degraded": degradation_report(s) + runtime_notes,
        "warnings": list(WARNINGS),
        "prd_constraints": {
            "checkpointer_setup": "PyMySQLSaver.setup() + autocommit=True",
            "qdrant_named_vectors": ["dense", "sparse"],
            "payload_indexes": list(vector.PAYLOAD_INDEX_FIELDS),
            "embedding_batch": embedding.batch_plan(35),
            "crag_max_rewrite": s.max_rewrite,
            "guard": "rule-based" if s.guard_enabled else "off",
            "feedback_consent_default": s.feedback_consent_default,
            "aggregate_min_sample": s.aggregate_min_sample,
        },
    }


async def _accept(request: Request, kind: str) -> dict:
    try:
        raw = await request.json()
    except Exception:  # noqa: BLE001 - 上报内容不合法时仍返回可读响应
        raw = {}
    payload: dict[str, Any] = raw if isinstance(raw, dict) else {"value": raw}
    text = str(payload.get("freeText") or payload.get("free_text") or payload.get("text") or "")
    checked = guard.check_input(text)
    stored = db.record_event(kind, payload)
    return {
        "ok": True,
        "kind": kind,
        "guard": checked,
        "stored": stored.get("stored", False),
        "mode": "server" if stored.get("stored") else "degraded",
        "reason": stored.get("reason"),
    }


# 路径与前端 .env 的 VITE_API_*_PATH 一一对应
@app.post("/api/v1/intake")
async def intake(request: Request) -> dict:
    return await _accept(request, "intake")


@app.post("/api/v1/rehearsal")
async def rehearsal(request: Request) -> dict:
    return await _accept(request, "rehearsal")


@app.post("/api/v1/profile")
async def profile(request: Request) -> dict:
    return await _accept(request, "profile")


@app.post("/api/v1/script")
async def script(request: Request) -> dict:
    return await _accept(request, "script")


@app.post("/api/v1/feedback")
async def feedback(request: Request) -> dict:
    return await _accept(request, "feedback")


@app.get("/api/v1/events")
async def events(request: Request):
    """SSE 骨架：预演关键节点推送。真实图执行事件在完整流水线里接入。"""
    s = get_settings()

    async def stream():
        if not s.sse_enabled:
            yield f"data: {json.dumps({'event': 'sse_disabled'}, ensure_ascii=False)}\n\n"
            return
        for tick in range(20):
            if await request.is_disconnected():
                break
            yield "data: " + json.dumps(
                {"event": "heartbeat", "tick": tick, "mode": "skeleton"}, ensure_ascii=False
            ) + "\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/v1/evidence")
async def evidence(start_id: str = "stressor:临时取消", depth: int = 4) -> dict:
    """MySQL 8 递归 CTE 证据回溯（PRD §5.2）。"""
    return db.evidence_chain(start_id, depth)


@app.get("/api/v1/aggregate")
async def aggregate(tenant_id: str = "public") -> dict:
    """B 端脱敏：只查聚合快照，低于最小样本量不返回分布。"""
    return db.aggregate_distribution(tenant_id)


@app.delete("/api/v1/users/{user_id}")
async def delete_user(user_id: str) -> dict:
    """一键删除：关系表 + checkpointer 历史 + Qdrant payload 与向量。"""
    s = get_settings()
    return {
        "ok": True,
        "user_id": user_id,
        "sla_hours": s.delete_sla_hours,
        "mysql": db.purge_user(user_id),
        "qdrant": vector.purge_user(user_id),
    }


@app.post("/api/v1/guard/check")
async def guard_check(request: Request) -> dict:
    """供回归集验证规则级拦截；输出侧与输入侧分别返回。"""
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        payload = {}
    text = str(payload.get("text") or "") if isinstance(payload, dict) else ""
    return {"input": guard.check_input(text), "output": guard.check_output(text)}
