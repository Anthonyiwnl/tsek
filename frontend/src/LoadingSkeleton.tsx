import './loading-skeleton.css';

const Line = ({ short = false }: { short?: boolean }) => <span className={`skeleton-line${short ? ' skeleton-short' : ''}`} />;
/** Decorative placeholders use the same grid/card/row containers as loaded content.
 * Static by design: no shimmer, including for reduced-motion users. */
export function CardsSkeleton() {
  return <div className="application-grid loading-skeleton" aria-hidden="true">{[0, 1, 2].map(i => <article className="workspace-card" key={i}><Line short /><Line /><Line /><Line short /><Line /></article>)}</div>;
}
export function RowsSkeleton() {
  return <div className="requirement-rows loading-skeleton" aria-hidden="true">{[0, 1, 2].map(i => <div className="requirement-row" key={i}><span className="skeleton-icon" /><div className="requirement-copy"><Line /><Line short /></div></div>)}</div>;
}
export function TicketSkeleton() {
  return <div className="loading-skeleton" aria-hidden="true"><section className="ticket-header"><div className="ticket-body"><Line /><Line short /><Line /></div><div className="ticket-stub"><Line /><Line /></div></section><div className="skeleton-tracker" /><div className="ticket-columns"><div className="ticket-stack"><section className="workspace-card"><Line short /><RowsSkeleton /></section><section className="workspace-card"><Line /><Line /></section></div><aside className="workspace-card"><Line /><Line /><Line /></aside></div></div>;
}
export function QueueSkeleton() {
  return <div className="staff-table-wrap loading-skeleton" aria-hidden="true"><table className="staff-table"><tbody>{[0, 1, 2].map(i => <tr key={i}><td><Line /><Line /><Line short /></td><td><Line /></td><td><Line /></td><td><Line /></td></tr>)}</tbody></table></div>;
}
