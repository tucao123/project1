import { env } from '../config/env'
import { EVLN_META } from './scenarios'
import type { CopingProfile, EvlnCode, EvidenceItem, ResponseRecord, Scenario } from './types'

/**
 * 应对模式画像
 * ------------------------------------------------------------------
 * · 只描述「这几次练习中的选择倾向」，不是人格类型、不是临床评估
 * · agency / constructiveness 保留为连续分数，只用于象限定位与文字描述
 * · 结论由「选择众数」决定：最大类占比 < 60% 或并列时，不给单一标签
 * · 一致性 = 最大类票数 / 总票数，只表示几次选择像不像，不代表测得准不准
 */

const ORDER: EvlnCode[] = ['voice', 'exit', 'loyalty', 'neglect']

/** 结论已改由选择众数决定，不再用两轴均值硬判象限（原 quadrantOf 已移除） */
export const labelOf = (quadrant: EvlnCode): string => {
  const idx = ORDER.indexOf(quadrant)
  return env.flow.evlnLabels[idx] ?? EVLN_META[quadrant].zh
}

export function emptyProfile(): CopingProfile {
  return {
    agency: 50,
    constructiveness: 50,
    quadrant: null,
    label: '',
    mixed: false,
    counts: { voice: 0, exit: 0, loyalty: 0, neglect: 0 },
    dominant: null,
    dominantCount: 0,
    total: 0,
    consistency: 0,
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
    agencySum += option?.agency ?? 0
    csSum += option?.constructiveness ?? 0
    counts[r.evln] += 1
    return {
      scenarioId: r.scenarioId,
      scenarioTitle: scenario ? `${scenario.stressorType} · ${scenario.intensityLabel}` : r.scenarioId,
      choiceText: r.optionText,
      evlnLabel: EVLN_META[r.evln].plain,
      evln: r.evln,
      inference: `这次更靠近「${labelOf(r.evln)}」。`,
    }
  })

  const agency = Math.round(((agencySum / n + 1) / 2) * 100)
  const constructiveness = Math.round(((csSum / n + 1) / 2) * 100)

  const ranked = ORDER.map((k) => ({ k, c: counts[k] })).sort(
    (a, b) => b.c - a.c || ORDER.indexOf(a.k) - ORDER.indexOf(b.k),
  )
  const top = ranked[0]
  const tie = ranked[1].c === top.c
  const mixed = top.c / n < 0.6 || tie
  const dominant: EvlnCode | null = mixed ? null : top.k
  const consistency = Math.round((top.c / n) * 100)

  return {
    agency,
    constructiveness,
    quadrant: dominant,
    label: dominant ? labelOf(dominant) : env.ui.profileMixed,
    mixed,
    counts,
    dominant,
    dominantCount: top.c,
    total: n,
    consistency,
    evidence,
  }
}

/** 非诊断、非宿命论的解释：模式是互动产物，不是人格类型 */
export function profileNarrative(profile: CopingProfile): string {
  const a = profile.agency >= 50 ? env.flow.axisActive : env.flow.axisPassive
  const c = profile.constructiveness >= 50 ? env.flow.axisConstructive : env.flow.axisDestructive
  const head = profile.mixed
    ? env.ui.profileMixedHint
    : `这几次里，你更多是${a}、${c}。`
  return `${head}换个场景或换个心情，选择可能就不一样。这不是性格，也不代表关系会怎样。`
}
