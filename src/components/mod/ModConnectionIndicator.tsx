import { useI18n } from '../../i18n/context';
import type { ModConnectionStatus } from '../../engine/mod-protocol';

interface Props {
  status: ModConnectionStatus;
  lastPollTime?: number | null;
}

export function ModConnectionIndicator({ status, lastPollTime }: Props) {
  const { t } = useI18n();

  const statusLabels: Record<ModConnectionStatus, string> = {
    connected: t.modConnection.connected,
    disconnected: t.modConnection.disconnected,
    connecting: t.modConnection.connecting,
    error: t.modConnection.error,
  };

  const agoText = lastPollTime
    ? `${Math.round((Date.now() - lastPollTime) / 1000)}s ago`
    : '';

  return (
    <span
      className={`mod-status mod-status--${status}`}
      title={status === 'connected' && agoText ? `${t.modConnection.lastUpdate}: ${agoText}` : undefined}
    >
      <span className="mod-status__dot" />
      <span className="mod-status__text">
        {statusLabels[status]}
        {status === 'connected' && agoText && (
          <span className="mod-status__ago"> ({agoText})</span>
        )}
      </span>
    </span>
  );
}
