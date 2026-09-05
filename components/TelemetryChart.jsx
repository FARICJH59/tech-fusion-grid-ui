import React, { useState, useEffect } from 'react';

export default function TelemetryChart({ triggerEvent }) {
  const [dataPoints, setDataPoints] = useState([30, 40, 35, 50, 45, 60, 55, 70, 65, 80]);

  useEffect(() => {
    if (!triggerEvent) return;

    const timer = setTimeout(() => {
      setDataPoints((prev) => {
        const nextPoints = [...prev.slice(1)];
        const variance = Math.floor(Math.random() * 50) + 45;
        return [...nextPoints, variance];
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [triggerEvent]);

  const width = 500;
  const height = 140;
  const padding = 20;

  const pointsString = dataPoints
    .map((val, index) => {
      const x = padding + (index * (width - padding * 2)) / (dataPoints.length - 1);
      const y = height - padding - (val * (height - padding * 2)) / 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="w-full bg-[#111622] border border-[#222f47] rounded-xl p-4 mt-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-transparent opacity-70"></div>

      <div className="flex justify-between items-center mb-3">
        <div>
          <h4 className="text-xs uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            Arbitrage Network Telemetry Tracker
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Real-time load curtailment, SaaS billing events, and compute allocation velocity vectors.</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] bg-[#1a2436] text-purple-400 font-mono px-2 py-1 border border-purple-900 rounded font-bold">
            GRID FREQ: 60.02 Hz
          </span>
        </div>
      </div>

      <div className="w-full h-36 bg-[#090d16] border border-[#162031] rounded-lg p-2 relative flex items-center justify-center">
        <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-10">
          <div className="w-full border-b border-dashed border-slate-300"></div>
          <div className="w-full border-b border-dashed border-slate-300"></div>
          <div className="w-full border-b border-dashed border-slate-300"></div>
        </div>

        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <path
            d={`M ${padding},${height - padding} L ${pointsString} L ${width - padding},${height - padding} Z`}
            fill="url(#telemetryGlowGrad)"
            className="transition-all duration-500 ease-in-out"
          />
          <polyline
            fill="none"
            stroke="#a855f7"
            strokeWidth="3"
            points={pointsString}
            className="transition-all duration-500 ease-in-out drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"
          />
          <defs>
            <linearGradient id="telemetryGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
