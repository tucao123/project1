import { env } from '../config/env'
import { TrendLine } from '../components/Charts'
import { Badge, Notice } from '../components/style-atoms'
import { groupDistribution, groupTrendLabel, withdrawalTrend } from '../domain/mock'

/** 群体页：只看整体，不回推个人 */
export function GroupView() {
  const distribution = groupDistribution()

  return (
    <section className="view is-active" id="view-group">
      <div className="layout-grid">
        <div className="col-left">
          <div className="card pad-card stagger-item">
            <div className="row-between mb-16">
              <div>
                <div className="script-label">给老师和管理员看</div>
                <div className="card-title">大家怎么选的</div>
                <div className="card-desc">只看整体，不看个人</div>
              </div>
              <Badge variant="acid">仅整体数据</Badge>
            </div>

            <div className="stat-grid mb-24">
              <div className="stat-box">
                <div className="stat-value">{env.group.sampleSize}</div>
                <div className="stat-label">参与人数</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{distribution.length}</div>
                <div className="stat-label">应对方式</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">0</div>
                <div className="stat-label">个人信息</div>
              </div>
            </div>

            {distribution.map((d) => (
              <div className="bar-row" key={d.label}>
                <div className="bar-name">{d.label}</div>
                <div className="bar-track">
                  <div className={`bar-fill${d.accent ? ' is-accent' : ''}`} style={{ width: `${d.value}%` }} />
                </div>
                <div className="bar-value">{d.value}%</div>
              </div>
            ))}

            <div className="divider" />
            <Notice variant="acid">
              <strong>{env.group.notice}</strong>
            </Notice>
            <div className="field-hint mt-16">
              看不到任何一个人的答案。
            </div>
          </div>
        </div>

        <div className="col-right">
          <div className="card pad-card stagger-item">
            <div className="row-between mb-8">
              <div className="script-label" style={{ marginBottom: 0 }}>几批人的变化</div>
              <Badge variant="outline">占比</Badge>
            </div>
            <div className="card-desc mb-16">{groupTrendLabel}</div>
            <TrendLine values={withdrawalTrend} labels={env.group.batchLabels} />
            <div className="field-hint mt-16">
              只用来挑下次聊什么。
            </div>
          </div>

          <div className="card pad-card stagger-item">
            <div className="script-label">怎么聊</div>
            <div className="profile-title mt-8">把分布当作情境，不是性格</div>
            <p className="card-desc mt-16">{env.group.discussionGuide}</p>
            <div className="divider" />
            <div className="badge-row mb-16">
              <Badge variant="dark">不展示个体身份</Badge>
              <Badge variant="outline">不回推个人</Badge>
              <Badge variant="outline">不给群体贴标签</Badge>
            </div>
            <Notice variant="dark">只用于课堂讨论，不用来评价任何人。</Notice>
          </div>
        </div>
      </div>
    </section>
  )
}
