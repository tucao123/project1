import { useState } from 'react'
import { env } from '../config/env'
import { WaveCanvas } from '../components/motion'
import { ArtImage, Badge, ChipGroup, Field, Notice } from '../components/style-atoms'
import { crisisResourceLine } from '../domain/compliance'
import { useRfr } from '../state/RfrContext'

/** 观察页：说说情况 + 年龄确认 */
export function IntakeView({ onStart }: { onStart: () => void }) {
  const r = useRfr()
  const [attempted, setAttempted] = useState(false)

  const blockers: string[] = []
  if (!r.ageConfirmed) blockers.push('请先完成年龄确认')
  if (!r.intake.frictionEvents.length) blockers.push('请至少选择一类压力事件')
  if (r.guard.blocked) blockers.push(r.guard.message ?? '输入未通过合规检查')

  const handleStart = () => {
    setAttempted(true)
    if (!r.startRehearsal()) return
    onStart()
  }

  return (
    <section className="view is-active" id="view-intake">
      <div className="layout-grid">
        <div className="col-left">
          {/* Hero：原品牌卡片，文案全部来自 env */}
          <div className="card hero-card stagger-item">
            <div>
              <h1>
                {env.app.heroLine1} <em>{env.app.heroEm1}</em>
                <br />
                {env.app.heroLine2}
                <br />
                <em>{env.app.heroEm2}</em>
              </h1>
              <p className="hero-desc">{env.app.heroDesc}</p>
            </div>
            <div className="btn-group">
              <button type="button" className="btn-primary" onClick={handleStart}>
                {env.app.heroCta}
              </button>
              <span className="micro-label">{env.compliance.disclaimerShort}</span>
            </div>
          </div>

          <WaveCanvas
            title={env.app.waveTitle}
            status={env.app.waveStatus}
            className="stagger-item"
          />
        </div>

        <div className="col-right">
          <div className="card pad-card stagger-item">
            <div className="row-between mb-24">
              <div>
                <div className="script-label">第一步 · 说说情况</div>
                <div className="card-title">先说说发生了什么</div>
                <div className="card-desc">选一选你遇到的情况，我们据此出题。</div>
              </div>
              <Badge variant="outline">免费</Badge>
            </div>

            {/* 年龄确认 */}
            {!r.ageConfirmed ? (
              <div className="gate-card mb-24" style={{ background: 'var(--gray-light)', borderRadius: 20 }}>
                <div className="gate-title">先确认一下</div>
                <p className="card-desc mb-16">{env.compliance.ageGateText}</p>
                <label className="checkbox-line">
                  <input type="checkbox" checked={false} onChange={r.confirmAge} />
                  <span>我已满 18 岁，明白这不是心理咨询。</span>
                </label>
              </div>
            ) : (
              <div className="row-between mb-24">
                <Badge variant="acid">已满 18 岁</Badge>
                <span className="micro-label">首次使用需确认</span>
              </div>
            )}

            <div className="stack" style={{ gap: 22 }}>
              <Field label="你们是什么关系">
                <ChipGroup
                  options={env.domain.relationshipTypes}
                  value={r.intake.relationshipType}
                  onChange={(v) => r.patchIntake({ relationshipType: v as string })}
                />
              </Field>

              <Field label="你有多在意">
                <ChipGroup
                  options={env.domain.commitmentLevels}
                  value={r.intake.commitmentLevel}
                  onChange={(v) => r.patchIntake({ commitmentLevel: v as string })}
                />
              </Field>

              <Field label="你的底线清楚吗">
                <ChipGroup
                  options={env.domain.boundaryLevels}
                  value={r.intake.boundaryClarity}
                  onChange={(v) => r.patchIntake({ boundaryClarity: v as string })}
                />
              </Field>

              <Field label="发生了什么（可多选）">
                <ChipGroup
                  multi
                  options={env.domain.frictionEvents}
                  value={r.intake.frictionEvents}
                  onChange={(v) => r.patchIntake({ frictionEvents: v as string[] })}
                />
              </Field>

              <Field label="你在纠结什么">
                <ChipGroup
                  options={env.domain.hesitationTypes}
                  value={r.intake.hesitationType}
                  onChange={(v) => r.patchIntake({ hesitationType: v as string })}
                />
              </Field>

              <div className="divider" />
              <div className="micro-label">再补充两点</div>
              <div className="row-wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Field label="对方平时回消息">
                    <ChipGroup
                      options={env.domain.priorResponsiveness}
                      value={r.intake.priorResponsiveness}
                      onChange={(v) => r.patchIntake({ priorResponsiveness: v as string })}
                    />
                  </Field>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Field label="这条消息急不急">
                    <ChipGroup
                      options={env.domain.messageUrgency}
                      value={r.intake.messageUrgency}
                      onChange={(v) => r.patchIntake({ messageUrgency: v as string })}
                    />
                  </Field>
                </div>
              </div>
              <div className="field-hint">
                这两点会影响题目，所以先问一下。
              </div>

              <Field label="想补充的话（选填）" hint="别写姓名、电话等能认出人的信息。">
                <textarea
                  className="text-area"
                  rows={4}
                  maxLength={env.flow.maxFreeTextLength}
                  placeholder="例如：约好去看展，出发前对方说「下次吧」。"
                  value={r.intake.freeText}
                  onChange={(e) =>
                    r.patchIntake({ freeText: e.target.value.slice(0, env.flow.maxFreeTextLength) })
                  }
                />
                <div className="char-count">
                  {r.intake.freeText.length} / {env.flow.maxFreeTextLength}
                </div>
              </Field>

              {r.guard.blocked ? (
                <Notice variant={r.guard.kind === 'high_risk' ? 'danger' : 'acid'}>
                  {r.guard.message}
                </Notice>
              ) : null}

              {r.guard.showResource ? (
                <Notice variant="dark">
                  <strong>{crisisResourceLine}</strong>
                  <br />
                  {env.compliance.crisisResource}
                </Notice>
              ) : null}

              {attempted && blockers.length ? (
                <Notice variant="danger">{blockers.join('；')}</Notice>
              ) : null}

              <div className="row-wrap">
                <button type="button" className="btn-primary" onClick={handleStart}>
                  开始预演
                </button>
                <span className="micro-label">免费</span>
              </div>

              <Notice variant="acid">
                {env.compliance.disclaimerFull}
              </Notice>
            </div>
          </div>

          {/* 保留原风格的画作大卡 */}
          <div className="card stagger-item" style={{ height: 220, minHeight: 220, position: 'relative' }}>
            <ArtImage src={env.app.brandImage} alt="RFR · relational friction" />
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 2,
                background: 'linear-gradient(110deg, rgba(255,255,255,0.2) 0%, transparent 40%), repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 12px, transparent 15px)',
                mixBlendMode: 'overlay', pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
