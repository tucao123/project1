import { env } from '../config/env'
import { guardUserInput } from './compliance'
import type { IntakeData, Intensity } from './types'

/**
 * 出题侧的上下文工厂（O-04）
 * ------------------------------------------------------------------
 * 场景文本里凡是依赖用户填写的线索，都在这里由 intake 生成；
 * seed 里只保留构念性描述，避免「填了 A、题目却写死 B」。
 */

export interface SeedForContext {
  id: string
  stressorType: string
  intensity: Intensity
  uncertaintySource: string
  constructTarget: string
  context: string[]
}

/** 这些前缀属于「用户填写决定」的线索，seed 里的静态值必须被覆盖 */
const DYNAMIC_PREFIXES = ['平时回复：', '这条消息：', '拿不准的是：', '关系：', '边界']

export function contextFromIntake(intake: IntakeData, seed: SeedForContext): string[] {
  const staticParts = seed.context.filter(
    (line) => !DYNAMIC_PREFIXES.some((prefix) => line.startsWith(prefix)),
  )
  return [
    ...staticParts,
    `关系：${intake.relationshipType} / 承诺 ${intake.commitmentLevel}`,
    `平时回复：${intake.priorResponsiveness}`,
    `这条消息：${intake.messageUrgency}`,
    `边界：${intake.boundaryClarity}`,
    `拿不准的是：${seed.uncertaintySource}`,
  ]
}

/** 「你在纠结什么」映射到不确定性来源，用于场景打分 */
export function hesitationToSource(text: string): string {
  if (text.includes('敏感') || text.includes('说还是不说')) return '自我'
  if (text.includes('值不值得')) return '关系'
  if (text.includes('怎么回')) return '对方'
  return '关系'
}

/** 纯函数打分：同一次 intake 永远得到同一组题目 */
export function scoreSeed(seed: SeedForContext, intake: IntakeData): number {
  let score = 0
  const wanted = intake.frictionEvents.length
    ? intake.frictionEvents
    : [env.domain.frictionEvents[0] ?? '临时取消']

  if (wanted.includes(seed.stressorType)) score += 10
  if (seed.uncertaintySource === hesitationToSource(intake.hesitationType)) score += 3
  if (intake.boundaryClarity === (env.domain.boundaryLevels[0] ?? '模糊') && seed.constructTarget === 'boundary') {
    score += 3
  }
  const urgent = intake.messageUrgency === (env.domain.messageUrgency[2] ?? '较急')
  if (urgent && (seed.stressorType.includes('回复') || seed.intensity === 'mid-high')) score += 3
  if (intake.priorResponsiveness === (env.domain.priorResponsiveness[2] ?? '经常很慢')) {
    if (seed.stressorType.includes('回复') || seed.stressorType.includes('热度')) score += 2
  }
  if (intake.relationshipType !== (env.domain.relationshipTypes[0] ?? '搭子')) score += 1

  // 自由文本只做关键词提示、不做硬过滤；先过输入侧安全规则
  if (intake.freeText.trim() && !guardUserInput(intake.freeText).blocked) {
    for (const [i, event] of env.domain.frictionEvents.entries()) {
      if (event && intake.freeText.includes(event)) {
        if (seed.stressorType === event) score += 2
        else score += 0.1 * (i + 1) // 仅用于同分时的稳定排序
      }
    }
  }
  return score
}

/** 「据此出题」的可验证摘要，展示在预演页 */
export function selectionBasis(intake: IntakeData): string {
  const parts = [
    intake.frictionEvents.length
      ? intake.frictionEvents.join('、')
      : env.domain.frictionEvents[0] ?? '临时取消',
    `承诺${intake.commitmentLevel}`,
    `对方回复${intake.priorResponsiveness}`,
  ]
  if (intake.messageUrgency === (env.domain.messageUrgency[2] ?? '较急')) parts.push('消息较急')
  if (intake.boundaryClarity === (env.domain.boundaryLevels[0] ?? '模糊')) parts.push('边界模糊')
  return parts.join(' / ')
}

/** 会话内稳定的洗牌种子：同一 intake 重进结果一致，不同场景顺序不同 */
export function sessionSeedOf(intake: IntakeData): number {
  const material = [
    intake.relationshipType,
    intake.commitmentLevel,
    intake.boundaryClarity,
    intake.hesitationType,
    intake.priorResponsiveness,
    intake.messageUrgency,
    ...intake.frictionEvents,
  ].join('|')
  return hashString(material)
}

export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性 Fisher-Yates：顺序只由场景 id 与会话种子决定，不含分类暗示 */
export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let state = seed || 1
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
