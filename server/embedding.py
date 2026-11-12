"""Qwen-embedding3 / sparse 向量（PRD §9 与风险一）。

硬性约束：
  - dimensions 必须显式传给接口，否则默认维度会让 Qdrant collection 不匹配
  - 单次调用批量上限 20（text-embedding-v3 保守取 10），超出必须拆批
  - sparse 向量用 FastEmbed Qdrant/bm25，不由 Qwen 生成

留空 LLM_API_KEY 时自动降级为本地确定性向量，维度仍与配置一致，服务可启动自检。
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import Any

from .config import ALLOWED_EMBEDDING_DIMS, EMBEDDING_BATCH_HARD_CAP, get_settings


def _local_dense(text: str, dim: int) -> list[float]:
    """无密钥时的确定性占位向量：同一文本永远得到同一向量，维度严格匹配。"""
    seed = hashlib.sha256(text.encode("utf-8")).digest()
    values: list[float] = []
    while len(values) < dim:
        seed = hashlib.sha256(seed).digest()
        values.extend((byte / 255.0) - 0.5 for byte in seed)
    values = values[:dim]
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def _remote_batch(batch: list[str]) -> list[list[float]]:
    """OpenAI 兼容 /embeddings；显式 dimensions，逐批调用。"""
    import httpx

    s = get_settings()
    response = httpx.post(
        f"{s.llm_base_url.rstrip('/')}/embeddings",
        headers={
            "Authorization": f"Bearer {s.llm_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": s.embedding_model,
            "input": batch,
            "dimensions": s.embedding_dimensions,  # 显式维度（PRD §9）
        },
        timeout=max(1, s.embedding_timeout_ms / 1000),
    )
    response.raise_for_status()
    data = sorted(response.json().get("data", []), key=lambda item: item.get("index", 0))
    vectors = [item["embedding"] for item in data]
    if any(len(v) != s.embedding_dimensions for v in vectors):
        raise ValueError("返回向量维度与 EMBEDDING_DIMENSIONS 不一致")
    return vectors


def embed(texts: list[str]) -> dict:
    s = get_settings()
    if not texts:
        return {"ok": True, "mode": "empty", "vectors": [], "batches": 0}
    if s.embedding_dimensions not in ALLOWED_EMBEDDING_DIMS:
        return {"ok": False, "detail": "维度不在允许列表内", "vectors": []}
    if not s.embedding_ready:
        return {
            "ok": True,
            "mode": "local-fallback",
            "vectors": [_local_dense(t, s.embedding_dimensions) for t in texts],
            "batches": 0,
        }

    # 拆批：以配置的 batch 为准，并再次钳到官方硬上限 20
    size = min(max(1, s.embedding_batch_size), EMBEDDING_BATCH_HARD_CAP)
    chunks = [texts[i : i + size] for i in range(0, len(texts), size)]
    vectors: list[list[float]] = []
    try:
        for chunk in chunks:
            vectors.extend(_remote_batch(chunk))
        return {"ok": True, "mode": "qwen-embedding3", "vectors": vectors, "batches": len(chunks)}
    except Exception as exc:  # noqa: BLE001 - 模型不可用时不阻断服务
        return {
            "ok": True,
            "mode": "local-fallback",
            "vectors": [_local_dense(t, s.embedding_dimensions) for t in texts],
            "batches": len(chunks),
            "detail": f"远程 embedding 失败已降级：{str(exc)[:120]}",
        }


def sparse_encode(text: str) -> dict:
    """FastEmbed Qdrant/bm25；缺包时降级为词哈希稀疏表示，保证 Hybrid Query 仍有 sparse 子查询。"""
    s = get_settings()
    try:
        from fastembed import SparseTextEmbedding

        model = SparseTextEmbedding(model_name=s.sparse_model)
        point = next(iter(model.embed([text])))
        return {
            "ok": True,
            "mode": "fastembed",
            "indices": point.indices.tolist(),
            "values": point.values.tolist(),
        }
    except Exception:  # noqa: BLE001
        tokens = re.findall(r"[\w\u4e00-\u9fff]+", text.lower())
        weights: dict[int, float] = {}
        for token in tokens:
            idx = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:8], 16) % 100000
            weights[idx] = weights.get(idx, 0.0) + 1.0
        return {
            "ok": True,
            "mode": "local-fallback",
            "indices": list(weights.keys()),
            "values": list(weights.values()),
        }


def batch_plan(count: int) -> dict[str, Any]:
    """供 /health 与回归集核对分片逻辑，不产生真实调用。"""
    s = get_settings()
    size = min(max(1, s.embedding_batch_size), EMBEDDING_BATCH_HARD_CAP)
    return {
        "count": count,
        "batch_size": size,
        "hard_cap": EMBEDDING_BATCH_HARD_CAP,
        "batches": math.ceil(count / size) if count else 0,
        "dimensions": s.embedding_dimensions,
        "model": s.embedding_model,
    }
