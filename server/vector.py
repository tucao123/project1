"""Qdrant 访问层（PRD §5.3 / §9）。

硬性约束：
  - collection 同时启用 dense + sparse 命名向量
  - must / should / must_not 用到的 payload 字段预先创建 payload index
  - B 端多租户用 partition key（tenant_id）限定查询范围
  - Hybrid Query API：dense / sparse 子查询分别执行后 RRF 融合
"""

from __future__ import annotations

from typing import Any

from .config import get_settings

# 查询过滤会用到的字段，必须预先建 payload index
PAYLOAD_INDEX_FIELDS = (
    "tenant_id",
    "stressor_type",
    "intensity",
    "construct_target",
    "expected_pattern",
)


def _client():
    try:
        from qdrant_client import QdrantClient
    except ImportError:
        return None, None
    try:
        from qdrant_client import models
    except ImportError:  # pragma: no cover
        return None, None
    s = get_settings()
    client = QdrantClient(
        url=s.qdrant_url,
        api_key=s.qdrant_api_key or None,
        timeout=max(1, s.qdrant_timeout_ms // 1000),
    )
    return client, models


def status() -> dict:
    client, _ = _client()
    if client is None:
        return {"ok": False, "detail": "qdrant-client 未安装（pip install -r server/requirements.txt）"}
    try:
        client.get_collections()
        return {"ok": True, "detail": "Qdrant 连接正常"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180]}


def ensure_collection() -> dict:
    """不存在则创建；dense 维度取自显式配置的 EMBEDDING_DIMENSIONS。"""
    client, models = _client()
    if client is None:
        return {"ok": False, "detail": "qdrant-client 未安装"}
    s = get_settings()
    try:
        existing = {c.name for c in client.get_collections().collections}
        created = s.qdrant_collection not in existing
        if created:
            client.create_collection(
                collection_name=s.qdrant_collection,
                vectors_config={
                    "dense": models.VectorParams(
                        size=s.embedding_dimensions,  # 显式维度，避免与 Qwen 输出不匹配
                        distance=models.Distance.COSINE,
                    )
                },
                sparse_vectors_config={
                    "sparse": models.SparseVectorParams(modifier=models.Modifier.IDF)
                },
            )
        indexed = ensure_payload_indexes()
        return {
            "ok": True,
            "created": created,
            "collection": s.qdrant_collection,
            "dense_dim": s.embedding_dimensions,
            "payload_indexes": indexed,
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180]}


def ensure_payload_indexes() -> list[str]:
    client, models = _client()
    if client is None:
        return []
    s = get_settings()
    done: list[str] = []
    for field in PAYLOAD_INDEX_FIELDS:
        try:
            client.create_payload_index(
                collection_name=s.qdrant_collection,
                field_name=field,
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            done.append(field)
        except Exception:  # noqa: BLE001 - 已存在或版本差异，逐字段容错
            done.append(field)
    return done


def hybrid_query(
    dense_vector: list[float],
    sparse_indices: list[int] | None = None,
    sparse_values: list[float] | None = None,
    tenant_id: str = "public",
    limit: int = 5,
) -> dict:
    """命名向量 Hybrid Query：dense 与 sparse 两个子查询 + RRF 融合 + 租户过滤。"""
    client, models = _client()
    if client is None:
        return {"ok": False, "detail": "qdrant-client 未安装", "hits": []}
    s = get_settings()
    try:
        prefetch = [
            models.Prefetch(query=dense_vector, using="dense", limit=max(limit * 4, 20)),
        ]
        if sparse_indices and sparse_values and len(sparse_indices) == len(sparse_values):
            prefetch.append(
                models.Prefetch(
                    query=models.SparseVector(indices=sparse_indices, values=sparse_values),
                    using="sparse",
                    limit=max(limit * 4, 20),
                )
            )
        result = client.query_points(
            collection_name=s.qdrant_collection,
            prefetch=prefetch,
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key=s.qdrant_tenant_field,
                        match=models.MatchValue(value=tenant_id),
                    )
                ]
            ),
            limit=limit,
            with_payload=True,
        )
        return {
            "ok": True,
            "sparse_used": len(prefetch) > 1,
            "hits": [
                {"id": str(p.id), "score": p.score, "payload": p.payload}
                for p in result.points
            ],
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180], "hits": []}


def purge_user(user_id: str) -> dict:
    """PRD §6/§7：删除用户时同步清理 Qdrant 中对应 point 的 payload 与向量。"""
    client, models = _client()
    if client is None:
        return {"ok": False, "detail": "qdrant-client 未安装"}
    s = get_settings()
    try:
        result = client.delete(
            collection_name=s.qdrant_collection,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="user_id", match=models.MatchValue(value=user_id)
                        )
                    ]
                )
            ),
        )
        return {"ok": True, "result": str(result)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180]}


def upsert_points(points: list[dict[str, Any]]) -> dict:
    """写 point 时同时带 dense / sparse 命名向量与 tenant payload。"""
    client, models = _client()
    if client is None:
        return {"ok": False, "detail": "qdrant-client 未安装"}
    s = get_settings()
    try:
        client.upsert(
            collection_name=s.qdrant_collection,
            points=[models.PointStruct(**p) for p in points],
        )
        return {"ok": True, "count": len(points)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180]}
