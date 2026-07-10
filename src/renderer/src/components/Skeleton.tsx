/** Pulsing placeholder used while lists load, instead of spinners. */
export function Skeleton({ className = "" }: { className?: string }): React.JSX.Element {
  return <span className={`skeleton ${className}`} aria-hidden />
}

/** A card-shaped skeleton row matching the content grid. */
export function SkeletonCard(): React.JSX.Element {
  return (
    <div className="skeleton-card" aria-hidden>
      <Skeleton className="skeleton--icon" />
      <div className="skeleton-card__body">
        <Skeleton className="skeleton--line skeleton--w60" />
        <Skeleton className="skeleton--line skeleton--w90" />
        <Skeleton className="skeleton--line skeleton--w40" />
      </div>
    </div>
  )
}
