import { Link } from 'react-router-dom';
import { Avatar } from 'antd';
import { useLocale } from '../../../context/LocaleContext';
import { formatBytes } from '../../../lib/format';
import { FileIcon } from '../../kb/components/Icons';
import { useWidgetData } from '../api';
import { Meter, TimeChart } from '../charts';
import { Kpi, WidgetState, When, initials, longDay, shortDay } from './common';

// ── Files ───────────────────────────────────────────────────────────────────

export function RecentFiles({ widget }) {
  const { t } = useLocale();
  const state = useWidgetData('recentFiles', widget.settings);
  const data = state.data;
  return (
    <div className="dw-files">
      {data && widget.settings.showUsage !== false && (
        <div className="dw-usage">
          <div className="dw-usage__text">
            <span>{t('dashboard.files.usage')}</span>
            <b>
              {formatBytes(data.usage.used)}
              {data.usage.quota ? ` / ${formatBytes(data.usage.quota)}` : ''}
            </b>
          </div>
          {data.usage.quota > 0 && <Meter value={data.usage.used} max={data.usage.quota} />}
        </div>
      )}
      <WidgetState state={state} empty={data && !data.items.length ? t('dashboard.files.empty') : null} emptyIcon="folder">
        <ul className="dw-list">
          {(data?.items || []).map((node) => (
            <li key={node.id}>
              <Link to={`/app/files/v/${node.id}`} className="dw-row">
                <FileIcon item={{ kind: 'file', file: { ext: node.ext } }} size={30} />
                <span className="dw-row__text">
                  <strong>{node.name}</strong>
                  <em>{formatBytes(node.size)}</em>
                </span>
                <span className="dw-row__meta">
                  <When value={node.updatedAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </WidgetState>
    </div>
  );
}

// ── Knowledge base ──────────────────────────────────────────────────────────

export function KbRecent({ widget }) {
  const { t } = useLocale();
  const state = useWidgetData('kbRecent', widget.settings);
  const data = state.data;
  return (
    <WidgetState state={state} empty={data && !data.items.length ? t('dashboard.kb.empty') : null} emptyIcon="graduation">
      <ul className="dw-list">
        {(data?.items || []).map((item) => (
          <li key={item.id}>
            <Link to={`/app/kb/d/${item.id}`} className="dw-row">
              <FileIcon item={item} size={30} />
              <span className="dw-row__text">
                <strong>{item.title}</strong>
                {item.author && <em>{item.author}</em>}
              </span>
              <span className="dw-row__meta">
                <When value={item.updatedAt} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetState>
  );
}

// ── Console: people ─────────────────────────────────────────────────────────

export function People({ widget, size }) {
  const { t, locale } = useLocale();
  const state = useWidgetData('people', widget.settings);
  const data = state.data;
  const sum = (list) => list.reduce((total, value) => total + value, 0);
  return (
    <WidgetState state={state} rows={5}>
      {data && (
        <div className="dw-people">
          <div className="dw-kpis">
            <Kpi value={data.total} label={t('dashboard.people.total')} to="/admin/users" />
            <Kpi value={data.active30d} label={t('dashboard.people.active')} tone="ok" />
            <Kpi value={data.joined} label={t('dashboard.people.joined', { n: data.days.length })} />
            {size.w >= 5 && <Kpi value={sum(data.failed)} label={t('dashboard.people.failed')} tone={sum(data.failed) ? 'danger' : null} to="/admin/activity" />}
          </div>
          <div className="dw-people__chart">
            <TimeChart
              labels={data.days}
              type="stack"
              height={Math.max(110, size.h * 56 - 150)}
              series={[
                { key: 'ok', label: t('dashboard.people.logins'), color: '#6366F1', values: data.logins },
                { key: 'failed', label: t('dashboard.people.failed'), color: '#F43F5E', values: data.failed },
              ]}
              formatLabel={(key) => shortDay(key, locale)}
              formatTip={(key) => longDay(key, locale)}
            />
          </div>
          {size.h >= 6 && data.recent.length > 0 && (
            <div className="dw-people__recent">
              <span>{t('dashboard.people.recent')}</span>
              <Avatar.Group max={{ count: 5 }} size={28}>
                {data.recent.map((person) => (
                  <Avatar key={person.id} src={person.avatarUrl || undefined} title={person.name}>
                    {initials(person.name)}
                  </Avatar>
                ))}
              </Avatar.Group>
            </div>
          )}
        </div>
      )}
    </WidgetState>
  );
}

const GROUP_COLORS = { browse: '#94A3B8', download: '#3B82F6', change: '#10B981', delete: '#EF4444' };
