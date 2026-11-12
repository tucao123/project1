/** RFR 领域模型：与毕设数据模型、学术指导的构念操作化对齐。 */

export type Intensity = 'low' | 'mid' | 'mid-high' | 'high'
export type EvlnCode = 'voice' | 'exit' | 'loyalty' | 'neglect'
export type ConstructTarget = 'agency' | 'constructiveness' | 'rejection_appraisal' | 'boundary'

/** 情境采集：每个字段都会进入出题打分与场景上下文 */
export interface IntakeData {
  relationshipType: string
  commitmentLevel: string
  boundaryClarity: string
  frictionEvents: string[]
  hesitationType: string
  priorResponsiveness: string
  messageUrgency: string
  freeText: string
  ageConfirmed: boolean
}

/** 单个关键节点的选项：测「实际倾向」，分类标签不进可见 DOM */
export interface ScenarioOption {
  id: string
  evln: EvlnCode
  label: string
  text: string
  agency: number
  constructiveness: number
}

/** 构念驱动场景 */
export interface Scenario {
  id: string
  stressorType: string
  intensity: Intensity
  intensityLabel: string
  uncertaintySource: string
  constructTarget: ConstructTarget
  narrative: string
  context: string[]
  /** 必须包含「对方未按预期回应」的障碍分支 */
  obstacle: string
  options: ScenarioOption[]
  /** 独立金标准标注（scenario-gold.ts），只用于回归评估，不在 C 端界面显示 */
  expectedPattern: EvlnCode
  distractorRationale: string
  /** 迁移场景：单事件时从别的压力事件补一题，避免三题同源 */
  transfer?: boolean
  image: string
}

export interface ResponseRecord {
  scenarioId: string
  optionId: string
  evln: EvlnCode
  optionText: string
  freeText: string
  createdAt: string
}

export interface EvidenceItem {
  scenarioId: string
  scenarioTitle: string
  choiceText: string
  evlnLabel: string
  inference: string
  evln: EvlnCode
}

/**
 * 应对模式画像：双连续维度只用于定位与描述，标签由「选择众数」决定。
 * 混合选择（最大类占比 < 60%）时不输出单一标签。
 */
export interface CopingProfile {
  agency: number
  constructiveness: number
  quadrant: EvlnCode | null
  label: string
  mixed: boolean
  counts: Record<EvlnCode, number>
  dominant: EvlnCode | null
  dominantCount: number
  total: number
  /** 一致性 = 最大类票数 / 总票数 × 100，不代表测得准不准 */
  consistency: number
  evidence: EvidenceItem[]
}

export interface ScriptBranch {
  key: string
  text: string
  adverse: boolean
}

export interface ActionScript {
  actionText: string
  highlight: [number, number]
  branches: ScriptBranch[]
  fallback: string
  stopCondition: string
  /** 低期望条件下先处理可行性信念，不直接推计划 */
  feasibilityFirst: boolean
  note: string
  /** 本次针对的压力事件（多选时明确标注，不假装覆盖全部） */
  focus: string
  /** 让用户看到「选择 → 画像 → 脚本」链路闭合 */
  basedOn: string
}

export interface ArchiveEntry {
  id: string
  date: string
  relationshipType: string
  frictionEvents: string[]
  profileLabel: string
  scenarioCount: number
  version: number
  /** 预置演示数据标识；真实记录无此标记 */
  isSample?: boolean
  /** 真实记录写入的主动程度，用于按练习计算趋势 */
  agency?: number
}

export interface RoleCard {
  version: number
  personaParams: { label: string; value: number }[]
  relationshipParams: { label: string; value: string }[]
  memorySummary: string
}
