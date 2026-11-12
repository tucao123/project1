"""服务端配置层。

设计对齐前端 src/config/env.ts：
  - 所有可调项集中在 .env.server（模板为 .env.server.example）
  - 类型化读取、默认值、范围钳制、异常回退，并把回退原因收集进 WARNINGS
  - 环境变量优先于文件（docker compose 通过 environment 注入容器内网地址）
  - 只用标准库，缺任何第三方依赖也能 import 与自检

安全：所有变量都不带 VITE_ 前缀，绝不会进入浏览器端 bundle。
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

WARNINGS: list[str] = []
RAW: dict[str, str] = {}

# Qwen-embedding3 支持的维度（PRD §9）。维度必须显式指定，否则 Qdrant collection 不匹配。
ALLOWED_EMBEDDING_DIMS = (256, 512, 768, 1024, 1536, 2048, 2560)
# 官方 Batch 最大行数 20；超出必须拆批，不能假设一次能传任意数量文本。
EMBEDDING_BATCH_HARD_CAP = 20


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _env_path() -> Path:
    override = os.environ.get("SERVER_ENV_FILE")
    return Path(override) if override else _project_root() / ".env.server"


def _parse_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def reload() -> None:
    """重新读取配置；单测与配置热更用。"""
    global RAW
    RAW = _parse_dotenv(_env_path())
    RAW.update(os.environ)  # 环境变量优先
    WARNINGS.clear()
    get_settings.cache_clear()


def _s(key: str, default: str = "") -> str:
    return str(RAW.get(key, default)).strip()


def _b(key: str, default: bool = False) -> bool:
    value = RAW.get(key)
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _num(key: str, default: int | float, lo=None, hi=None, cast=int):
    raw = RAW.get(key)
    try:
        value = cast(str(raw if raw is not None else default).strip())
    except (TypeError, ValueError):
        WARNINGS.append(f"{key} 不是合法数值，已回退默认值 {default}。")
        value = default
    clamped = value
    if lo is not None:
        clamped = max(lo, clamped)
    if hi is not None:
        clamped = min(hi, clamped)
    if clamped != value:
        WARNINGS.append(f"{key}={value} 超出允许范围，已按 {clamped} 处理。")
    return clamped


def _list(key: str, default: list[str]) -> list[str]:
    raw = RAW.get(key)
    if raw is None:
        return list(default)
    items = [x.strip() for x in str(raw).split(",") if x.strip()]
    return items or list(default)


@dataclass(frozen=True)
class Settings:
    # 运行
    host: str
    port: int
    cors_origins: list[str]
    log_level: str
    # 模型
    llm_provider: str
    llm_api_key: str
    llm_base_url: str
    llm_model_supervisor: str
    llm_model_worker: str
    llm_temperature_supervisor: float
    llm_temperature_worker: float
    llm_timeout_ms: int
    embedding_model: str
    embedding_dimensions: int
    embedding_batch_size: int
    embedding_timeout_ms: int
    sparse_model: str
    # MySQL
    mysql_host: str
    mysql_port: int
    mysql_user: str
    mysql_password: str
    mysql_database: str
    mysql_pool_size: int
    mysql_connect_timeout_ms: int
    # Qdrant
    qdrant_url: str
    qdrant_api_key: str
    qdrant_collection: str
    qdrant_tenant_field: str
    qdrant_timeout_ms: int
    # LangGraph
    checkpointer_enabled: bool
    max_rewrite: int
    thread_prefix: str
    sse_enabled: bool
    # 可观测
    langsmith_enabled: bool
    langsmith_api_key: str
    langsmith_project: str
    # 合规与隐私
    guard_enabled: bool
    feedback_consent_default: bool
    raw_text_retention_days: int
    delete_sla_hours: int
    hotline_name: str
    hotline_number: str
    high_risk_notice: str
    # B 端
    aggregate_min_sample: int

    @property
    def llm_ready(self) -> bool:
        return bool(self.llm_api_key) or self.llm_provider == "ollama"

    @property
    def embedding_ready(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def mysql_configured(self) -> bool:
        return bool(self.mysql_host and self.mysql_database and self.mysql_user)

    @property
    def qdrant_configured(self) -> bool:
        return bool(self.qdrant_url)


def _build() -> Settings:
    # 硬约束：单独明示授权不得默认勾选（PRD §7.1）
    consent_default = _b("FEEDBACK_CONSENT_DEFAULT", False)
    if consent_default:
        WARNINGS.append(
            "单独授权不得默认勾选。FEEDBACK_CONSENT_DEFAULT=true 已被强制回退为 false。"
        )
        consent_default = False

    dims = _num("EMBEDDING_DIMENSIONS", 1024, cast=int)
    if dims not in ALLOWED_EMBEDDING_DIMS:
        WARNINGS.append(
            f"EMBEDDING_DIMENSIONS={dims} 不在 Qwen-embedding3 支持维度内，已回退 1024。"
        )
        dims = 1024

    batch = _num("EMBEDDING_BATCH_SIZE", 10, lo=1, hi=EMBEDDING_BATCH_HARD_CAP, cast=int)
    # CRAG 纠错必须有硬上限，超限降级并标注低置信
    max_rewrite = _num("LANGGRAPH_MAX_REWRITE", 2, lo=0, hi=2, cast=int)

    return Settings(
        host=_s("SERVER_HOST", "0.0.0.0"),
        port=_num("SERVER_PORT", 8000, lo=1, hi=65535, cast=int),
        cors_origins=_list("CORS_ORIGINS", ["http://localhost:5173"]),
        log_level=_s("LOG_LEVEL", "info"),
        llm_provider=_s("LLM_PROVIDER", "openai-compatible"),
        llm_api_key=_s("LLM_API_KEY"),
        llm_base_url=_s("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        llm_model_supervisor=_s("LLM_MODEL_SUPERVISOR", "qwen-plus"),
        llm_model_worker=_s("LLM_MODEL_WORKER", "qwen-plus"),
        llm_temperature_supervisor=_num("LLM_TEMPERATURE_SUPERVISOR", 0.2, lo=0, hi=2, cast=float),
        llm_temperature_worker=_num("LLM_TEMPERATURE_WORKER", 0.7, lo=0, hi=2, cast=float),
        llm_timeout_ms=_num("LLM_TIMEOUT_MS", 30000, lo=1000, hi=300000, cast=int),
        embedding_model=_s("EMBEDDING_MODEL", "text-embedding-v3"),
        embedding_dimensions=dims,
        embedding_batch_size=batch,
        embedding_timeout_ms=_num("EMBEDDING_TIMEOUT_MS", 30000, lo=1000, hi=300000, cast=int),
        sparse_model=_s("SPARSE_MODEL", "Qdrant/bm25"),
        mysql_host=_s("MYSQL_HOST", "127.0.0.1"),
        mysql_port=_num("MYSQL_PORT", 3306, lo=1, hi=65535, cast=int),
        mysql_user=_s("MYSQL_USER", "rfr"),
        mysql_password=_s("MYSQL_PASSWORD"),
        mysql_database=_s("MYSQL_DATABASE", "rfr"),
        mysql_pool_size=_num("MYSQL_POOL_SIZE", 5, lo=1, hi=50, cast=int),
        mysql_connect_timeout_ms=_num("MYSQL_CONNECT_TIMEOUT_MS", 5000, lo=500, hi=60000, cast=int),
        qdrant_url=_s("QDRANT_URL", "http://127.0.0.1:6333"),
        qdrant_api_key=_s("QDRANT_API_KEY"),
        qdrant_collection=_s("QDRANT_COLLECTION", "rfr_scenarios"),
        qdrant_tenant_field=_s("QDRANT_TENANT_FIELD", "tenant_id"),
        qdrant_timeout_ms=_num("QDRANT_TIMEOUT_MS", 10000, lo=500, hi=120000, cast=int),
        checkpointer_enabled=_b("CHECKPOINTER_ENABLED", True),
        max_rewrite=max_rewrite,
        thread_prefix=_s("LANGGRAPH_THREAD_PREFIX", "rfr"),
        sse_enabled=_b("LANGGRAPH_SSE_ENABLED", True),
        langsmith_enabled=_b("LANGSMITH_ENABLED", False),
        langsmith_api_key=_s("LANGSMITH_API_KEY"),
        langsmith_project=_s("LANGSMITH_PROJECT", "rfr-mvp"),
        guard_enabled=_b("GUARD_ENABLED", True),
        feedback_consent_default=consent_default,
        raw_text_retention_days=_num("RAW_TEXT_RETENTION_DAYS", 7, lo=1, hi=365, cast=int),
        delete_sla_hours=_num("DELETE_SLA_HOURS", 24, lo=1, hi=168, cast=int),
        hotline_name=_s("HOTLINE_NAME", "希望24热线"),
        hotline_number=_s("HOTLINE_NUMBER", "400-161-9995"),
        high_risk_notice=_s("HIGH_RISK_NOTICE", "先照顾好自己，尽快联系专业人士或身边信任的人。"),
        aggregate_min_sample=_num("AGGREGATE_MIN_SAMPLE", 20, lo=1, hi=100000, cast=int),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return _build()


def public_dict(settings: Settings | None = None) -> dict:
    """/health 用：脱敏，绝不回显密钥或口令。"""
    s = settings or get_settings()
    data = asdict(s)
    for key in list(data):
        if "api_key" in key or "password" in key:
            data[key] = "(configured)" if data[key] else "(empty)"
    return data


def degradation_report(settings: Settings | None = None) -> list[str]:
    """说明当前哪些能力被降级，供 /health 与日志使用。"""
    s = settings or get_settings()
    out: list[str] = []
    if not s.llm_ready:
        out.append("LLM_API_KEY 未配置：生成模型降级为规则输出")
    if not s.embedding_ready:
        out.append("LLM_API_KEY 未配置：dense 向量降级为本地确定性向量")
    if not s.mysql_configured:
        out.append("MySQL 未配置：关系表与证据回溯不可用")
    if not s.qdrant_configured:
        out.append("Qdrant 未配置：混合检索不可用")
    return out


reload()
