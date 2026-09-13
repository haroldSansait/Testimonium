import { useId, useMemo, useState } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';

export interface DailyDataPoint {
  date: string; // 'YYYY-MM-DD'
  count: number;
  amount?: string;
}

interface DailyTrendChartProps {
  from: string;
  to: string;
  rows: DailyDataPoint[];
  title: string;
  emptyMessage?: string;
  valueLabel?: string;
  amountLabel?: string;
  animationKey?: number | string;
}

import { formatDailyAverage } from '@/utils/date';

export { formatDailyAverage };

export function zeroFillDailySeries(
  from: string,
  to: string,
  sparseRows: DailyDataPoint[]
): DailyDataPoint[] {
  if (!from || !to) return sparseRows || [];

  const rowMap = new Map<string, { count: number; amount?: string }>();
  if (Array.isArray(sparseRows)) {
    for (const r of sparseRows) {
      if (r && r.date) {
        rowMap.set(r.date, {
          count: Number(r.count || 0),
          amount: r.amount,
        });
      }
    }
  }

  const result: DailyDataPoint[] = [];
  const [startY, startM, startD] = from.split('-').map(Number);
  const [endY, endM, endD] = to.split('-').map(Number);

  if (!Number.isFinite(startY) || !Number.isFinite(endY)) {
    return sparseRows || [];
  }

  const current = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));

  if (current > end) {
    return sparseRows || [];
  }

  const hasAmount = sparseRows.some((r) => r.amount !== undefined);

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const existing = rowMap.get(dateStr);
    result.push({
      date: dateStr,
      count: existing ? existing.count : 0,
      amount: existing ? existing.amount : (hasAmount ? '0.00' : undefined),
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[m - 1] || ''} ${d}`;
}

function formatDateLong(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  const y = parts[0];
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[m - 1] || ''} ${d}, ${y}`;
}

