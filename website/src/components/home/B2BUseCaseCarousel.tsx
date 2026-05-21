"use client";

import React, { useState } from "react";
import GrowthAgencyDemo from "./GrowthAgencyDemo";
import SaaSMetricsDemo from "./SaaSMetricsDemo";
import EcommerceDemo from "./EcommerceDemo";
import { ChevronLeft, ChevronRight } from "lucide-react";

const USE_CASES = [
  {
    id: "agency",
    label: "Growth Agencies",
    description: "Unified view of all client campaigns and ROI",
    component: GrowthAgencyDemo,
  },
  {
    id: "saas",
    label: "SaaS Companies",
    description: "Product metrics, anomalies & revenue in one place",
    component: SaaSMetricsDemo,
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    description: "Daily operations: revenue, inventory, and action items",
    component: EcommerceDemo,
  },
];

export default function B2BUseCaseCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeUseCase = USE_CASES[activeIndex];
  const ActiveComponent = activeUseCase.component;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + USE_CASES.length) % USE_CASES.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % USE_CASES.length);
  };

  return (
    <div className="w-full rounded-[28px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm dark:border-white/10 dark:from-white/[0.04] dark:to-white/[0.02] sm:p-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            Scenario view
          </p>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            For {activeUseCase.label}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {activeUseCase.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/75 dark:hover:bg-white/10"
            aria-label="Previous use case"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNext}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/75 dark:hover:bg-white/10"
            aria-label="Next use case"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-slate-950/70 sm:p-5">
        <div className="flex justify-center">
          <ActiveComponent />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {USE_CASES.map((useCase, index) => (
          <button
            key={useCase.id}
            onClick={() => setActiveIndex(index)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              index === activeIndex
                ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {useCase.label}
          </button>
        ))}
      </div>
    </div>
  );
}
