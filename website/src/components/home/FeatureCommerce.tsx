"use client";

import React from "react";
import { Headphones, Sparkles, TrendingUp } from "lucide-react";

export default function FeatureCommerce() {
  return (
    <div className="w-full max-w-[280px] mx-auto rounded-2xl border border-white/5 bg-[#040810]/70 p-4.5 space-y-4 shadow-lg backdrop-blur-md relative overflow-hidden group">
      
      {/* Background soft glowing blur */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-tr-2xl pointer-events-none" />

      {/* Main product showcase container */}
      <div className="w-full aspect-[1.2/1] rounded-xl bg-[#090f1d] border border-white/5 flex items-center justify-center relative overflow-hidden">
        
        {/* Animated glowing mesh behind product */}
        <div className="absolute w-20 h-20 bg-emerald-500/5 rounded-full blur-xl animate-pulse" />

        {/* Premium Headphone SVG design */}
        <svg className="w-20 h-20 text-emerald-400/90 relative z-10 transition-transform duration-500 group-hover:scale-105" viewBox="0 0 100 100" fill="none">
          {/* Headband */}
          <path d="M15,50 C15,20 85,20 85,50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          
          {/* Left Earpad connector */}
          <rect x="11" y="45" width="8" height="20" rx="3" fill="#10B981" />
          <path d="M15,65 L15,75" stroke="currentColor" strokeWidth="3" />
          {/* Left Ear cup */}
          <rect x="5" y="55" width="12" height="24" rx="6" fill="#0c101a" stroke="currentColor" strokeWidth="2.5" />

          {/* Right Earpad connector */}
          <rect x="81" y="45" width="8" height="20" rx="3" fill="#10B981" />
          <path d="M85,65 L85,75" stroke="currentColor" strokeWidth="3" />
          {/* Right Ear cup */}
          <rect x="83" y="55" width="12" height="24" rx="6" fill="#0c101a" stroke="currentColor" strokeWidth="2.5" />

          {/* Inner accents */}
          <circle cx="15" cy="50" r="1.5" fill="#10B981" />
          <circle cx="85" cy="50" r="1.5" fill="#10B981" />
        </svg>

        {/* Floating Badges */}
        <div className="absolute top-2.5 right-2.5 rounded-full bg-orange-500/10 px-2 py-0.5 text-[8px] font-bold text-orange-400 border border-orange-500/20 flex items-center gap-0.5">
          <Sparkles size={8} />
          <span>Hot Product</span>
        </div>

        <div className="absolute top-2.5 left-2.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
          <span>Instock</span>
        </div>
      </div>

      {/* Product Details */}
      <div className="space-y-1.5 pt-0.5">
        <div className="text-[11px] font-black text-white group-hover:text-emerald-400 transition-colors">Wireless Headphones</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-extrabold text-white">$59.99</span>
          <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
            <TrendingUp size={9} /> Optimized
          </span>
        </div>
      </div>

      {/* Optimized Pricing Sparkline */}
      <div className="pt-2 border-t border-white/5 space-y-1.5">
        <div className="flex items-center justify-between text-[8px] text-white/35 font-bold uppercase tracking-wider">
          <span>AI Price Tracking</span>
          <span className="text-emerald-400">+14% Margins</span>
        </div>
        <div className="h-8 w-full">
          <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
            <path d="M0,15 L20,12 L40,16 L60,8 L80,10 L100,2" fill="none" stroke="#10b981" strokeWidth="1.5" />
            <circle cx="100" cy="2" r="1.5" fill="#10B981" />
          </svg>
        </div>
      </div>

    </div>
  );
}
