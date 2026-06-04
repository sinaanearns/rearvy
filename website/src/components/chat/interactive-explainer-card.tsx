"use client";

import { useMemo, useState } from "react";

type RangeConfig = {
  min?: number;
  max?: number;
  step?: number;
};

type InteractiveExplainerConfig = {
  title?: string;
  subtitle?: string;
  principal?: number;
  rate?: number;
  years?: number;
  principalRange?: RangeConfig;
  rateRange?: RangeConfig;
  yearsRange?: RangeConfig;
};

const DEFAULT_CONFIG: Required<
  Pick<InteractiveExplainerConfig, "title" | "subtitle" | "principal" | "rate" | "years">
> = {
  title: "Interactive Financial Explainer",
  subtitle: "Adjust values to see live scenario changes",
  principal: 10000,
  rate: 7,
  years: 10,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(
  range: RangeConfig | undefined,
  fallback: Required<RangeConfig>
): Required<RangeConfig> {
  const min = Number.isFinite(range?.min) ? Number(range?.min) : fallback.min;
  const max = Number.isFinite(range?.max) ? Number(range?.max) : fallback.max;
  const step = Number.isFinite(range?.step) ? Number(range?.step) : fallback.step;

  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
    step: step > 0 ? step : fallback.step,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function safeParseConfig(raw: string): InteractiveExplainerConfig {
  try {
    const parsed = JSON.parse(raw) as InteractiveExplainerConfig;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function InteractiveExplainerCard({ configText }: { configText: string }) {
  const config = useMemo(() => safeParseConfig(configText), [configText]);

  const principalRange = useMemo(
    () => normalizeRange(config.principalRange, { min: 1000, max: 100000, step: 500 }),
    [config.principalRange]
  );
  const rateRange = useMemo(
    () => normalizeRange(config.rateRange, { min: 1, max: 30, step: 0.5 }),
    [config.rateRange]
  );
  const yearsRange = useMemo(
    () => normalizeRange(config.yearsRange, { min: 1, max: 30, step: 1 }),
    [config.yearsRange]
  );

  const [principal, setPrincipal] = useState(() =>
    clamp(
      Number.isFinite(config.principal) ? Number(config.principal) : DEFAULT_CONFIG.principal,
      principalRange.min,
      principalRange.max
    )
  );
  const [rate, setRate] = useState(() =>
    clamp(
      Number.isFinite(config.rate) ? Number(config.rate) : DEFAULT_CONFIG.rate,
      rateRange.min,
      rateRange.max
    )
  );
  const [years, setYears] = useState(() =>
    clamp(
      Number.isFinite(config.years) ? Number(config.years) : DEFAULT_CONFIG.years,
      yearsRange.min,
      yearsRange.max
    )
  );

  const yearCount = Math.max(1, Math.round(years));

  const chartPoints = useMemo(() => {
    const points: Array<{
      label: string;
      principal: number;
      total: number;
      interest: number;
      simpleInterestTotal: number;
    }> = [];

    for (let i = 0; i <= yearCount; i += 1) {
      const total = principal * Math.pow(1 + rate / 100, i);
      const interest = total - principal;
      const simpleInterestTotal = principal + principal * (rate / 100) * i;
      points.push({
        label: i === 0 ? "Now" : `Yr ${i}`,
        principal,
        total,
        interest,
        simpleInterestTotal,
      });
    }

    return points;
  }, [principal, rate, yearCount]);

  const finalPoint = chartPoints[chartPoints.length - 1] ?? chartPoints[0];
  const maxTotal = Math.max(...chartPoints.map((point) => point.total), 1);

  const title = config.title || DEFAULT_CONFIG.title;
  const subtitle = config.subtitle || DEFAULT_CONFIG.subtitle;

  return (
    <div className="overflow-hidden rounded-[8px] border border-border/70 bg-card/60 p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-col gap-1">
        <h4 className="text-lg font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[8px] border border-border/60 bg-background/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">Final balance</p>
          <p className="text-2xl font-semibold text-foreground">{formatCurrency(finalPoint.total)}</p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-background/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">Interest earned</p>
          <p className="text-2xl font-semibold text-emerald-500">{formatCurrency(finalPoint.interest)}</p>
        </div>
        <div className="rounded-[8px] border border-border/60 bg-background/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">Money multiplier</p>
          <p className="text-2xl font-semibold text-sky-400">{(finalPoint.total / principal).toFixed(2)}x</p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Principal</span>
            <span className="text-muted-foreground">{formatCurrency(principal)}</span>
          </div>
          <input
            type="range"
            min={principalRange.min}
            max={principalRange.max}
            step={principalRange.step}
            value={principal}
            onChange={(event) => setPrincipal(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-[8px] bg-muted"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Rate / year</span>
            <span className="text-muted-foreground">{formatPercent(rate)}</span>
          </div>
          <input
            type="range"
            min={rateRange.min}
            max={rateRange.max}
            step={rateRange.step}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-[8px] bg-muted"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Years</span>
            <span className="text-muted-foreground">{yearCount} yrs</span>
          </div>
          <input
            type="range"
            min={yearsRange.min}
            max={yearsRange.max}
            step={yearsRange.step}
            value={years}
            onChange={(event) => setYears(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-[8px] bg-muted"
          />
        </label>
      </div>

      <div className="mt-5 rounded-[8px] border border-border/60 bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            Interest
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-zinc-500" />
            Principal
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-[2px] w-4 bg-violet-400" />
            Simple interest
          </span>
        </div>

        <div className="grid h-48 grid-cols-6 items-end gap-2 md:grid-cols-11">
          {chartPoints.map((point) => {
            const totalHeightPct = (point.total / maxTotal) * 100;
            const principalHeightPct = (point.principal / maxTotal) * 100;
            const interestHeightPct = Math.max(0, totalHeightPct - principalHeightPct);
            const simpleY = 100 - (point.simpleInterestTotal / maxTotal) * 100;

            return (
              <div key={point.label} className="relative flex h-full flex-col items-center justify-end">
                <div className="relative w-full max-w-[28px]">
                  <div
                    className="absolute left-0 right-0 h-[2px] bg-violet-400"
                    style={{ top: `${simpleY}%` }}
                    aria-hidden="true"
                  />
                  <div
                    className="w-full rounded-t-sm bg-zinc-500"
                    style={{ height: `${principalHeightPct}%` }}
                  />
                  <div
                    className="w-full rounded-t-sm bg-emerald-500"
                    style={{ height: `${interestHeightPct}%` }}
                  />
                </div>
                <span className="mt-2 text-[10px] text-muted-foreground">{point.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
