"use client";

import React from "react";
import { Package, TrendingUp, DollarSign, AlertCircle, Zap, CheckCircle2 } from "lucide-react";

export default function EcommerceDemo() {
  return (
    <div className="relative w-full max-w-[560px]">
      {/* Main dashboard window */}
      <div className="glass-panel p-4 cinematic-glow">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="text-sm font-semibold text-white">Daily Operations Center</div>
            <div className="text-xs text-white/60 mt-1">Shopify + Analytics + Email • Action-ready</div>
          </div>
          <div className="text-emerald-300 text-xs font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>

        {/* Daily summary metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <DollarSign size={14} />
              Daily Revenue
            </div>
            <div className="text-2xl font-bold text-white mt-2">$8,247</div>
            <div className="text-xs text-emerald-300 mt-1">↑ 18% vs avg</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <Package size={14} />
              Orders
            </div>
            <div className="text-2xl font-bold text-white mt-2">342</div>
            <div className="text-xs text-emerald-300 mt-1">Avg $24 AOV</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <TrendingUp size={14} />
              Conversion
            </div>
            <div className="text-2xl font-bold text-white mt-2">3.8%</div>
            <div className="text-xs text-blue-300 mt-1">23k visitors</div>
          </div>
        </div>

        {/* Action items */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-white mb-2">Action Items</div>
          <div className="space-y-2">
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 hover:bg-red-400/15 transition cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-300" />
                    <span className="text-sm font-medium text-white">Low stock alert</span>
                  </div>
                  <div className="text-xs text-white/70 mt-1">3 SKUs below reorder level. Bestseller "Blue Canvas" only 12 left</div>
                </div>
              </div>
              <button className="text-xs text-red-300 font-medium mt-2 hover:underline">Reorder now</button>
            </div>

            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 hover:bg-amber-400/15 transition cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-300" />
                    <span className="text-sm font-medium text-white">Cart abandonment spike</span>
                  </div>
                  <div className="text-xs text-white/70 mt-1">84 abandoned carts (↑ 23%). Send recovery email?</div>
                </div>
              </div>
              <button className="text-xs text-amber-300 font-medium mt-2 hover:underline">Send now</button>
            </div>

            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 hover:bg-emerald-400/15 transition cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-300" />
                    <span className="text-sm font-medium text-white">Promo working well</span>
                  </div>
                  <div className="text-xs text-white/70 mt-1">"20OFF" code hitting 14% conversion vs 3.8% baseline. Consider extending</div>
                </div>
              </div>
              <button className="text-xs text-emerald-300 font-medium mt-2 hover:underline">Extend promo</button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-white/10 flex gap-2">
          <button className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition">
            Execute Actions
          </button>
          <button className="flex-1 px-3 py-2 rounded-md text-xs font-medium border border-white/20 text-white/90 hover:bg-white/5 transition">
            View Analytics
          </button>
        </div>
      </div>

      {/* Floating panel: Status */}
      <div className="absolute -right-16 top-12 w-40 glass-panel p-3 cinematic-glow">
        <div className="text-xs font-semibold text-white/85 mb-2">Live Integrations</div>
        <div className="space-y-1 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Shopify orders</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>GA traffic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Email campaigns</span>
          </div>
        </div>
      </div>
    </div>
  );
}
