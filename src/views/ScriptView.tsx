import { useEffect, useState } from 'react'
import { env } from '../config/env'
import { Typewriter } from '../components/motion'
import { Notice } from '../components/style-atoms'
import { useRfr } from '../state/RfrContext'

/** 陪练页：一句话 + 备用做法 + 反馈 */
export function ScriptView({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const r = useRfr()
  const [revealed, setRevealed] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    setRevealed(false)
  }, [r.scriptRunId])

  const script = r.script

  if (!script) {
    return (
      <section className="view is-active" id="view-script">
        <div className="layout-grid">
          <div className="col-center">
            <div className="card pad-card stagger-item">
              <div className="script-label">第四步 · 陪练</div>
              <div className="profile-title">先完成一次预演</div>
              <p className="card-desc mt-16">
                做完预演，这里会给你一句可以试着说的话。
              </p>
              <div className="mt-32">
                <button type="button" className="btn-primary" onClick={onBack}>
                  返回
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="view is-active" id="view-script">
      <div className="layout-grid">
        <div className="col-center">
          <div className="card script-card stagger-item" style={{ padding: 40 }}>
            <div className="row-between mb-24">
              <div>
                <div className="script-label" style={{ marginBottom: 0 }}>
                  开口前，先练一遍
                </div>
                <div className="card-desc">{env.flow.scriptHint}</div>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                id="generateBtn"
                disabled={!r.scriptUnlocked}
                onClick={r.regenerateScript}
              >
                再放一遍
              </button>
            </div>

            {!r.scriptUnlocked ? (
              <div className="paywall">
                <div className="paywall-title">{env.panel.lockTitle}</div>
                <p>{env.panel.lockDesc}</p>
                <div className="mt-24">
                  <button type="button" className="btn-primary" onClick={() => r.openPanel(1)}>
                    {env.panel.lockButton}
                  </button>
                </div>
              </div>
            ) : (
              <div className="script-note">
                <div className="script-label">可以这样说</div>
                <Typewriter
                  text={script.actionText}
                  highlight={script.highlight}
                  runId={r.scriptRunId}
                  speed={32}
                  onDone={() => setRevealed(true)}
                />

                <div className="divider" />
                <div className="branch-grid">
                  {script.branches.map((b, i) => (
                    <div
                      className={`script-sub${revealed ? ' visible' : ''}`}
                      key={`${b.key}-${i}`}
                      style={{ transitionDelay: `${i * 0.12}s`, marginBottom: 0 }}
                    >
                      <strong>{b.adverse ? '不太好接时' : `对方可能 ${i + 1}`}</strong>
                      <span>{b.key}，{b.text}</span>
                    </div>
                  ))}
                  <div
                    className={`script-sub${revealed ? ' visible' : ''}`}
                    style={{ transitionDelay: '0.4s', marginBottom: 0 }}
                  >
                    <strong>备用做法</strong>
                    <span>{script.fallback}</span>
                  </div>
                  <div
                    className={`script-sub${revealed ? ' visible' : ''}`}
                    style={{ transitionDelay: '0.5s', marginBottom: 0 }}
                  >
                    <strong>什么时候停</strong>
                    <span>{script.stopCondition}</span>
                  </div>
                </div>
              </div>
            )}

            {script.feasibilityFirst && r.scriptUnlocked ? (
              <div className="mt-24">
                <Notice variant="acid">
                  先想清楚值不值得，再决定要不要开口。
                </Notice>
              </div>
            ) : null}

            {r.scriptUnlocked ? (
              <div className="mt-24">
                <Notice variant="acid">{script.note}</Notice>
              </div>
            ) : null}
          </div>

          {env.features.feedback ? (
            <div className="card pad-card stagger-item">
              <div className="script-label">事后记一笔</div>
              <div className="card-title">这次动作，后来执行了吗？</div>
              <p className="card-desc mb-16">仅作自己的记录，不参与效果评估。</p>
              <div className="row-wrap mb-16">
                <button
                  type="button"
                  className={`chip${r.feedback.executed === true ? ' is-selected' : ''}`}
                  onClick={() => r.submitFeedback(true, note)}
                >
                  说了
                </button>
                <button
                  type="button"
                  className={`chip${r.feedback.executed === false ? ' is-selected' : ''}`}
                  onClick={() => r.submitFeedback(false, note)}
                >
                  没说
                </button>
              </div>
              <textarea
                className="text-area"
                rows={2}
                placeholder="后来怎么样了？（选填）"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="field-hint mt-8">
                {r.feedbackConsent
                  ? '已授权，会更新角色卡'
                  : '未授权，只记在这里'}
              </div>
              <div className="row-wrap mt-24">
                <button type="button" className="btn-dark" onClick={onNext}>
                  看档案
                </button>
                <button type="button" className="btn-ghost" onClick={onBack}>
                  返回
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
