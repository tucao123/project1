/** RFR 领域模型：与 PRD §5 数据模型、学术指导 §4 的构念操作化对齐。 */

export type Intensity = 'low' | 'mid' | 'mid-high' | 'high'
export type EvlnCode = 'voice' | 'exit' | 'loyalty' | 'neglect'
export type ConstructTarget = 'agency' | 'constructiveness' | 'rejection_appraisal' | 'boundary'

/** F-C1 关系情境采集 */
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

/** 单个关键节点的选项（SJT：测「实际倾向」，措辞由 env 固定） */
export interface ScenarioOption {
  id: string
  evln: EvlnCode
  label: string
  text: string
  agency: number
  constructiveness: number
}

/** 构念驱动场景模板（学术 §4.3） */
export interface Scenario {
  id: string
  stressorType: string
  intensity: Intensity
  intensityLabel: string
  uncertaintySource: string
  constructTarget: ConstructTarget
  narrative: string
  context: string[]
  /** MCII 硬约束：必须包含「对方未按预期回应」的障碍分支 */
  obstacle: string
  options: ScenarioOption[]
  /** F-S1 种子场景标注：专家期望模式，仅用于回归评估，不在 C 端界面显示 */
  expectedPattern: EvlnCode
  distractorRationale: string
  image: string
}

/** F-C2 用户在 interrupt() 暂停点的选择 */
export interface ResponseRecord {
  scenarioId: string
  optionId: string
  evln: EvlnCode
  optionText: string
  freeText: string
  createdAt: string
}

/** F-C3 证据回溯链的一条 */
export interface EvidenceItem {
  scenarioId: string
  scenarioTitle: string
  choiceText: string
  evlnLabel: string
  inference: string
}

/** 学术 §4.2 方案 B：双连续维度输出，前端按象限给可读名称 */
export interface CopingProfile {
  agency: number
  constructiveness: number
  quadrant: EvlnCode
  label: string
  confidence: number
  dataConfidence: 'high' | 'medium' | 'low'
  evidence: EvidenceItem[]
}

/** F-C4 if-then 执行意图脚本（学术 §4.6） */
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
  /** 低期望条件下先处理可行性信念，不直接推计划（学术 §4.4） */
  feasibilityFirst: boolean
  note: string
}

/** F-C7 关系档案 */
export interface ArchiveEntry {
  id: string
  date: string
  relationshipType: string
  frictionEvents: string[]
  profileLabel: string
  scenarioCount: number
  version: number
}

/** F-C5 角色卡（毕设简化：3—5 个可调维度） */
export interface RoleCard {
  version: number
  personaParams: { label: string; value: number }[]
  relationshipParams: { label: string; value: string }[]
  memorySummary: string
}
