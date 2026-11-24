export default function Skeleton({ height = 16, width = '100%', radius, style }) {
  return <span className="skeleton" style={{ display: 'block', height, width, borderRadius: radius, ...style }} aria-hidden="true" />
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row">
          <Skeleton width={42} height={42} radius={14} />
          <div className="grow stack-sm">
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="35%" />
          </div>
          <Skeleton width={70} height={16} />
        </div>
      ))}
    </div>
  )
}