export function DailyTrendChart({
  from,
  to,
  rows,
  title,
  emptyMessage = 'No activity recorded for this period.',
  valueLabel = 'Activity',
  animationKey,
}: DailyTrendChartProps) {
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Complete zero-filled series across every calendar day
  const series = useMemo(() => {
    return zeroFillDailySeries(from, to, rows);
  }, [from, to, rows]);

  // Calculations across the complete series
  const { totalCount, dailyAverage, peakPoint, maxCount } = useMemo(() => {
    if (series.length === 0) {
      return { totalCount: 0, dailyAverage: '0.0', peakPoint: null, maxCount: 0 };
    }
    let total = 0;
    let peak: DailyDataPoint = series[0];
    let max = 0;

    for (const point of series) {
      const c = Number(point.count || 0);
      total += c;
      if (c > max) {
        max = c;
        peak = point;
      }
    }

    const avg = formatDailyAverage(total, series.length);
    return {
      totalCount: total,
      dailyAverage: avg,
      peakPoint: max > 0 ? peak : null,
      maxCount: max,
    };
  }, [series]);

  // Layout parameters for SVG
  const width = 800;
  const height = 220;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const yMax = Math.max(1, maxCount > 0 ? Math.ceil(maxCount * 1.15) : 5);

  // Derive points for line and area
  const coordinates = useMemo(() => {
    if (series.length === 0) return [];
    if (series.length === 1) {
      return [
        {
          x: padLeft + chartWidth / 2,
          y: padTop + chartHeight - (series[0].count / yMax) * chartHeight,
          point: series[0],
        },
      ];
    }
    const step = chartWidth / (series.length - 1);
    return series.map((pt, i) => {
      const x = padLeft + i * step;
      const y = padTop + chartHeight - (pt.count / yMax) * chartHeight;
      return { x, y, point: pt };
    });
  }, [series, chartWidth, chartHeight, padLeft, padTop, yMax]);

  // SVG Paths
  const { linePath, areaPath } = useMemo(() => {
    if (coordinates.length === 0) return { linePath: '', areaPath: '' };
    if (coordinates.length === 1) {
      const p = coordinates[0];
      return {
        linePath: `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y}`,
        areaPath: `M ${p.x - 10} ${padTop + chartHeight} L ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y} L ${p.x + 10} ${padTop + chartHeight} Z`,
      };
    }

    const first = coordinates[0];
    let lPath = `M ${first.x} ${first.y}`;
    for (let i = 1; i < coordinates.length; i++) {
      lPath += ` L ${coordinates[i].x} ${coordinates[i].y}`;
    }

    const last = coordinates[coordinates.length - 1];
    const aPath = `${lPath} L ${last.x} ${padTop + chartHeight} L ${first.x} ${padTop + chartHeight} Z`;

    return { linePath: lPath, areaPath: aPath };
  }, [coordinates, padTop, chartHeight]);

  // Adaptive X-axis tick indices (intelligently spaced so 6-month & 1-year views remain readable)
  const tickIndices = useMemo(() => {
    const len = series.length;
    if (len <= 1) return [0];
    if (len <= 7) return Array.from({ length: len }, (_, i) => i);
    if (len <= 14) {
      return [0, 2, 4, 6, 8, 10, 12, len - 1].filter((v, i, a) => v < len && a.indexOf(v) === i);
    }
    if (len <= 35) {
      // 1 Month range: ~6 ticks spaced ~5 days apart
      const step = Math.max(4, Math.floor(len / 6));
      const indices: number[] = [];
      for (let i = 0; i < len; i += step) indices.push(i);
      if (indices[indices.length - 1] !== len - 1 && len - 1 - indices[indices.length - 1] > step / 2) {
        indices.push(len - 1);
      }
      return indices;
    }
    // 6 Months (~180 days) or 1 Year (~365 days):
    // Target 6-7 evenly spaced labels so labels NEVER overlap or crowd
    const targetCount = 6;
    const step = Math.floor((len - 1) / targetCount);
    const indices: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      indices.push(i * step);
    }
    indices.push(len - 1);
    return indices;
  }, [series.length]);

  const activeCoord = hoveredIndex !== null && coordinates[hoveredIndex] ? coordinates[hoveredIndex] : null;

  return (
    <div key={animationKey ?? 'trend-root'} className="space-y-3.5">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{title}</h3>
          <p className="text-[11px] font-medium text-gray-400">
            Daily timeline covering {series.length} calendar day{series.length === 1 ? '' : 's'}
          </p>
        </div>

        {series.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              Total: <strong className="text-gray-900">{totalCount.toLocaleString()}</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              Avg: <strong className="text-gray-900">{dailyAverage}/day</strong>
            </span>
            {peakPoint && (
              <span className="inline-flex items-center gap-1 rounded-md border border-crimson-100 bg-crimson-50 px-2 py-0.5 text-[11px] font-semibold text-crimson-800">
                <TrendingUp className="h-3 w-3 text-crimson-700" />
                Peak: {peakPoint.count.toLocaleString()} ({formatDateShort(peakPoint.date)})
              </span>
            )}
          </div>
        )}
      </div>

      {series.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <AlertCircle className="h-5 w-5 text-gray-300" />
          <p className="mt-1.5 text-xs font-medium text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="relative rounded-xl border border-gray-100 bg-white p-2">
          {/* Tooltip Card */}
          {activeCoord && (
            <div
              className="pointer-events-none absolute z-20 rounded-lg border border-gray-800 bg-gray-900/95 px-2.5 py-1.5 text-xs text-white shadow-lg transition-all"
              style={{
                left: `${Math.min(Math.max(activeCoord.x, 70), width - 90)}px`,
                top: `${Math.max(10, activeCoord.y - 45)}px`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <p className="font-semibold text-gray-200">{formatDateLong(activeCoord.point.date)}</p>
              <p className="mt-0.5 text-[11px] text-gray-300">
                {valueLabel}: <span className="font-bold text-white">{activeCoord.point.count.toLocaleString()}</span>
              </p>
              {activeCoord.point.amount !== undefined && (
                <p className="text-[10px] font-semibold text-emerald-400">
                  Amount: ₱{activeCoord.point.amount}
                </p>
              )}
            </div>
          )}

          {/* SVG Area & Line Visual */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-48 select-none overflow-visible"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#991b1b" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#991b1b" stopOpacity="0.01" />
              </linearGradient>
              <style>{`
                @media (prefers-reduced-motion: no-preference) {
                  .animate-trend-line {
                    stroke-dasharray: 1000;
                    stroke-dashoffset: 1000;
                    animation: trendDrawLine 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  }
                  .animate-trend-area {
                    opacity: 0;
                    animation: trendFadeArea 500ms ease-out 100ms forwards;
                  }
                  .animate-trend-point {
                    opacity: 0;
                    animation: trendFadePoints 400ms ease-out 250ms forwards;
                  }
                }
                @keyframes trendDrawLine {
                  from { stroke-dashoffset: 1000; }
                  to { stroke-dashoffset: 0; }
                }
                @keyframes trendFadeArea {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                @keyframes trendFadePoints {
                  from { opacity: 0; transform: scale(0.6); }
                  to { opacity: 1; transform: scale(1); }
                }
              `}</style>
            </defs>

            {/* Horizontal Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padTop + chartHeight * (1 - ratio);
              const val = Math.round(yMax * ratio);
              return (
                <g key={ratio} className="text-gray-300">
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                    className="text-gray-100"
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    className="fill-gray-400 font-medium select-none"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#${gradientId})`}
                className="animate-trend-area transition-opacity duration-200"
              />
            )}

            {/* Line stroke */}
            {linePath && (
              <path
                d={linePath}
                pathLength={1000}
                fill="none"
                stroke="#991b1b"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-trend-line"
              />
            )}

            {/* Active Crosshair Cursor */}
            {activeCoord && (
              <line
                x1={activeCoord.x}
                y1={padTop}
                x2={activeCoord.x}
                y2={padTop + chartHeight}
                stroke="#991b1b"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.6"
              />
            )}

            {/* Data Point Dots & Interaction Targets */}
            {coordinates.map((coord, idx) => {
              const isHovered = hoveredIndex === idx;
              const hasActivity = coord.point.count > 0;

              return (
                <g key={coord.point.date}>
                  {/* Subtle marker dot for non-zero points or hovered points */}
                  {(hasActivity || isHovered) && (
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isHovered ? 4.5 : 2.5}
                      fill={isHovered ? '#991b1b' : '#991b1b'}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2 : 1}
                      className="animate-trend-point transition-transform duration-100"
                    />
                  )}

                  {/* Wide invisible hit-target for hover */}
                  <rect
                    x={coord.x - (chartWidth / (coordinates.length || 1)) / 2}
                    y={padTop}
                    width={Math.max(12, chartWidth / (coordinates.length || 1))}
                    height={chartHeight + padBottom}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                  />
                </g>
              );
            })}

            {/* X-axis tick labels */}
            {tickIndices.map((idx) => {
              const coord = coordinates[idx];
              if (!coord) return null;
              return (
                <text
                  key={idx}
                  x={coord.x}
                  y={padTop + chartHeight + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  className="fill-gray-500 font-medium select-none"
                >
                  {formatDateShort(coord.point.date)}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
