import { env } from '../config/env'
import { EVLN_META } from './scenarios'
import type { CopingProfile, EvlnCode, EvidenceItem, ResponseRecord, Scenario } from './types'

/**
 * 应对模式画像（学术指导 §4.1 / §4.2 方案 B）
 * ------------------------------------------------------------------
 * · 名称由「韧性画像」改为「应对模式画像」：韧性是过程/结果轨迹，不是稳定特质
 * · 输出两个连续维度 agency（主动—被动）与 constructiveness（建设—破坏）
 * · boundary_clarity 是输入参数，不作为输出标签，避免四类画像混维度
 * · 每条结论必须能逐条回溯到用户的选择序列（证据回溯链）
 */

const ORDER: EvlnCode[] = ['voice', 'exit', 'loyalty', 'neglect']

export const quadrantOf = (agency: number, constructiveness: number): EvlnCode => {
  if (agency >= 50 && constructiveness >= 50) return 'voice'
  if (agency >= 50) return 'exit'
  if (constructiveness >= 50) return 'loyalty'
  return 'neglect'
}

export const labelOf = (quadrant: EvlnCode): string => {
  const labels = env.flow.evlnLabels
  const idx = ORDER.indexOf(quadrant)
  return labels[idx] ?? EVLN_META[quadrant].zh
}

export function emptyProfile(): CopingProfile {
  return {
    agency: 50,
    constructiveness: 50,
    quadrant: 'voice',
    label: labelOf('voice'),
    confidence: 0,
    dataConfidence: 'low',
    evidence: [],
  }
}

export function buildProfile(
  responses: ResponseRecord[],
  scenarios: Scenario[],
): CopingProfile {
  if (!responses.length) return emptyProfile()

  const n = responses.length
  let agencySum = 0
  let csSum = 0
  const counts: Record<EvlnCode, number> = { voice: 0, exit: 0, loyalty: 0, neglect: 0 }

  const evidence: EvidenceItem[] = responses.map((r) => {
    const scenario = scenarios.find((s) => s.id === r.scenarioId)
    const option = scenario?.options.find((o) => o.id === r.optionId)
    const a = option?.agency ?? 0
    const c = option?.constructiveness ?? 0
    agencySum += a
    csSum += c
    counts[r.evln] += 1
    const meta = EVLN_META[r.evln]
    return {
      scenarioId: r.scenarioId,
      scenarioTitle: scenario ? `${scenario.stressorType} · ${scenario.intensityLabel}` : r.scenarioId,
      choiceText: r.optionText,
      evlnLabel: meta.plain,
      inference: `这次更靠近「${labelOf(r.evln)}」。`,
    }
  })

  // 每个选择的 ±1 先取均值（-1..1），再映射到 0..100
  const agency = Math.round(((agencySum / n + 1) / 2) * 100)
  const constructiveness = Math.round(((csSum / n + 1) / 2) * 100)
  const quadrant = quadrantOf(agency, constructiveness)

  const consistency = Math.max(...ORDER.map((k) => counts[k])) / n
  const coverage = Math.min(1, n / Math.max(1, env.flow.scenarioCount))
  const confidence = Math.round((0.6 * consistency + 0.4 * coverage) * 100)

  return {
    agency,
    constructiveness,
    quadrant,
    label: labelOf(quadrant),
    confidence,
    dataConfidence: n >= env.flow.scenarioCount ? 'high' : 'medium',
    evidence,
  }
}

/** 非诊断、非宿命论的画像解释（学术 §4.7：模式是互动产物，不是人格类型） */
export function profileNarrative(profile: CopingProfile): string {
  const a = profile.agency >= 50 ? env.flow.axisActive : env.flow.axisPassive
  const c = profile.constructiveness >= 50 ? env.flow.axisConstructive : env.flow.axisDestructive
  return `这几轮里，你更多是${a}、${c}。换个场景或换个心情，选择可能就不一样。这不是性格，也不代表关系会怎样。`
}
