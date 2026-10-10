import type {Snapshot} from '@/lib/workspace';
import {Icon} from '@/components/Icon';

export function MetricCard({label, value, hint, icon, tone}: {label: string; value: string; hint: string; icon: 'wallet' | 'barChart' | 'activity' | 'shield' | 'users'; tone?: 'positive' | 'negative' | 'warning'}) {
  return <article className={`metric-card ${tone || ''}`}><div className="metric-label"><span>{label}</span><Icon name={icon} size={18}/></div><strong>{value}</strong><small>{hint}</small></article>;
}

export function EquityChart({history}: {history: Snapshot[]}) {
  const values = history.map((snapshot) => Number(snapshot.equity ?? snapshot.balance)).filter((value) => Number.isFinite(value));
  if (values.length < 2) return <div className="chart-empty"><Icon name="barChart" size={24}/><span>Collecting your first account updates…</span></div>;
  const width = 820;
  const height = 250;
  const padding = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.012, 1);
  const points = values.map((value, index) => {
    const x = padding + ((width - padding * 2) * index) / Math.max(values.length - 1, 1);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`;
  const [lastX, lastY] = points[points.length - 1].split(',');
  return <div className="equity-chart"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Account equity history"><defs><linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b6f04b" stopOpacity=".34"/><stop offset="100%" stopColor="#b6f04b" stopOpacity="0"/></linearGradient></defs><path className="chart-grid" d={`M${padding} 46H${width - padding}M${padding} 125H${width - padding}M${padding} 204H${width - padding}`} /><polygon className="chart-area" points={area} /><polyline className="chart-line" points={points.join(' ')} /><circle className="chart-dot" cx={lastX} cy={lastY} r="5" /></svg></div>;
}

export function ConnectionStatus({live, text}: {live: boolean; text: string}) {
  return <span className={`connection-status ${live ? 'live' : ''}`}><i />{text}</span>;
}