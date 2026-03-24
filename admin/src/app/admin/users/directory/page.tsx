"use client";

import { useState, useMemo } from "react";
import { users, formatCurrency, formatTimestamp, type User, type UserRole, type UserStatus } from "@/lib/adminMockData";
import { Input } from "@/components/ui/input";

function RoleBadge({ role }: { role: UserRole }) {
    const styles: Record<UserRole, string> = {
        user: "bg-white/5 text-[#8a8580]",
        artist: "bg-[#c8a96e]/10 text-[#c8a96e]",
        moderator: "bg-[#5b8def]/10 text-[#5b8def]",
        admin: "bg-[#ff2d55]/10 text-[#ff2d55]",
    };
    return <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${styles[role]}`}>{role}</span>;
}

function StatusBadge({ status }: { status: UserStatus }) {
    const styles: Record<UserStatus, string> = {
        active: "text-[#00ff88]",
        suspended: "text-[#ff2d55]",
        pending: "text-[#ffa500]",
    };
    const dots: Record<UserStatus, string> = {
        active: "glow-dot-live",
        suspended: "glow-dot-flagged",
        pending: "glow-dot-pending",
    };
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`glow-dot ${dots[status]}`} />
            <span className={`text-[10px] uppercase tracking-wider font-data ${styles[status]}`}>{status}</span>
        </span>
    );
}

type SortKey = "name" | "role" | "status" | "joinedAt" | "totalSpent" | "totalEarned" | "lastActive";
const PAGE_SIZE = 10;

export default function UserDirectoryPage() {
    const [localUsers, setLocalUsers] = useState(users);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
    const [sortKey, setSortKey] = useState<SortKey>("lastActive");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        let list = [...localUsers];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
        }
        if (roleFilter !== "all") list = list.filter(u => u.role === roleFilter);
        list.sort((a, b) => {
            let cmp = 0;
            if (sortKey === "name") cmp = a.name.localeCompare(b.name);
            else if (sortKey === "role") cmp = a.role.localeCompare(b.role);
            else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
            else if (sortKey === "joinedAt") cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
            else if (sortKey === "totalSpent") cmp = a.totalSpent - b.totalSpent;
            else if (sortKey === "totalEarned") cmp = a.totalEarned - b.totalEarned;
            else if (sortKey === "lastActive") cmp = new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime();
            return sortDir === "asc" ? cmp : -cmp;
        });
        return list;
    }, [localUsers, search, roleFilter, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("desc"); }
    }

    function changeRole(id: string, role: UserRole) {
        setLocalUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    }

    const SortIcon = ({ k }: { k: SortKey }) => sortKey === k ? <span className="ml-1 text-[#c8a96e]">{sortDir === "asc" ? "↑" : "↓"}</span> : null;

    return (
        <div className="p-6 space-y-5 max-w-[1600px]">
            <div>
                <h1 className="text-xl font-semibold text-[#e8e5e0] tracking-tight">User Directory</h1>
                <p className="text-xs text-[#6a6560] mt-0.5">Complete user database with role-based access control</p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <Input
                    placeholder="Search by name, email, or ID..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    className="max-w-xs bg-[#0a0a0a] border-white/[0.08] text-[12px] text-[#e8e5e0] placeholder:text-[#6a6560] focus:border-[#c8a96e]/30 h-8"
                />
                <div className="flex items-center gap-1 bg-[#0a0a0a] border border-white/[0.06] rounded-lg p-0.5">
                    {(["all", "user", "artist", "moderator", "admin"] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => { setRoleFilter(r); setPage(0); }}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${roleFilter === r ? "bg-[#c8a96e]/10 text-[#c8a96e]" : "text-[#6a6560] hover:text-[#8a8580]"
                                }`}
                        >
                            {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                    ))}
                </div>
                <span className="ml-auto text-[10px] text-[#6a6560] font-data">{filtered.length} users</span>
            </div>

            {/* Table */}
            <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                    <thead>
                        <tr className="border-b border-white/[0.06]">
                            <th className="text-left px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase">Avatar</th>
                            <th className="text-left px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase cursor-pointer hover:text-[#c8a96e]" onClick={() => toggleSort("name")}>
                                Name<SortIcon k="name" />
                            </th>
                            <th className="text-left px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase">Email</th>
                            <th className="text-center px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase cursor-pointer hover:text-[#c8a96e]" onClick={() => toggleSort("role")}>
                                Role<SortIcon k="role" />
                            </th>
                            <th className="text-center px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase cursor-pointer hover:text-[#c8a96e]" onClick={() => toggleSort("status")}>
                                Status<SortIcon k="status" />
                            </th>
                            <th className="text-right px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase cursor-pointer hover:text-[#c8a96e]" onClick={() => toggleSort("totalSpent")}>
                                Spent<SortIcon k="totalSpent" />
                            </th>
                            <th className="text-right px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase cursor-pointer hover:text-[#c8a96e]" onClick={() => toggleSort("totalEarned")}>
                                Earned<SortIcon k="totalEarned" />
                            </th>
                            <th className="text-right px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase cursor-pointer hover:text-[#c8a96e]" onClick={() => toggleSort("lastActive")}>
                                Last Active<SortIcon k="lastActive" />
                            </th>
                            <th className="text-center px-4 py-3 text-[10px] text-[#6a6560] font-semibold tracking-wider uppercase">RBAC</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map(u => (
                            <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                <td className="px-4 py-3">
                                    <div className="w-7 h-7 rounded-full bg-[#c8a96e]/10 flex items-center justify-center text-[10px] font-bold text-[#c8a96e]">
                                        {u.avatar}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-[#e8e5e0] font-medium">{u.name}</div>
                                    <div className="text-[10px] text-[#6a6560] font-data">{u.id}</div>
                                </td>
                                <td className="px-4 py-3 text-[#8a8580] text-[11px]">{u.email}</td>
                                <td className="px-4 py-3 text-center"><RoleBadge role={u.role} /></td>
                                <td className="px-4 py-3 text-center"><StatusBadge status={u.status} /></td>
                                <td className="px-4 py-3 text-right font-data text-[#8a8580]">{u.totalSpent > 0 ? formatCurrency(u.totalSpent) : "—"}</td>
                                <td className="px-4 py-3 text-right font-data text-[#00ff88]">{u.totalEarned > 0 ? formatCurrency(u.totalEarned) : "—"}</td>
                                <td className="px-4 py-3 text-right font-data text-[#6a6560] text-[10px]">{formatTimestamp(u.lastActive)}</td>
                                <td className="px-4 py-3 text-center">
                                    <select
                                        value={u.role}
                                        onChange={e => changeRole(u.id, e.target.value as UserRole)}
                                        className="bg-transparent border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-[#8a8580] outline-none focus:border-[#c8a96e]/30 cursor-pointer"
                                    >
                                        <option value="user">User</option>
                                        <option value="artist">Artist</option>
                                        <option value="moderator">Moderator</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-[10px] text-[#6a6560] font-data">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-md text-[11px] bg-[#0a0a0a] border border-white/[0.06] text-[#8a8580] disabled:opacity-30 hover:border-[#c8a96e]/20 transition-colors">← Prev</button>
                    {Array.from({ length: totalPages }, (_, i) => (
                        <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 rounded-md text-[11px] font-data transition-colors ${page === i ? "bg-[#c8a96e]/10 text-[#c8a96e] border border-[#c8a96e]/20" : "text-[#6a6560] hover:text-[#8a8580]"}`}>{i + 1}</button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-md text-[11px] bg-[#0a0a0a] border border-white/[0.06] text-[#8a8580] disabled:opacity-30 hover:border-[#c8a96e]/20 transition-colors">Next →</button>
                </div>
            </div>
        </div>
    );
}
