import { env } from '../config/env'
import { TrendLine } from '../components/Charts'
import { Badge, KV, Notice } from '../components/style-atoms'
import { practiceTrend } from '../domain/mock'
import { useRfr } from '../state/RfrContext'

/** 档案页：记录 / 练习设定 / 由真实记录算出的变化 */
export function ArchiveView({ onBack }: { onBack: () => void }) {
  const r = useRfr()
  const trend = practiceTrend(r.archive)
  const realCount = r.archive.filter((a) => !a.isSample).length

  return (
    <section className="view is-active" id="view-archive">
      <div className="layout-grid">
        <div className="col-left">
          <div className="card pad-card stagger-item">
            <div className="row-between mb-16">
              <div>
                <div className="script-label">我的记录</div>
                <div className="card-title">以前的练习</div>
              </div>
              <Badge variant="acid">{r.archive.length} 条</Badge>
            </div>
            <div className="card-desc mb-24">导出与删除在右上角「{env.panel.trigger}」面板。</div>

            {r.archive.length ? (
              r.archive.map((a) => (
                <div className="archive-item" key={a.id}>
                  <div>
                    <div className="archive-title">{a.relationshipType} · {a.profileLabel}</div>
                    <div className="archive-meta">
                      {a.date} · {a.frictionEvents.join(' / ')} · {a.scenarioCount} 个场景 · 第 {a.version} 版
                    </div>
                  </div>
                  <Badge variant={a.isSample ? 'outline' : 'default'}>
                    {a.isSample ? env.ui.archiveSample : env.ui.archiveLocal}
                  </Badge>
                </div>
              ))
            ) : (
              <Notice>还没有记录，先做一次练习。</Notice>
            )}

            <div className="row-wrap mt-24">
              <button type="button" className="btn-ghost" onClick={onBack}>返回</button>
              <button type="button" className="btn-dark" onClick={() => r.openPanel(3)}>
                {env.panel.tabs[3] ?? '管理'}
              </button>
            </div>
          </div>

          {env.features.weeklyTrend ? (
            <div className="card pad-card stagger-item">
              <div className="script-label">这几周</div>
              <div className="card-title">{env.ui.trendTitle}</div>
              {trend.sufficient ? (
                <>
                  <div className="card-desc mb-16">按每次练习的主动程度排，不是预测。</div>
                  <TrendLine values={trend.values} labels={trend.labels} />
                  <div className="divider" />
                  <div className="stat-grid">
                    <div className="stat-box">
                      <div className="stat-value">{realCount}</div>
                      <div className="stat-label">练习次数</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">v{r.roleCard.version}</div>
                      <div className="stat-label">角色卡版本</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">{trend.values[trend.values.length - 1]}</div>
                      <div className="stat-label">最近一次</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-16">
                  <Notice>{env.ui.trendEmpty}</Notice>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="col-right">
          {env.features.roleCard ? (
            <div className="card pad-card stagger-item">
              <div className="row-between mb-16">
                <div>
                  <div className="script-label">练习里的对方</div>
                  <div className="card-title">对方的样子</div>
                  <div className="card-desc">只是练习设定，不是真实统计。</div>
                </div>
                <Badge variant="acid">第 {r.roleCard.version} 版</Badge>
              </div>

              <div className="micro-label mb-8">几个设定</div>
              {r.roleCard.personaParams.map((p) => (
                <div className="score-row mb-8" key={p.label}>
                  <span style={{ minWidth: 92 }}>{p.label}</span>
                  <div className="score-bar"><i style={{ width: `${p.value}%` }} /></div>
                  <span className="score-value">{p.value}</span>
                </div>
              ))}

              <div className="divider" />
              <div className="micro-label mb-8">关系设定</div>
              {r.roleCard.relationshipParams.map((p) => (
                <KV k={p.label} v={p.value} key={p.label} />
              ))}

              <div className="mt-16"><Notice>{r.roleCard.memorySummary}</Notice></div>
              <div className="field-hint mt-16">
                {r.feedbackConsent ? '已授权，反馈会微调上面的数值。' : '未授权，数值不会变。'}
              </div>
            </div>
          ) : null}

          <div className="card pad-card stagger-item">
            <div className="script-label">关于隐私</div>
            <div className="field-hint mt-8">{env.compliance.disclaimerFull}</div>
            <div className="field-hint mt-8">{env.compliance.hotlineName} · {env.compliance.hotlineNumber}</div>
            <div className="field-hint mt-8">记录只存在这台设备，清除浏览器数据即清空。</div>
          </div>
        </div>
      </div>
    </section>
  )
}
