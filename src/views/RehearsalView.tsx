import { useEffect, useState } from 'react'
import { env } from '../config/env'
import { Gallery3D, type GalleryItemData } from '../components/motion'
import { Badge, Notice } from '../components/style-atoms'
import { constructLabel } from '../domain/scenarios'
import { useRfr } from '../state/RfrContext'

/** 预演页：场景与选择 */
export function RehearsalView({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const r = useRfr()
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft('')
  }, [r.activeScenarioId])

  if (!r.scenarios.length) {
    return (
      <section className="view is-active" id="view-rehearsal">
        <div className="layout-grid">
          <div className="col-center">
            <div className="card pad-card stagger-item">
              <div className="script-label">第二步 · 预演</div>
              <div className="profile-title">还没有可预演的场景</div>
              <p className="card-desc mt-16">
                先回上一步填一下情况，这里才会有题目。
              </p>
              <div className="mt-32">
                <button type="button" className="btn-primary" onClick={onBack}>
                  返回上一步
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const scenario =
    r.scenarios.find((s) => s.id === r.activeScenarioId) ?? r.scenarios[r.scenarios.length - 1]
  const answered = r.responses.find((x) => x.scenarioId === scenario.id)

  const galleryItems: GalleryItemData[] = r.scenarios.map((s) => {
    const done = r.responses.some((x) => x.scenarioId === s.id)
    return {
      id: s.id,
      image: s.image,
      alt: s.stressorType,
      tag: done ? '已答' : s.intensityLabel,
      title: s.stressorType,
      meta: s.narrative.slice(0, 24),
      tags: [s.intensityLabel],
      selected: s.id === scenario.id,
    }
  })

  const handleFinish = () => {
    r.finishRehearsal()
    onFinish()
  }

  return (
    <section className="view is-active" id="view-rehearsal">
      <div className="layout-grid">
        <div className="col-left">
          <div className="card data-card stagger-item">
            <div>
              <div className="script-label">进度</div>
              <div className="profile-title">
                {r.responses.length} / {r.scenarios.length}
              </div>
              <p className="card-desc mt-8">
                答完这几题，就能看到你的应对方式。
              </p>
            </div>

            <div>
              <div className="micro-label mb-8">从轻松到有点难</div>
              <div className="intensity-track">
                {r.scenarios.map((s, i) => (
                  <div
                    key={s.id}
                    className={`intensity-step${
                      r.responses.some((x) => x.scenarioId === s.id)
                        ? ' is-done'
                        : i === r.scenarios.indexOf(scenario)
                          ? ' is-current'
                          : ''
                    }`}
                  />
                ))}
              </div>
              <div className="row-between mt-8">
                {r.scenarios.map((s) => (
                  <span className="micro-label" key={s.id}>{s.intensityLabel}</span>
                ))}
              </div>
            </div>

            <div className="badge-row">
              <Badge variant="outline">共 {r.scenarios.length} 题</Badge>
            </div>

            {/* O-04：把「据此出题」变成用户可以自己核对的一行 */}
            <div className="basis-line">
              {env.ui.basis
                .replace('{basis}', r.basis)
                .replace('{n}', String(r.scenarios.length))}
            </div>
            <Notice>{env.ui.noAnswerHint}</Notice>

            <button
              type="button"
              className="btn-primary"
              disabled={!r.allAnswered}
              onClick={handleFinish}
            >
              看看结果
            </button>
            {!r.allAnswered ? (
              <div className="field-hint">答完才能看结果。</div>
            ) : null}
          </div>

          <div className="card choice-panel stagger-item">
            <div className="row-between mb-16">
              <div className="script-label" style={{ marginBottom: 0 }}>
                第 {r.scenarios.indexOf(scenario) + 1} 题
              </div>
              <div className="badge-row">
                {scenario.transfer ? <Badge variant="outline">{env.ui.transfer}</Badge> : null}
                <Badge variant="acid">{scenario.stressorType}</Badge>
              </div>
            </div>
            <p className="scenario-narrative mb-16">{scenario.narrative}</p>
            <div className="badge-row mb-16">
              {scenario.context.map((c) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </div>
            <div className="field-hint mb-16">
              {env.ui.construct.replace('{construct}', constructLabel(scenario.constructTarget))}
            </div>

            <div className="choice-prompt">{env.flow.choicePrompt}</div>
            <div className="choice-list">
              {scenario.options.map((o, i) => (
                <button
                  type="button"
                  key={o.id}
                  className={`choice-btn${answered?.optionId === o.id ? ' is-selected' : ''}`}
                  onClick={() => r.chooseOption(o.id, draft)}
                  data-evln={o.evln}
                >
                  <span className="choice-key">{String.fromCharCode(65 + i)}</span>
                  <span>{o.text}</span>
                </button>
              ))}
            </div>

            <textarea
              className="text-area mt-16"
              rows={2}
              placeholder="当时在想什么？（选填）"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />

            {answered ? (
              <>
                <div className="obstacle-box mt-16">
                  <strong>如果对方没接住</strong>
                  <br />
                  {scenario.obstacle}
                  <br />
                  <span className="muted">
                    陪练里会给你备用做法。
                  </span>
                </div>
                <div className="row-wrap mt-16">
                  <button type="button" className="btn-dark" onClick={r.goToNextScenario}>
                    下一题
                  </button>
                  {r.allAnswered ? <Badge variant="acid">答完了</Badge> : null}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="col-right">
          <div className="card exhibition-card stagger-item">
            <div className="section-header">
              <h2>Exhibitions</h2>
              <p>点卡片可以换题。</p>
            </div>
            <Gallery3D items={galleryItems} onSelect={r.setActiveScenarioId} />
            <div className="divider" />
            <div className="row-between">
              <span className="micro-label">从轻松到有点难</span>
              <Badge variant="outline">共 {r.scenarios.length} 题</Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
