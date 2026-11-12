import { env } from '../config/env'

/**
 * compliance_guard（PRD §4.4 / §7.2，学术指导 §4.7）
 * ------------------------------------------------------------------
 * 常驻安全节点，规则级拦截，不依赖 LLM 自由生成：
 *   · 高危表述 → 固定话术 + 专业资源，优先级最高
 *   · 操控性意图 → 拦截并给中性改写指引
 *   · 宿命论判决 → 拦截（模式是互动产物，不是命运）
 * 输出侧同样过一遍，防止画像 / 陪练脚本里出现谄媚或断言式结论。
 */

export type GuardKind = 'manipulation' | 'fatalism' | 'high_risk'

export interface GuardVerdict {
  blocked: boolean
  kind?: GuardKind
  message?: string
  showResource?: boolean
}

const c = env.compliance

export function guardUserInput(text: string): GuardVerdict {
  if (!c.guardEnabled || !text.trim()) return { blocked: false }

  if (c.blockHighRisk && c.highRiskPatterns.some((p) => p.test(text))) {
    return {
      blocked: true,
      kind: 'high_risk',
      message: c.highRiskNotice,
      showResource: true,
    }
  }
  if (c.blockManipulation && c.manipulationPatterns.some((p) => p.test(text))) {
    return { blocked: true, kind: 'manipulation', message: c.manipulationNotice }
  }
  // 注意：用户说「我觉得没戏了」属于正常的低期望表达，不拦截，
  // 应交给陪练的「先处理可行性信念」分支；宿命论拦截只作用于生成内容。
  return { blocked: false }
}

/** 输出侧过滤：命中即替换为固定话术，绝不把 LLM 自由生成内容直接放出 */
export function guardOutputText(text: string): string {
  if (!c.guardEnabled) return text
  if (c.blockHighRisk && c.highRiskPatterns.some((p) => p.test(text))) return c.crisisResource
  if (c.blockFatalism && c.fatalismPatterns.some((p) => p.test(text))) return c.fatalismNotice
  if (c.blockManipulation && c.manipulationPatterns.some((p) => p.test(text))) {
    return c.manipulationNotice
  }
  return text
}

export const crisisResourceLine = `${c.hotlineName} · ${c.hotlineNumber}`
