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
    <div className="w-full">
      {/* Use case selector */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-950 dark:text-white">
            For {activeUseCase.label}
          </h3>
          <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm">
            {activeUseCase.description}
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-lg border border-slate-200 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/5 transition text-slate-700 dark:text-white/70"
            aria-label="Previous use case"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-lg border border-slate-200 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/5 transition text-slate-700 dark:text-white/70"
            aria-label="Next use case"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Demo component */}
      <div className="flex justify-center mb-8">
        <ActiveComponent />
      </div>

      {/* Indicator dots */}
      <div className="flex justify-center gap-2">
        {USE_CASES.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`w-2 h-2 rounded-full transition ${
              index === activeIndex
                ? "bg-slate-950 dark:bg-white"
                : "bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/30"
            }`}
            aria-label={`View ${USE_CASES[index].label} use case`}
          />
        ))}
      </div>

      {/* Use case labels below dots */}
      <div className="flex justify-center gap-8 mt-6 text-xs">
        {USE_CASES.map((useCase, index) => (
          <button
            key={useCase.id}
            onClick={() => setActiveIndex(index)}
            className={`transition ${
              index === activeIndex
                ? "font-semibold text-slate-950 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {useCase.label}
          </button>
        ))}
      </div>
    </div>
  );
}
