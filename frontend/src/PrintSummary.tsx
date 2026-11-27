import { createPortal } from 'react-dom';
import { Button } from './DesignUI';
import './print-summary.css';

const statusLabel: Record<string, string> = { complete: 'Complete', incomplete: 'Incomplete', uncertain: 'Needs staff check' };

/** A local print view of the current citizen's saved readiness results. */
export default function PrintSummary({ reference, service, name, requirements }: {
  reference: string; service: string; name: string;
  requirements: { id: string; name: string; status: string; is_required: boolean }[];
}) {
  return <>
    <Button variant="secondary" onClick={() => window.print()}>Print or save summary</Button>
    {createPortal(<article className="print-summary" aria-label="Counter summary">
      <h1>TSEK · Counter summary</h1>
      <dl><div><dt>Reference</dt><dd>{reference}</dd></div>
        <div><dt>Service</dt><dd>{service}</dd></div>
        <div><dt>Applicant</dt><dd>{name}</dd></div></dl>
      <h2>Document requirements</h2>
      <table><thead><tr><th scope="col">Requirement</th><th scope="col">Status</th></tr></thead>
        <tbody>{requirements.map(item => <tr key={item.id}><td>{item.name}{!item.is_required && ' (optional)'}</td><td>{statusLabel[item.status] || 'Needs staff check'}</td></tr>)}</tbody></table>
      <p><strong>Bring the originals of these documents to the barangay hall.</strong></p>
      <p>The TSK number is a reference for your application, not a place in the barangay queue.</p>
      <p>These saved checks assist preparation. Barangay staff make the final decision.</p>
    </article>, document.body)}
  </>;
}
