import { env } from '../config/env'
import type { ArchiveEntry, IntakeData, RoleCard } from './types'

/**
 * 演示样例数据
 * ------------------------------------------------------------------
 * · B 端分布 / 跨批次趋势是静态样例，界面必须显著标注「非真实统计」
 * · 预置历史只在 VITE_SEED_DEMO_DATA=true 时注入，且每条带 isSample
 * · C 端跨周趋势不再使用静态值，改由真实练习记录计算
 */

export function groupDistribution() {
  const labels = env.flow.evlnLabels
  const ratios = [27, 19, 33, 21]
  return labels.slice(0, 4).map((label, i) => ({
    label: label || `模式 ${i + 1}`,
    value: ratios[i] ?? 0,
    accent: i === 0,
  }))
}

export const withdrawalTrend = [38, 31, 21]
export const groupTrendLabel = '临时取消时，选择不回应的人'

/** 由真实练习记录生成趋势：不足 2 条时返回 sufficient=false，不编造数字 */
export function practiceTrend(archive: ArchiveEntry[]): {
  values: number[]
  labels: string[]
  sufficient: boolean
} {
  const real = archive
    .filter((a) => !a.isSample && typeof a.agency === 'number')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .slice(-6)
  if (real.length < 2) return { values: [], labels: [], sufficient: false }
  return {
    values: real.map((a) => Math.round(a.agency ?? 0)),
    labels: real.map((a) => a.date.slice(5)),
    sufficient: true,
  }
}

/** 预置演示历史：打开开关才会注入，且全部标记为样例 */
export function archiveHistory(): ArchiveEntry[] {
  if (!env.features.seedDemoData || !env.api.useMock) return []
  const labels = env.flow.evlnLabels
  return [
    {
      id: 'arc-sample-003',
      date: '2026-11-11',
      relationshipType: env.domain.relationshipTypes[0] ?? '搭子',
      frictionEvents: [env.domain.frictionEvents[0] ?? '临时取消'],
      profileLabel: labels[2] ?? '先忍着，等一等',
      scenarioCount: 3,
      version: 2,
      isSample: true,
    },
    {
      id: 'arc-sample-002',
      date: '2026-11-04',
      relationshipType: env.domain.relationshipTypes[2] ?? '轻社交',
      frictionEvents: [env.domain.frictionEvents[3] ?? '延迟回复'],
      profileLabel: labels[3] ?? '不回应，冷处理',
      scenarioCount: 2,
      version: 2,
      isSample: true,
    },
    {
      id: 'arc-sample-001',
      date: '2026-10-28',
      relationshipType: env.domain.relationshipTypes[1] ?? '初识',
      frictionEvents: [env.domain.frictionEvents[2] ?? '越界分享'],
      profileLabel: labels[3] ?? '不回应，冷处理',
      scenarioCount: 2,
      version: 1,
      isSample: true,
    },
  ]
}

/** 演示用的「对方设定」：打开样例开关时的初始值 */
export function initialRoleCard(): RoleCard {
  return {
    version: 2,
    personaParams: [
      { label: '回应温度', value: 62 },
      { label: '主动程度', value: 48 },
      { label: '边界敏感度', value: 35 },
      { label: '解释倾向', value: 55 },
    ],
    relationshipParams: [
      { label: '关系阶段', value: '定义尚未确立' },
      { label: '承诺水平', value: env.domain.commitmentLevels[0] ?? '低' },
      { label: '边界清晰度', value: env.domain.boundaryLevels[0] ?? '模糊' },
      { label: '不确定性来源', value: env.domain.uncertaintySources.join('、') },
    ],
    memorySummary: '只记住两件事：临时取消时轻描淡写；聊到边界会转成玩笑。不含原始对话。',
  }
}

/** 练习设定随本次填写变化，避免永远显示四个无来源的 50 */
function personaFromIntake(intake: IntakeData): RoleCard['personaParams'] {
  const at = (list: readonly string[], value: string, values: number[]) =>
    values[Math.min(Math.max(0, list.indexOf(value)), values.length - 1)] ?? 50
  return [
    { label: '回应温度', value: at(env.domain.priorResponsiveness, intake.priorResponsiveness, [75, 50, 25]) },
    { label: '主动程度', value: at(env.domain.messageUrgency, intake.messageUrgency, [30, 50, 70]) },
    { label: '边界敏感度', value: at(env.domain.boundaryLevels, intake.boundaryClarity, [70, 50, 30]) },
    { label: '解释倾向', value: at(env.domain.commitmentLevels, intake.commitmentLevel, [65, 50, 35]) },
  ]
}

/** 每次预演结束后，把「对方设定」同步为本次真实填写，不再留着空态文案 */
export function roleCardForSession(
  intake: IntakeData,
  prev: RoleCard,
  realCount: number,
): RoleCard {
  return {
    ...prev,
    personaParams: personaFromIntake(intake),
    relationshipParams: [
      { label: '关系', value: intake.relationshipType },
      { label: '承诺水平', value: intake.commitmentLevel },
      { label: '边界', value: intake.boundaryClarity },
      { label: '纠结的是', value: intake.hesitationType },
    ],
    memorySummary:
      realCount > 0
        ? `记下 ${realCount} 次练习里的选择，不含原始对话。`
        : '还没有练习记录，这里先留空。',
  }
}

/** 删除全部之后的干净空态 */
export function emptyRoleCard(): RoleCard {
  return {
    version: 1,
    personaParams: [
      { label: '回应温度', value: 50 },
      { label: '主动程度', value: 50 },
      { label: '边界敏感度', value: 50 },
      { label: '解释倾向', value: 50 },
    ],
    relationshipParams: [
      { label: '关系阶段', value: '—' },
      { label: '承诺水平', value: '—' },
      { label: '边界清晰度', value: '—' },
      { label: '不确定性来源', value: '—' },
    ],
    memorySummary: '还没有练习记录，这里先留空。',
  }
}
