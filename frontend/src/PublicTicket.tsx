import { Icon } from './DesignUI';

/** Illustrative ticket from the public design; never represents a signed-in record. */
export default function PublicTicket({ compact = false }: { compact?: boolean }) {
  return <div className={`public-ticket${compact ? ' public-ticket-compact' : ''}`} aria-label="Example application ticket">
    <div className="public-ticket-copy">
      <span className="public-ticket-caption">{compact ? 'My tickets' : 'Barangay Clearance'}</span>
      <strong>TSK-7C21A4</strong>
      {compact ? <span className="public-ticket-service">Barangay Clearance</span> : <>
        <dl><div><dt>Name</dt><dd>Maria L. Santos</dd></div><div><dt>Prepared</dt><dd>17 Nov 2026</dd></div></dl>
        <span className="public-ticket-complete">● Requirements complete</span>
      </>}
    </div>
    <div className="public-ticket-ready"><span><Icon name="check" size={compact ? 20 : 30} /></span><b>Ready</b>{!compact && <small>for review</small>}</div>
  </div>;
}
