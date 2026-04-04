import { useMemo, useState } from 'react';

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: PieSlice[];
  width?: number;
  height?: number;
  outerRadius?: number;
  showLegend?: boolean;
}

export function SimplePieChart({
  data,
  width = 400,
  height = 300,
  outerRadius = 100,
  showLegend = true,
}: SimplePieChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const cx = width / 2;
  const cy = (height - (showLegend ? 40 : 0)) / 2;

  const slices = useMemo(() => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return [];
    let cumAngle = -Math.PI / 2;
    return data.map((d, i) => {
      const angle = (d.value / total) * Math.PI * 2;
      const startAngle = cumAngle;
      cumAngle += angle;
      const endAngle = cumAngle;
      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = cx + outerRadius * Math.cos(startAngle);
      const y1 = cy + outerRadius * Math.sin(startAngle);
      const x2 = cx + outerRadius * Math.cos(endAngle);
      const y2 = cy + outerRadius * Math.sin(endAngle);
      const midAngle = startAngle + angle / 2;
      const labelR = outerRadius + 18;
      const lx = cx + labelR * Math.cos(midAngle);
      const ly = cy + labelR * Math.sin(midAngle);
      const pct = ((d.value / total) * 100).toFixed(0);
      return { ...d, path: `M${cx},${cy} L${x1},${y1} A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${x2},${y2} Z`, lx, ly, pct, index: i };
    });
  }, [data, cx, cy, outerRadius]);

  if (!slices.length) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
      {slices.map(s => (
        <g key={s.index}>
          <path
            d={s.path} fill={s.color}
            opacity={hovered === null || hovered === s.index ? 1 : 0.5}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseEnter={() => setHovered(s.index)}
            onMouseLeave={() => setHovered(null)}
          />
          <text x={s.lx} y={s.ly} textAnchor="middle" fill="var(--text-secondary, #9ca3af)" fontSize={10}>
            {s.name} {s.pct}%
          </text>
        </g>
      ))}
      {/* Legend */}
      {showLegend && (
        <g transform={`translate(0, ${height - 30})`}>
          {slices.map((s, i) => (
            <g key={i} transform={`translate(${i * (width / slices.length)}, 0)`}>
              <rect x={4} y={0} width={10} height={10} rx={2} fill={s.color} />
              <text x={18} y={9} fill="var(--text-secondary, #94a3b8)" fontSize={10}>{s.name}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
