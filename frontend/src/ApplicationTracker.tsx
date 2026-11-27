/** Progress reflects saved requirements and the official application status. */
export default function ApplicationTracker({ status, complete }: { status: string; complete: boolean | null }) {
  const decided = status === 'approved' || status === 'rejected';
  const current = decided ? 4 : status === 'submitted' ? 3 : status === 'draft' && complete !== null ? complete ? 3 : 1 : -1;
  const steps = [
    ['Draft', 'Created'],
    ['Documents', current > 1 ? 'Uploaded' : 'In progress'],
    ['TSEK check', current > 2 ? 'Checked' : 'Waiting'],
    ['Barangay review', decided ? 'Reviewed' : status === 'submitted' ? 'Waiting for staff' : complete === true ? 'Submit when ready' : 'Not yet'],
    ['Decision', status === 'approved' ? 'Approved' : status === 'rejected' ? 'Not approved' : 'Not yet'],
  ];
  return <ol className="application-tracker" aria-label="Application progress">
    {steps.map(([label, detail], index) => {
      const done = index < current || (decided && index === 4);
      return <li key={label} aria-current={index === current ? 'step' : undefined}
        className={`${done ? 'is-done' : ''}${index === current ? ' is-current' : ''}${index === 4 && status === 'rejected' ? ' is-rejected' : ''}`}>
        <div className="tracker-line"><span className="tracker-dot" aria-hidden="true">
          {done ? <img src={`/figma/ticket/${index === 4 && status === 'rejected' ? 'step-rejected' : 'step-check'}.svg`} alt="" /> : index + 1}
        </span>{index < steps.length - 1 && <span className="tracker-connector" aria-hidden="true"><span className="tracker-fill" /></span>}</div><strong>{label}</strong><small>{current === -1 && index > 0 ? 'Waiting' : detail}</small>
      </li>;
    })}
  </ol>;
}
