"""compliance_guard：规则级拦截，不依赖 LLM 自由生成（PRD §4.4 / §7.2，学术指导 §4.7）。

双侧：
  - 输入侧：高危表述 → 固定话术 + 专业资源；操控意图 → 拦截
  - 输出侧：宿命论 / 人格标签 → 拦截，避免给用户下结论
宿命论只拦输出，不拦用户自己的表达。
"""

from __future__ import annotations

import re

from .config import get_settings

HIGH_RISK_PATTERNS = [
    r"不想活", r"活不下去", r"自杀", r"自伤", r"伤害自己", r"结束生命",
    r"没有意义活", r"想消失", r"割腕", r"跳楼",
]
MANIPULATION_PATTERNS = [
    r"让.{0,6}爱上", r"拿捏", r"操控", r"控制对方", r"怎么让.{0,6}喜欢我",
    r"PUA", r"吊着", r"欲擒故纵",
]
FATALISM_PATTERNS = [
    r"你就是这种人", r"永远改不了", r"命中注定", r"天生就", r"注定会",
    r"你的性格是", r"你这个人就是",
]


def _match(patterns: list[str], text: str) -> bool:
    return any(re.search(p, text, flags=re.IGNORECASE) for p in patterns)


def check_output(text: str) -> dict:
    s = get_settings()
    if not s.guard_enabled:
        return {"blocked": False, "kind": "off"}
    if _match(FATALISM_PATTERNS, text):
        return {"blocked": True, "kind": "fatalism", "message": "输出含宿命论或人格定论，已拦截重写。"}
    if _match(MANIPULATION_PATTERNS, text):
        return {"blocked": True, "kind": "manipulation", "message": "输出含操控性表述，已拦截重写。"}
    return {"blocked": False, "kind": "pass"}


def check_input(text: str) -> dict:
    """返回结构化结果；hotline 取自配置，前端按此渲染就地提示。"""
    s = get_settings()
    if not s.guard_enabled:
        return {"blocked": False, "kind": "off"}
    if _match(HIGH_RISK_PATTERNS, text):
        return {
            "blocked": True,
            "kind": "high_risk",
            "message": s.high_risk_notice,
            "hotline_name": s.hotline_name,
            "hotline_number": s.hotline_number,
        }
    if _match(MANIPULATION_PATTERNS, text):
        return {
            "blocked": True,
            "kind": "manipulation",
            "message": "这里只陪你练怎么把话说清楚，不帮着影响或控制别人。",
        }
    return {"blocked": False, "kind": "pass"}
