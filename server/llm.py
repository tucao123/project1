"""模型统一入口（PRD §9：LangChain ChatModel 统一接口）。

Supervisor 与 Worker 的模型 / 温度全部从这里取，不在多处硬编码同一模型。
留空密钥时返回降级结果，调用方改用规则输出，服务不会因缺密钥而启动失败。
"""

from __future__ import annotations

from typing import Any

from .config import get_settings


def model_for(role: str) -> str:
    s = get_settings()
    return s.llm_model_supervisor if role == "supervisor" else s.llm_model_worker


def temperature_for(role: str) -> float:
    s = get_settings()
    return s.llm_temperature_supervisor if role == "supervisor" else s.llm_temperature_worker


def build_chat_model(role: str):
    """完整流水线用：LangChain ChatModel 统一接口。缺依赖时返回 None。"""
    try:
        from langchain_openai import ChatOpenAI
    except ImportError:
        return None
    s = get_settings()
    return ChatOpenAI(
        model=model_for(role),
        temperature=temperature_for(role),
        api_key=s.llm_api_key or "unused",
        base_url=s.llm_base_url,
        timeout=max(1, s.llm_timeout_ms / 1000),
    )


def _compatible_chat(role: str, prompt: str) -> str | None:
    """骨架用 OpenAI 兼容 HTTP，避免强依赖 LangChain 也能连通模型。"""
    import httpx

    s = get_settings()
    headers = {"Content-Type": "application/json"}
    if s.llm_api_key:
        headers["Authorization"] = f"Bearer {s.llm_api_key}"
    response = httpx.post(
        f"{s.llm_base_url.rstrip('/')}/chat/completions",
        headers=headers,
        json={
            "model": model_for(role),
            "temperature": temperature_for(role),
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=max(1, s.llm_timeout_ms / 1000),
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def complete(role: str, prompt: str) -> dict[str, Any]:
    s = get_settings()
    if not s.llm_ready:
        return {"ok": False, "mode": "local-fallback", "text": None, "reason": "未配置模型凭据"}
    try:
        chat_model = build_chat_model(role)
        if chat_model is not None:
            result = chat_model.invoke(prompt)
            return {"ok": True, "mode": "langchain-chatmodel", "text": getattr(result, "content", str(result))}
        text = _compatible_chat(role, prompt)
        return {"ok": True, "mode": "openai-compatible", "text": text}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "mode": "local-fallback", "text": None, "reason": str(exc)[:160]}


def route_table() -> dict[str, Any]:
    """/health 展示：确认各角色模型/温度来自单一配置源。"""
    s = get_settings()
    return {
        "provider": s.llm_provider,
        "base_url": s.llm_base_url,
        "roles": {
            "supervisor": {"model": s.llm_model_supervisor, "temperature": s.llm_temperature_supervisor},
            "worker": {"model": s.llm_model_worker, "temperature": s.llm_temperature_worker},
            "grader": {"model": s.llm_model_supervisor, "temperature": 0.0},
        },
        "ready": s.llm_ready,
    }
