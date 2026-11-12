"""MySQL 8 访问层。

覆盖 PRD §5 / §7 / §11：
  - 建表（JSON 类型 + 生成列 + B-Tree 索引）
  - WITH RECURSIVE 参数化证据回溯（kg_edges 边表）
  - B 端只查聚合表，低于最小样本量不返回分布
  - 一键删除：关系表 + checkpointer 历史
  - 生产级 checkpointer：PyMySQLSaver + .setup() + autocommit=True

依赖缺失或连不上时不抛给上层，返回结构化降级结果。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import WARNINGS, get_settings

# 删除时逐表清理（表名白名单，不接受外部输入）
_PURGE_TABLES = (
    ("feedback", "user_id"),
    ("action_scripts", "user_id"),
    ("profiles", "user_id"),
    ("scenario_choices", "user_id"),
    ("intakes", "user_id"),
    ("role_cards", "user_id"),
    ("consents", "user_id"),
    ("session_events", "user_id"),
    ("users", "user_id"),
)


def _pymysql():
    try:
        import pymysql
        return pymysql
    except ImportError:
        return None


def connection(*, autocommit: bool = True):
    """手动连接必须包含 autocommit=True（PRD §9 checkpointer 硬性约束）。"""
    pymysql = _pymysql()
    if pymysql is None:
        return None
    s = get_settings()
    return pymysql.connect(
        host=s.mysql_host,
        port=s.mysql_port,
        user=s.mysql_user,
        password=s.mysql_password,
        database=s.mysql_database,
        charset="utf8mb4",
        autocommit=autocommit,
        connect_timeout=max(1, s.mysql_connect_timeout_ms // 1000),
    )


def ping() -> dict:
    if _pymysql() is None:
        return {"ok": False, "detail": "PyMySQL 未安装（pip install -r server/requirements.txt）"}
    try:
        conn = connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
        return {"ok": True, "detail": "MySQL 8 连接正常"}
    except Exception as exc:  # noqa: BLE001 - 健康检查只回显原因
        return {"ok": False, "detail": str(exc)[:180]}


def _statements() -> list[str]:
    text = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    lines = [ln for ln in text.splitlines() if not ln.strip().startswith("--")]
    return [part.strip() for part in "\n".join(lines).split(";") if part.strip()]


def init_schema() -> dict:
    """幂等建表；docker compose 也会挂载 schema.sql 由镜像初始化。"""
    try:
        conn = connection()
        if conn is None:
            return {"ok": False, "detail": "PyMySQL 未安装"}
        statements = _statements()
        with conn.cursor() as cur:
            for statement in statements:
                cur.execute(statement)
        conn.close()
        return {"ok": True, "statements": len(statements)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180]}


def record_event(kind: str, payload: dict[str, Any]) -> dict:
    """前端 5 个上报节点统一落 session_events；失败降级不阻断闭环。"""
    try:
        conn = connection()
        if conn is None:
            return {"stored": False, "reason": "mysql driver missing"}
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO session_events (user_id, session_id, event_kind, payload) "
                "VALUES (%s, %s, %s, %s)",
                (
                    str(payload.get("user_id") or "anonymous"),
                    str(payload.get("session_id") or ""),
                    kind,
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
        conn.close()
        return {"stored": True}
    except Exception as exc:  # noqa: BLE001
        return {"stored": False, "reason": str(exc)[:160]}


def evidence_chain(start_id: str, max_depth: int = 4) -> dict:
    """PRD §5.2：参数化递归 CTE，返回可读的「场景 → 模式 → 轨迹」链条。

    CAST(... AS CHAR(1000)) 是必须的：MySQL 递归 CTE 以初始 SELECT 的字符串长度为准，
    不显式拓宽会在拼接后续节点时截断。
    """
    sql = """
        WITH RECURSIVE chain AS (
            SELECT source_id, target_id, relationship, 1 AS depth,
                   CAST(CONCAT(source_id, ' -> ', target_id) AS CHAR(1000)) AS path
            FROM kg_edges WHERE source_id = %s
            UNION ALL
            SELECT e.source_id, e.target_id, e.relationship, c.depth + 1,
                   CONCAT(c.path, ' -> ', e.target_id)
            FROM kg_edges e
            JOIN chain c ON e.source_id = c.target_id
            WHERE c.depth < %s
        )
        SELECT DISTINCT path, relationship, depth FROM chain
        ORDER BY depth, path LIMIT 50
    """
    try:
        conn = connection()
        if conn is None:
            return {"ok": False, "detail": "PyMySQL 未安装", "paths": []}
        with conn.cursor() as cur:
            cur.execute(sql, (start_id, min(max_depth, 5)))
            rows = cur.fetchall()
        conn.close()
        return {"ok": True, "paths": [{"path": r[0], "relation": r[1], "depth": r[2]} for r in rows]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180], "paths": []}


def aggregate_distribution(tenant_id: str) -> dict:
    """PRD §7.2：只查聚合快照表，绝不接触 C 端明细；小样本不返回分布。"""
    s = get_settings()
    try:
        conn = connection()
        if conn is None:
            return {"ok": False, "detail": "PyMySQL 未安装"}
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(choice_count), 0) FROM aggregate_snapshots WHERE tenant_id = %s",
                (tenant_id,),
            )
            sample = int(cur.fetchone()[0] or 0)
            if sample < s.aggregate_min_sample:
                conn.close()
                return {"ok": True, "sample_size": sample, "insufficient": True, "distribution": []}
            cur.execute(
                "SELECT option_code, SUM(choice_count) FROM aggregate_snapshots "
                "WHERE tenant_id = %s GROUP BY option_code",
                (tenant_id,),
            )
            rows = cur.fetchall()
        conn.close()
        return {
            "ok": True,
            "sample_size": sample,
            "insufficient": False,
            "distribution": [{"option": r[0], "count": int(r[1])} for r in rows],
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180], "distribution": []}


def purge_user(user_id: str) -> dict:
    """PRD §7：删除请求清除关系表 + checkpointer 历史（Qdrant 侧由 vector.purge_user 负责）。"""
    removed: dict[str, int] = {}
    try:
        conn = connection()
        if conn is None:
            return {"ok": False, "detail": "PyMySQL 未安装", "removed": removed}
        with conn.cursor() as cur:
            for table, column in _PURGE_TABLES:
                cur.execute(f"DELETE FROM `{table}` WHERE `{column}` = %s", (user_id,))
                removed[table] = cur.rowcount
            # thread_id 与 user_id + session_id 绑定，按前缀清 checkpoint 历史
            cur.execute("SHOW TABLES LIKE 'checkpoint%'")
            checkpoint_tables = [row[0] for row in cur.fetchall()]
            for table in checkpoint_tables:
                try:
                    cur.execute(
                        f"DELETE FROM `{table}` WHERE thread_id LIKE %s",
                        (f"{get_settings().thread_prefix}:{user_id}:%",),
                    )
                    removed[str(table)] = cur.rowcount
                except Exception:  # noqa: BLE001 - 表结构由第三方包定义，逐表容错
                    continue
        conn.close()
        return {"ok": True, "removed": removed}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)[:180], "removed": removed}


def make_checkpointer():
    """PRD §9/§11：生产禁用 InMemorySaver；首次使用调用 .setup()，连接必须 autocommit=True。

    缺 langgraph-checkpoint-mysql 时返回 None 并记录降级，不影响骨架启动。
    """
    if not get_settings().checkpointer_enabled:
        return None
    try:
        from langgraph_checkpoint_mysql import PyMySQLSaver
    except ImportError:
        WARNINGS.append("未安装 langgraph-checkpoint-mysql，checkpointer 降级（完整流水线时安装 requirements-ai.txt）。")
        return None
    try:
        conn = connection(autocommit=True)
        if conn is None:
            return None
        saver = PyMySQLSaver(conn)
        saver.setup()  # 首次使用必须调用，创建 checkpoint 表
        return saver
    except Exception as exc:  # noqa: BLE001
        WARNINGS.append(f"checkpointer 初始化失败，已降级：{str(exc)[:120]}")
        return None
