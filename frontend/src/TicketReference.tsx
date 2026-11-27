import { useState, type CSSProperties } from 'react';

export default function TicketReference({ reference, created }: { reference: string; created: boolean }) {
  // Captured once: refreshes never replay a creation event.
  const [animate] = useState(created);
  return <div className="ticket-reference-block">
    <p className="ticket-reference"><span className="sr-only" role={animate ? 'status' : undefined}>{animate ? 'Application created. ' : ''}Reference: {reference}</span>
      <span aria-hidden="true">Reference: <span className={animate ? 'reference-tiles is-created' : 'reference-tiles'}>{[...reference].map((letter, index, all) => <span key={index} style={{ '--tile-delay': `${index * 200 / all.length}ms` } as CSSProperties}>{letter}</span>)}</span>
    </span></p>
    <p className={animate ? 'reference-note is-created' : 'reference-note'}>Your TSK number is a reference, not a place in the barangay queue.</p>
  </div>;
}

