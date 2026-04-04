import { useMemo, useState } from 'react';

interface DataPoint {
  [key: string]: string | number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  dataKey: string;
  xKey: string;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export function SimpleLineChart({
  data,
  dataKey,
  xKey,
  width = 600,
  height = 300,
  strokeColor = 'var(--primary, #4facfe)',
  strokeWidth = 2,
}: SimpleLineChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { path, points, yTicks, xLabels } = useMemo(() => {
    if (!data.length) return { path: '', points: [], yTicks: [], xLabels: [] };
    const values = data.map(d => Number(d[dataKey]) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const pts = data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1 || 1)) * chartW,
      y: padding.top + chartH - ((Number(d[dataKey]) || 0) - min) / range * chartH,
      label: String(d[xKey]),
      value: Number(d[dataKey]) || 0,
    }));

    const pathStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount }, (_, i) => {
      const val = min + (range * i) / (tickCount - 1);
      return { y: padding.top + chartH - (i / (tickCount - 1)) * chartH, label: val.toFixed(0) };
    });

    const step = Math.max(1, Math.floor(data.length / 6));
    const xLabels = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

    return { path: pathStr, points: pts, yTicks, xLabels };
  }, [data, dataKey, xKey, chartW, chartH, padding.left, padding.top]);

  if (!data.length) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padding.left} y1={t.y} x2={width - padding.right} y2={t.y} stroke="var(--border-primary, #333)" strokeDasharray="3 3" />
          <text x={padding.left - 8} y={t.y + 4} textAnchor="end" fill="var(--text-secondary, #9ca3af)" fontSize={11}>{t.label}</text>
        </g>
      ))}
      {/* X labels */}
      {xLabels.map((p, i) => (
        <text key={i} x={p.x} y={height - 8} textAnchor="middle" fill="var(--text-secondary, #9ca3af)" fontSize={10}>{p.label}</text>
      ))}
      {/* Line */}
      <path d={path} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
      {/* Interactive dots */}
      {points.map((p, i) => (
        <circle
          key={i} cx={p.x} cy={p.y} r={4} fill={strokeColor} stroke="var(--bg-card, #1a1a2e)" strokeWidth={2}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setTooltip(p)}
          onMouseLeave={() => setTooltip(null)}
        />
      ))}
      {/* Tooltip */}
      {tooltip && (
        <g>
          <rect x={tooltip.x - 40} y={tooltip.y - 32} width={80} height={24} rx={4}
            fill="var(--bg-card, #1a1a2e)" stroke="var(--border-primary, #333)" />
          <text x={tooltip.x} y={tooltip.y - 16} textAnchor="middle" fill="var(--text-primary, #e8d5a3)" fontSize={11}>
            {tooltip.value.toLocaleString()}
          </text>
        </g>
      )}
    </svg>
  );
}
