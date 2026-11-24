import CategoryIcon from './CategoryIcon'
import './InsightCard.css'

export default function InsightCard({ insight }) {
  return (
    <article className={`insight-card insight-card--${insight.tone}`}>
      <span className="insight-icon">
        <CategoryIcon name={insight.icon} size={20} />
      </span>
      <p>{insight.text}</p>
    </article>
  )
}

export function InsightCarousel({ insights }) {
  return (
    <div className="insight-carousel" role="list" aria-label="Insights do mês">
      {insights.map((i) => (
        <div role="listitem" key={i.id}>
          <InsightCard insight={i} />
        </div>
      ))}
    </div>
  )
}
