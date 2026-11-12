import type { EvlnCode } from './types'

/**
 * 场景金标准标注（O-08）—— 与界面数据分离，只用于回归评估。
 *
 * 重要边界：
 * · 12 个场景是构念驱动的自编种子，不是标准化量表，不提供效度证据。
 * · 下面四类是「当前这一份标注」，分布刻意不集中于单一模式；
 *   正式使用前应由 2—3 名评分者独立标注并报告评分者一致性，
 *   再补效标关联效度实验，否则不能宣称场景相关性达标。
 * · 该文件不参与 C 端出题与画像判定，也不显示给使用者。
 */
export const SCENARIO_GOLD: Record<string, EvlnCode> = {
  'cancel-low': 'loyalty',
  'cancel-mid': 'voice',
  'cancel-midhigh': 'exit',
  'cool-low': 'neglect',
  'cool-mid': 'voice',
  'cool-midhigh': 'loyalty',
  'cross-low': 'voice',
  'cross-mid': 'loyalty',
  'cross-midhigh': 'exit',
  'reply-low': 'voice',
  'reply-mid': 'neglect',
  'reply-midhigh': 'loyalty',
}

/**
 * 四类分布的区分度由 tests/ux-regression.mjs 静态校验，
 * 避免「12 个场景期望模式全是同一类」导致回归评估失去判别力。
 */
export const goldOf = (id: string): EvlnCode => SCENARIO_GOLD[id] ?? 'voice'
