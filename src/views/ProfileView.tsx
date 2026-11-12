import { env } from '../config/env'
import { Badge, Notice } from '../components/style-atoms'
import { profileNarrative } from '../domain/evln'
import { useRfr } from '../state/RfrContext'
import type { CopingProfile } from '../domain/types'

/** 画像页：两维象限 + 选择回溯 */
function Quadrant({ profile }: { profile: CopingProfile }) {
  const X0 = 44
  const X1 = 304
  const Y0 = 20
  const Y1 = 260
  const midX = (X0 + X1) / 2
  const midY = (Y0 + Y1) / 2
  const px = X0 + (profile.agency / 100) * (X1 - X0)
  const py = Y1 - (profile.constructiveness / 100) * (Y1 - Y0)

  const hit =
    profile.quadrant === 'voice' ? { x: midX, y: Y0, w: midX - X0, h: midY - Y0 }
    : profile.quadrant === 'exit' ? { x: midX, y: midY, w: midX - X0, h: Y1 - midY }
    : profile.quadrant === 'loyalty' ? { x: X0, y: Y0, w: midX - X0, h: midY - Y0 }
    : { x: X0, y: midY, w: midX - X0, h: Y1 - midY }

  const labels = env.flow.evlnLabels
  const cell = (text: string, x: number, y: number) => (
    <text x={x} y={y} fontSize="10" fontWeight="600" fill="#8A8A8A" fontFamily="Inter, sans-serif">
      {text}
    </text>
  )

  return (
    <svg className="quadrant-svg" viewBox="0 0 340 300" role="img" aria-label="应对方式图">
      <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} rx="12" fill="#F5F5F5" />
      <rect x={hit.x} y={hit.y} width={hit.w} height={hit.h} fill="#E4FF00" opacity="0.42" />
      <line x1={midX} y1={Y0} x2={midX} y2={Y1} stroke="#D2D2D2" strokeWidth="1" />
      <line x1={X0} y1={midY} x2={X1} y2={midY} stroke="#D2D2D2" strokeWidth="1" />
      <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="#121212" strokeWidth="1.5" />
      <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="#121212" strokeWidth="1.5" />

      {cell(labels[0] ?? '说出来，好好说', midX + 10, Y0 + 20)}
      {cell(labels[1] ?? '说出来，带点刺', midX + 10, Y1 - 12)}
      {cell(labels[2] ?? '先忍着，等一等', X0 + 10, Y0 + 20)}
      {cell(labels[3] ?? '不回应，冷处理', X0 + 10, Y1 - 12)}

      <text x={midX} y="12" fontSize="10" fill="#121212" textAnchor="middle" fontFamily="Inter, sans-serif">
        {env.flow.axisConstructive}
      </text>
      <text x={midX} y="282" fontSize="10" fill="#121212" textAnchor="middle" fontFamily="Inter, sans-serif">
        {env.flow.axisDestructive}
      </text>
      <text x="20" y={midY + 4} fontSize="10" fill="#121212" textAnchor="middle" fontFamily="Inter, sans-serif">
        {env.flow.axisPassive}
      </text>
      <text x="322" y={midY + 4} fontSize="10" fill="#121212" textAnchor="middle" fontFamily="Inter, sans-serif">
        {env.flow.axisActive}
      </text>

      <circle cx={px} cy={py} r="14" fill="#E4FF00" opacity="0.35" />
      <circle cx={px} cy={py} r="8" fill="#E4FF00" stroke="#121212" strokeWidth="3" />
      <text x={px + 14} y={py - 12} fontSize="9" fontWeight="700" fill="#121212" fontFamily="Inter, sans-serif">
        你
      </text>
    </svg>
  )
}

/** 03 画像 · F-C3 应对模式画像（原「韧性画像」已按学术 §4.1 更名） */
export function ProfileView({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const r = useRfr()
  const hasData = r.profile.confidence > 0

  if (!hasData) {
    return (
      <section className="view is-active" id="view-profile">
        <div className="layout-grid">
          <div className="col-center">
            <div className="card pad-card stagger-item">
              <div className="script-label">第三步 · 结果</div>
              <div className="profile-title">还没有结果</div>
              <p className="card-desc mt-16">
                先做完预演，这里才会显示。
              </p>
              <div className="mt-32">
                <button type="button" className="btn-primary" onClick={onBack}>
                  返回预演
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="view is-active" id="view-profile">
      <div className="layout-grid">
        <div className="col-left">
          <div className="card data-card stagger-item">
            <div>
              <div className="script-label">你的应对方式</div>
              <div className="profile-title">{r.profile.label}</div>
              <p className="card-desc mt-8">{env.flow.profileSubtitle}</p>
              <div className="badge-row mt-16">
                <Badge variant="acid">把握 {r.profile.confidence}%</Badge>
                <Badge variant="outline">来自 {r.profile.evidence.length} 次选择</Badge>
              </div>
            </div>

            <div className="quadrant-wrap">
              <Quadrant profile={r.profile} />
              <div className="micro-label mt-16 mb-8">两方面的倾向</div>
              <div className="score-row mb-8">
                <span style={{ minWidth: 92 }}>会不会主动说</span>
                <div className="score-bar"><i style={{ width: `${r.profile.agency}%` }} /></div>
                <span className="score-value">{r.profile.agency}</span>
              </div>
              <div className="score-row">
                <span style={{ minWidth: 92 }}>好好说还是带情绪</span>
                <div className="score-bar"><i style={{ width: `${r.profile.constructiveness}%` }} /></div>
                <span className="score-value">{r.profile.constructiveness}</span>
              </div>
            </div>

            <Notice variant="acid">这只描述刚才的选择，不是性格。</Notice>
          </div>
        </div>

        <div className="col-right">
          <div className="card data-card stagger-item">
            <div>
              <div className="script-label">怎么得出的</div>
              <div className="card-title">每次选择都在这里</div>
              <div className="card-desc">下面每一条都对得上你刚才选的。</div>
            </div>
            <ul className="evidence-list">
              {r.profile.evidence.map((e, i) => (
                <li className="evidence-item" key={e.scenarioId}>
                  <span>第 {i + 1} 题</span>
                  <div>
                    <div className="evidence-head">{e.scenarioTitle} · {e.evlnLabel}</div>
                    你倾向 <b>「{e.choiceText}」</b>
                    <div className="evidence-chain">{e.inference}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card pad-card stagger-item">
            <div className="script-label">说明一下</div>
            <p className="card-desc mt-8">{profileNarrative(r.profile)}</p>
            <div className="divider" />
            <div className="badge-row mb-16">
              <Badge variant="dark">不是性格</Badge>
              <Badge variant="outline">不判断关系</Badge>
            </div>
            <Notice variant="dark">{env.compliance.disclaimerFull}</Notice>
            <div className="row-wrap mt-24">
              <button type="button" className="btn-primary" onClick={onNext}>
                去练一遍
              </button>
              <button type="button" className="btn-ghost" onClick={onBack}>
                返回
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
