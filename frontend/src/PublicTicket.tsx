import { useCopy } from './i18n';
import { Icon } from './DesignUI';

/** Illustrative ticket from the public design; never represents a signed-in record. */
export default function PublicTicket({ compact = false }: { compact?: boolean }) {
  const { t } = useCopy();
  return <div className={`public-ticket${compact ? ' public-ticket-compact' : ''}`} aria-label={t('example_application_ticket')}>
    <div className="public-ticket-copy">
      <span className="public-ticket-caption">{compact ? t('my_tickets') : t('barangay_clearance')}</span>
      <strong>TSK-7C21A4</strong>
      {compact ? <span className="public-ticket-service">{t('barangay_clearance')}</span> : <>
        <dl><div><dt>{t('name')}</dt><dd>Maria L. Santos</dd></div><div><dt>{t('prepared')}</dt><dd>17 Nov 2026</dd></div></dl>
        <span className="public-ticket-complete">{t('requirements_complete')}</span>
      </>}
    </div>
    <div className="public-ticket-ready"><span><Icon name="check" size={compact ? 20 : 30} /></span><b>{t('ready_text102')}</b>{!compact && <small>{t('for_review')}</small>}</div>
  </div>;
}
