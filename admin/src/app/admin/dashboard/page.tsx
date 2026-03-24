"use client";

import { dashboardMetrics, bids, auctions, formatCurrency, timeAgo } from "@/lib/adminMockData";

const kpiCards = [
    { label: "Total GMV", value: formatCurrency(dashboardMetrics.totalGMV), change: `+${dashboardMetrics.gmvChange}%`, changeType: "up" as const },
    { label: "Active Auctions", value: dashboardMetrics.activeAuctions.toString(), sub: `${auctions.filter(a => a.status === "live" || a.status === "ending").length} live now`, changeType: "live" as const },
    { label: "Platform Revenue (24h)", value: formatCurrency(dashboardMetrics.platformRevenue24h), sub: `Lifetime: ${formatCurrency(dashboardMetrics.totalPlatformRevenue)}`, changeType: "up" as const },
    { label: "Active Users (24h)", value: dashboardMetrics.activeUsers24h.toString(), sub: `${dashboardMetrics.totalUsers} total`, changeType: "neutral" as const },
    { label: "Escrow Held", value: formatCurrency(dashboardMetrics.escrowHeld), sub: `${auctions.filter(a => a.status === "live").length} active holds`, changeType: "neutral" as const },
    { label: "Pending Applications", value: dashboardMetrics.pendingApplications.toString(), changeType: "pending" as const },
    { label: "Flagged Assets", value: dashboardMetrics.flaggedAssets.toString(), changeType: dashboardMetrics.flaggedAssets > 0 ? "flagged" as const : "neutral" as const },
    { label: "Open Disputes", value: dashboardMetrics.openDisputes.toString(), changeType: dashboardMetrics.openDisputes > 0 ? "flagged" as const : "neutral" as const },
];

function StatusDot({ type }: { type: string }) {
    const cls = type === "up" || type === "live" ? "glow-dot-live" : type === "pending" ? "glow-dot-pending" : type === "flagged" ? "glow-dot-flagged" : "glow-dot-live";
    return <span className={`glow-dot ${cls}`} />;
}

function VolumeChart({ data }: { data: number[] }) {
    const max = Math.max(...data);
    return (
        <div className="flex items-end gap-[3px] h-[120px]">
            {data.map((v, i) => {
                const h = (v / max) * 100;
                return (
                    <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-100 group relative"
                        style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, rgba(200,169,110,0.15), rgba(200,169,110,${0.25 + (h / 100) * 0.4}))`,
                            minWidth: "6px",
                        }}
                    >
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] font-data text-[#c8a96e] whitespace-nowrap bg-[#0a0a0a] px-1.5 py-0.5 rounded border border-[#c8a96e]/20">
                            ${v.toLocaleString()}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function DashboardPage() {
    const liveAuctions = auctions.filter(a => a.status === "live" || a.status === "ending");
    const activeBids = bids.filter(b => b.status === "active").sort((a, b) => b.amount - a.amount);

    return (
        <div className="p-6 space-y-6 max-w-[1600px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-[#e8e5e0] tracking-tight">The Nexus</h1>
                    <p className="text-xs text-[#6a6560] mt-0.5">Global Platform Overview — Real-time</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-data text-[#6a6560]">
                    <span className="glow-dot glow-dot-live" />
                    <span className="text-[#00ff88]">SYSTEM NOMINAL</span>
                    <span className="mx-2 text-white/10">|</span>
                    <span>{new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-4 gap-3">
                {kpiCards.map((card) => (
                    <div
                        key={card.label}
                        className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl p-4 hover:border-[#c8a96e]/20 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#6a6560]">
                                {card.label}
                            </span>
                            <StatusDot type={card.changeType} />
                        </div>
                        <div className="text-2xl font-semibold text-[#e8e5e0] font-data">{card.value}</div>
                        {"change" in card && card.change && (
                            <div className="text-[11px] mt-1 text-[#00ff88] font-data">{card.change}</div>
                        )}
                        {"sub" in card && card.sub && (
                            <div className="text-[11px] mt-1 text-[#6a6560]">{card.sub}</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Volume Chart + Live Feed */}
            <div className="grid grid-cols-3 gap-4">
                {/* 24h volume chart */}
                <div className="col-span-2 bg-[#0a0a0a] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-[#e8e5e0]">24-Hour Transaction Volume</h2>
                            <p className="text-[10px] text-[#6a6560] mt-0.5">Hourly breakdown — all transaction types</p>
                        </div>
                        <div className="font-data text-lg text-[#c8a96e]">
                            {formatCurrency(dashboardMetrics.volume24h.reduce((a, b) => a + b, 0))}
                        </div>
                    </div>
                    <VolumeChart data={dashboardMetrics.volume24h} />
                    <div className="flex justify-between mt-2 text-[9px] text-[#6a6560] font-data">
                        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                    </div>
                </div>

                {/* Live bid feed */}
                <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="glow-dot glow-dot-live" />
                        <h2 className="text-sm font-semibold text-[#e8e5e0]">Highest Active Bids</h2>
                    </div>
                    <div className="space-y-3">
                        {activeBids.map((bid) => (
                            <div key={bid.id} className="flex items-start justify-between py-2 border-b border-white/[0.04] last:border-0">
                                <div>
                                    <div className="text-[12px] text-[#e8e5e0] font-medium">{bid.auctionTitle}</div>
                                    <div className="text-[10px] text-[#6a6560] mt-0.5">{bid.userName}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[13px] font-data text-[#00ff88] font-semibold">{formatCurrency(bid.amount)}</div>
                                    <div className="text-[9px] text-[#6a6560] font-data">{timeAgo(bid.placedAt)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Live Auctions Strip */}
            <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="glow-dot glow-dot-live" />
                    <h2 className="text-sm font-semibold text-[#e8e5e0]">Live Auction Monitor</h2>
                    <span className="text-[10px] text-[#6a6560] ml-auto font-data">{liveAuctions.length} active</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {liveAuctions.map((auction) => (
                        <div key={auction.id} className="bg-[#0e0e0e] border border-white/[0.04] rounded-lg p-4 hover:border-[#c8a96e]/20 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-md" style={{ background: auction.imageColor, opacity: 0.7 }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-medium text-[#e8e5e0] truncate">{auction.title}</div>
                                    <div className="text-[10px] text-[#6a6560]">{auction.artist}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <div>
                                    <div className="text-[9px] text-[#6a6560] uppercase tracking-wider">{auction.type === "dutch" ? "Current" : "Top Bid"}</div>
                                    <div className="text-[14px] font-data text-[#c8a96e] font-semibold">
                                        {formatCurrency(auction.type === "dutch" ? auction.currentPrice : auction.topBid)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] text-[#6a6560] uppercase tracking-wider">Watchers</div>
                                    <div className="text-[12px] font-data text-[#8a8580]">{auction.watchers}</div>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase ${auction.status === "ending" ? "bg-[#ff2d55]/10 text-[#ff2d55]" : "bg-[#00ff88]/10 text-[#00ff88]"
                                    }`}>
                                    {auction.status === "ending" ? "ENDING" : "LIVE"}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
