import { env } from '../config/env'
import type { ArchiveEntry, RoleCard } from './types'

/**
 * MVP 演示数据（VITE_USE_MOCK=true 时使用）。
 * B 端数据全部是聚合值：只查聚合表，不回推个体、不展示任何身份信息（PRD §7.1 / F-B3）。
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

/** F-B4 单指标趋势：某类压力场景下「被动—退缩」占比的跨批次变化 */
export const withdrawalTrend = [38, 31, 21]

export const groupTrendLabel = '临时取消时，选择不回应的人'

/** F-C6 跨周心态分析（毕设简化为单指标趋势） */
export const weeklyAgencyTrend = [31, 38, 44, 52]

export const weeklyTrendLabel = '主动开口的次数'

export function archiveHistory(): ArchiveEntry[] {
  const labels = env.flow.evlnLabels
  return [
    {
      id: 'arc-003',
      date: '2026-11-11',
      relationshipType: env.domain.relationshipTypes[0] ?? '搭子',
      frictionEvents: [env.domain.frictionEvents[0] ?? '临时取消'],
      profileLabel: labels[2] ?? '被动—迁就型',
      scenarioCount: 3,
      version: 2,
    },
    {
      id: 'arc-002',
      date: '2026-11-04',
      relationshipType: env.domain.relationshipTypes[2] ?? '轻社交',
      frictionEvents: [env.domain.frictionEvents[3] ?? '延迟回复'],
      profileLabel: labels[3] ?? '被动—退缩型',
      scenarioCount: 2,
      version: 2,
    },
    {
      id: 'arc-001',
      date: '2026-10-28',
      relationshipType: env.domain.relationshipTypes[1] ?? '初识',
      frictionEvents: [env.domain.frictionEvents[2] ?? '越界分享'],
      profileLabel: labels[3] ?? '被动—退缩型',
      scenarioCount: 2,
      version: 1,
    },
  ]
}

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
    memorySummary:
      '只记住两件事：临时取消时轻描淡写；聊到边界会转成玩笑。不含原始对话。',
  }
}
