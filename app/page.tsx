"use client";

import {
  Activity, ArrowUpRight, BadgeCheck, Bell, BookOpen, Bot, Building2, CalendarClock,
  ChevronDown, ChevronRight, CircleDollarSign, Command, Gauge, Headphones, LayoutDashboard,
  LoaderCircle, Megaphone, Menu, MessageCircleMore, MoreHorizontal, Plus, Search, Send,
  Settings2, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, Users, WandSparkles, X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Merchant = Record<string, any>;
type Trigger = Record<string, any>;
type DemoData = {
  source: { kind: string; label: string; live: boolean };
  metrics: Record<string, number>;
  merchants: Merchant[];
  customers: Record<string, any>[];
  triggers: Trigger[];
  categories: Record<string, any>[];
};

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "conversations", label: "Conversations", icon: MessageCircleMore },
  { id: "merchants", label: "Merchants", icon: Building2 },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "customers", label: "Audiences", icon: Users },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "automations", label: "Automations", icon: WandSparkles }
];

const tones: Record<string, { color: string; label: string }> = {
  dentists: { color: "#6c8cff", label: "Dentist" },
  salons: { color: "#e778ba", label: "Salon" },
  restaurants: { color: "#ff895c", label: "Restaurant" },
  gyms: { color: "#8edc74", label: "Fitness" },
  pharmacies: { color: "#56ccb5", label: "Pharmacy" }
};

function formatNum(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value > 10_000 ? 1 : 2)}K`;
  return String(value);
}

function formatTimestamp(value?: string, timeOnly = false) {
  if (!value) return "Seed record";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Seed record";
  return new Intl.DateTimeFormat("en-IN", timeOnly
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short" }
  ).format(date);
}

function Avatar({ name, category, size = "md" }: { name: string; category: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  return <div className={`avatar avatar-${size}`} style={{ "--avatar": tones[category]?.color || "#9b8cff" } as any}>{initials}</div>;
}

function MiniChart({ positive = true }: { positive?: boolean }) {
  return (
    <svg className="mini-chart" viewBox="0 0 150 42" preserveAspectRatio="none">
      <defs>
        <linearGradient id={positive ? "greenFade" : "redFade"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "#78dc91" : "#ff7a7a"} stopOpacity=".25" />
          <stop offset="100%" stopColor={positive ? "#78dc91" : "#ff7a7a"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={positive ? "M0 35 C18 31,23 33,38 24 S65 30,79 18 S104 21,115 11 S138 12,150 5 V42 H0Z" : "M0 7 C20 9,22 16,40 13 S61 22,78 19 S101 28,117 25 S138 36,150 34 V42 H0Z"} fill={`url(#${positive ? "greenFade" : "redFade"})`} />
      <path d={positive ? "M0 35 C18 31,23 33,38 24 S65 30,79 18 S104 21,115 11 S138 12,150 5" : "M0 7 C20 9,22 16,40 13 S61 22,78 19 S101 28,117 25 S138 36,150 34"} fill="none" stroke={positive ? "#78dc91" : "#ff7a7a"} strokeWidth="2" />
    </svg>
  );
}

function StatCard({ eyebrow, value, delta, positive = true, icon: Icon, comparison = "seed dataset", trend = false }: any) {
  return (
    <div className="stat-card panel">
      <div className="stat-head"><span>{eyebrow}</span><div className="icon-box"><Icon size={17} /></div></div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot"><span className={positive ? "positive" : "negative"}>{trend && (positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}{delta}</span><span>{comparison}</span></div>
      {trend && <MiniChart positive={positive} />}
    </div>
  );
}

function Modal({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}>
    <button className="modal-backdrop" onClick={close} aria-label="Close dialog" />
    <section className="modal panel">
      <div className="modal-head"><div><span className="eyebrow">Vera workspace</span><h2>{title}</h2></div><button onClick={close}><X size={18} /></button></div>
      {children}
    </section>
  </div>;
}

function VeraAssistant({ data, close, goTo }: { data: DemoData; close: () => void; goTo: (section: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  async function ask() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt })
      });
      const result = await response.json();
      setAnswer(result.body || result.rationale || "I’ve captured that. Open Conversations to continue with the merchant context.");
    } catch {
      setAnswer(`I can help across ${data.merchants.length} loaded merchants. The local API is unavailable right now, so no action was taken.`);
    } finally {
      setLoading(false);
    }
  }
  return <Modal title="Ask Vera" close={close}>
    <div className="assistant-body">
      <div className="assistant-intro"><Sparkles size={18} /><p>Ask about a merchant, a campaign, or the next growth action. Vera will route the work into the right workspace.</p></div>
      <textarea autoFocus value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(); }
      }} placeholder="e.g. Help me follow up with merchants whose views are declining" />
      {answer && <div className="assistant-answer"><Bot size={17} /><p>{answer}</p></div>}
      <div className="modal-actions"><button className="secondary-button" onClick={() => { close(); goTo("conversations"); }}>Open conversations</button><button className="primary-button" disabled={!prompt.trim() || loading} onClick={ask}>{loading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} Ask Vera</button></div>
    </div>
  </Modal>;
}

function ActivityBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="activity-chart">
      <div className="chart-y"><span>{max}</span><span>{Math.ceil(max / 2)}</span><span>0</span></div>
      <div className="chart-bars">
        {values.map((value, index) => <div className="bar-wrap" key={index}><div className="bar" title={`${value} conversation turns`} style={{ height: value ? `${Math.max(8, (value / max) * 100)}%` : "1px", opacity: .45 + index / Math.max(values.length * 2, 1) }} /></div>)}
      </div>
      <div className="chart-x">{labels.map((label) => <span key={label}>{label}</span>)}</div>
    </div>
  );
}

function Shell({ children, section, setSection, mobile, setMobile, data, openMerchant, openAssistant }: any) {
  const [searchText, setSearchText] = useState("");
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const searchResults = searchText.trim() ? data?.merchants.filter((item: Merchant) =>
    `${item.identity.name} ${item.identity.city} ${item.identity.locality} ${item.category_slug}`.toLowerCase().includes(searchText.toLowerCase())
  ).slice(0, 6) : [];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".topbar-search input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={20} /></div><div><strong>vera</strong><span>merchant OS</span></div><button className="mobile-close" onClick={() => setMobile(false)}><X size={20} /></button></div>
        <button className="workspace" onClick={() => setWorkspaceMenu(!workspaceMenu)} aria-expanded={workspaceMenu}><div className="workspace-logo">MP</div><div><strong>magicpin India</strong><span>Enterprise workspace</span></div><ChevronDown size={15} /></button>
        {workspaceMenu && <div className="workspace-menu panel"><button onClick={() => setWorkspaceMenu(false)}><BadgeCheck size={14} /> magicpin India <small>Current</small></button><button onClick={() => { setWorkspaceMenu(false); setSection("settings"); }}><Plus size={14} /> Add workspace</button></div>}
        <nav>
          <span className="nav-label">Workspace</span>
          {nav.map(({ id, label, icon: Icon }) => (
            <button className={section === id ? "nav-item active" : "nav-item"} key={id} onClick={() => { setSection(id); setMobile(false); }}>
              <Icon size={18} /><span>{label}</span>{id === "conversations" && data ? <b>{data.metrics.conversations}</b> : null}
            </button>
          ))}
          <span className="nav-label nav-spacer">Manage</span>
          <button className={section === "analytics" ? "nav-item active" : "nav-item"} onClick={() => setSection("analytics")}><Gauge size={18} /><span>Analytics</span></button>
          <button className={section === "compliance" ? "nav-item active" : "nav-item"} onClick={() => setSection("compliance")}><ShieldCheck size={18} /><span>Compliance</span></button>
          <button className={section === "settings" ? "nav-item active" : "nav-item"} onClick={() => setSection("settings")}><Settings2 size={18} /><span>Settings</span></button>
        </nav>
        <div className="usage-card"><div><Bot size={18} /><span>Seed data coverage</span></div><strong>{data ? `${data.merchants.length} merchants loaded` : "Loading dataset"}</strong><div className="usage-track"><i style={{ width: data ? "100%" : "10%" }} /></div><small>{data ? `${data.customers.length} customers · ${data.triggers.length} triggers` : "Reading local JSON"}</small></div>
        <button className="profile" onClick={() => setSection("settings")}><div className="avatar avatar-sm">SK</div><div><strong>Sudhanshu Kumar</strong><span>Workspace admin</span></div><MoreHorizontal size={17} /></button>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobile(true)}><Menu size={20} /></button>
          <div className="global-search">
            <div className="search topbar-search"><Search size={17} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Escape") setSearchText("");
              if (event.key === "Enter" && searchResults?.[0]) { openMerchant(searchResults[0]); setSearchText(""); }
            }} placeholder="Search merchants, campaigns, conversations..." /><kbd>Ctrl K</kbd></div>
            {!!searchResults?.length && <div className="search-results panel">{searchResults.map((result: Merchant) =>
              <button key={result.merchant_id} onClick={() => { openMerchant(result); setSearchText(""); }}><Avatar name={result.identity.name} category={result.category_slug} size="sm" /><span><strong>{result.identity.name}</strong><small>{result.identity.locality}, {result.identity.city}</small></span><ChevronRight size={15} /></button>
            )}</div>}
          </div>
          {data && <span className="data-source-badge" title="Loaded locally from dataset/merchants_seed.json, customers_seed.json, triggers_seed.json, and dataset/categories/*.json"><i /> Synthetic seed data</span>}
          <div className="top-actions"><button title="Help" onClick={() => setSection("knowledge")}><Headphones size={18} /></button><button className="notification" title="Priority queue" onClick={() => setSection("automations")}><Bell size={18} /><i /></button><button className="create-button" onClick={openAssistant}><Sparkles size={16} /> <span>Ask Vera</span></button></div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Overview({ data, openMerchant, setSection, createCampaign }: { data: DemoData; openMerchant: (m: Merchant) => void; setSection: (s: string) => void; createCampaign: () => void }) {
  const urgent = data.triggers.filter((trigger) => trigger.urgency >= 3).slice(0, 4);
  const [range, setRange] = useState("24h");
  const activity = useMemo(() => {
    const turns = data.merchants.flatMap((item) => (item.conversation_history || []).map((turn: any) => ({ ...turn, time: Date.parse(turn.ts || turn.at || "") }))).filter((turn) => Number.isFinite(turn.time));
    const latest = turns.length ? Math.max(...turns.map((turn) => turn.time)) : Date.now();
    const duration = range === "24h" ? 86_400_000 : range === "7d" ? 604_800_000 : 2_592_000_000;
    const bucketCount = range === "24h" ? 12 : range === "7d" ? 7 : 15;
    const start = latest - duration;
    const filtered = turns.filter((turn) => turn.time >= start && turn.time <= latest);
    const values = Array.from({ length: bucketCount }, () => 0);
    filtered.forEach((turn) => {
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor(((turn.time - start) / duration) * bucketCount)));
      values[index] += 1;
    });
    const active = new Set(data.merchants.filter((item) => item.conversation_history?.some((turn: any) => {
      const time = Date.parse(turn.ts || turn.at || "");
      return time >= start && time <= latest;
    })).map((item) => item.merchant_id)).size;
    return {
      values,
      labels: range === "24h" ? ["-24h", "-18h", "-12h", "-6h", "Latest"] : range === "7d" ? ["-7d", "-5d", "-3d", "-1d", "Latest"] : ["-30d", "-21d", "-14d", "-7d", "Latest"],
      total: filtered.length,
      vera: filtered.filter((turn) => turn.from === "vera").length,
      average: active ? (filtered.length / active).toFixed(1) : "0"
    };
  }, [data, range]);
  const dentalMerchants = data.merchants.filter((item) => item.category_slug === "dentists");
  const dentalViews = dentalMerchants.reduce((sum, item) => sum + item.performance.views, 0);
  const dentalCalls = dentalMerchants.reduce((sum, item) => sum + item.performance.calls, 0);
  return (
    <div className="page">
      <div className="page-title-row">
        <div><p className="eyebrow">Bundled challenge dataset</p><h1>Good morning, Sudhanshu.</h1><p>Showing synthetic seed records for product evaluation—not live magicpin data.</p></div>
        <button className="primary-button" onClick={createCampaign}><Sparkles size={17} /> Create campaign</button>
      </div>
      <div className="stats-grid">
        <StatCard eyebrow="Active merchants" value={formatNum(data.metrics.activeMerchants)} delta={`${data.merchants.length} loaded`} icon={Building2} />
        <StatCard eyebrow="Conversation turns" value={formatNum(data.metrics.conversations)} delta="merchant history" icon={MessageCircleMore} />
        <StatCard eyebrow="Active triggers" value={formatNum(data.metrics.activeTriggers)} delta="trigger records" icon={Bot} />
        <StatCard eyebrow="Profile views" value={formatNum(data.metrics.totalViews)} delta={`${formatNum(data.metrics.totalCalls)} calls`} icon={CircleDollarSign} />
      </div>
      <div className="overview-grid">
        <section className="panel activity-panel">
          <div className="panel-head"><div><h2>Conversation activity</h2><p>Stored turns relative to the latest timestamp in the seed data</p></div><div className="legend"><i /> Stored turns <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Conversation activity period"><option value="24h">Latest 24 hours</option><option value="7d">Latest 7 days</option><option value="30d">Latest 30 days</option></select></div></div>
          <ActivityBars values={activity.values} labels={activity.labels} />
          <div className="chart-summary"><div><strong>{activity.total}</strong><span>Conversation turns</span></div><div><strong>{activity.vera}</strong><span>Sent by Vera</span></div><div><strong>{activity.average}</strong><span>Avg. turns / merchant</span></div></div>
        </section>
        <section className="panel priority-panel">
          <div className="panel-head"><div><h2>Seed trigger queue</h2><p>High-urgency records from triggers_seed.json</p></div><button className="ghost-button" onClick={() => setSection("automations")}>View all <ChevronRight size={14} /></button></div>
          <div className="priority-list">
            {urgent.map((trigger, i) => {
              const merchant = data.merchants.find((m) => m.merchant_id === trigger.merchant_id);
              return <button key={trigger.id} className="priority-item" onClick={() => merchant && openMerchant(merchant)}><span className={`priority-icon priority-${i}`}><Target size={17} /></span><span><strong>{String(trigger.kind).replaceAll("_", " ")}</strong><small>{merchant?.identity.name} · {merchant?.identity.locality}</small></span><b>{trigger.urgency === 5 ? "Urgent" : "Review"}</b><ChevronRight size={16} /></button>;
            })}
          </div>
        </section>
      </div>
      <div className="lower-grid">
        <section className="panel merchants-panel">
          <div className="panel-head"><div><h2>Merchant momentum</h2><p>Recorded seven-day performance deltas in the seed data</p></div><button className="ghost-button" onClick={() => setSection("merchants")}>All merchants <ChevronRight size={14} /></button></div>
          <div className="table">
            <div className="table-row table-header"><span>Merchant</span><span>Category</span><span>30d views</span><span>Change</span><span>Status</span><span /></div>
            {data.merchants.slice(0, 5).map((merchant) => {
              const delta = merchant.performance.delta_7d.views_pct;
              const status = merchant.subscription.status;
              return <button className="table-row" key={merchant.merchant_id} onClick={() => openMerchant(merchant)}>
                <span className="merchant-cell"><Avatar name={merchant.identity.name} category={merchant.category_slug} size="sm" /><span><strong>{merchant.identity.name}</strong><small>{merchant.identity.locality}, {merchant.identity.city}</small></span></span>
                <span><i className="category-dot" style={{ background: tones[merchant.category_slug]?.color }} />{tones[merchant.category_slug]?.label}</span>
                <span>{formatNum(merchant.performance.views)}</span>
                <span className={delta >= 0 ? "positive" : "negative"}>{delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(delta * 100).toFixed(0)}%</span>
                <span><em className={`status status-${status}`}>{status}</em></span><span><ChevronRight size={15} /></span>
              </button>;
            })}
          </div>
        </section>
        <section className="panel insight-panel">
          <div className="insight-glow" /><div className="vera-orb"><Sparkles size={22} /></div><span className="ai-label">Vera insight</span>
          <h2>Your dental category has measurable profile activity.</h2>
          <p>The seed dataset contains <strong>{formatNum(dentalViews)} profile views and {formatNum(dentalCalls)} calls</strong> across dental merchants. No causal lift is claimed.</p>
          <div className="insight-proof"><div className="proof-stack">{dentalMerchants.slice(0, 3).map((item) => <span key={item.merchant_id}>{item.identity.name.split(" ").map((part: string) => part[0]).slice(0, 2).join("")}</span>)}</div><span>{dentalMerchants.length} dental merchants in seed data</span></div>
          <button onClick={createCampaign}>Build the campaign <ArrowUpRight size={16} /></button>
        </section>
      </div>
    </div>
  );
}

function Merchants({ data, openMerchant }: { data: DemoData; openMerchant: (m: Merchant) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<Merchant[]>([]);
  const [name, setName] = useState("");
  const merchants = [...added, ...data.merchants];
  const filtered = merchants.filter((m) => `${m.identity.name} ${m.identity.city} ${m.category_slug}`.toLowerCase().includes(query.toLowerCase()) && (category === "all" || m.category_slug === category) && (status === "all" || m.subscription.status === status));
  function addMerchant() {
    if (!name.trim()) return;
    setAdded((current) => [{
      merchant_id: `local_${Date.now()}`, category_slug: category === "all" ? "restaurants" : category,
      identity: { name: name.trim(), locality: "New location", city: "Bengaluru", verified: false, owner_first_name: name.trim().split(" ")[0] },
      performance: { views: 0, calls: 0, ctr: 0, leads: 0, directions: 0, delta_7d: { views_pct: 0 } },
      subscription: { status: "trial" }, signals: ["onboarding_new"], offers: [], conversation_history: []
    }, ...current]);
    setName("");
    setAdding(false);
  }
  return <div className="page"><div className="page-title-row"><div><p className="eyebrow">Merchant intelligence</p><h1>Merchant network</h1><p>Every location, signal, and growth opportunity in one place.</p></div><button className="primary-button" onClick={() => setAdding(true)}><Building2 size={17} /> Add merchant</button></div>
    <div className="toolbar panel"><div className="search wide"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the network..." /></div><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{Object.entries(tones).map(([slug, value]) => <option value={slug} key={slug}>{value.label}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="expired">Expired</option></select></div>
    <div className="merchant-card-grid">{filtered.map((merchant) => {
      const delta = merchant.performance.delta_7d.views_pct;
      return <button className="merchant-card panel" onClick={() => openMerchant(merchant)} key={merchant.merchant_id}><div className="merchant-card-head"><Avatar name={merchant.identity.name} category={merchant.category_slug} size="lg" /><MoreHorizontal size={18} /></div><div><span className="tiny-category" style={{ color: tones[merchant.category_slug]?.color }}>{tones[merchant.category_slug]?.label}</span><h3>{merchant.identity.name}</h3><p>{merchant.identity.locality}, {merchant.identity.city}</p></div><div className="merchant-kpis"><span><small>Views</small><strong>{formatNum(merchant.performance.views)}</strong></span><span><small>Calls</small><strong>{merchant.performance.calls}</strong></span><span><small>CTR</small><strong>{(merchant.performance.ctr * 100).toFixed(1)}%</strong></span></div><div className="merchant-card-foot"><span className={delta >= 0 ? "positive" : "negative"}>{delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(delta * 100).toFixed(0)}% this week</span><em className={`status status-${merchant.subscription.status}`}>{merchant.subscription.status}</em></div></button>;
    })}</div>{!filtered.length && <div className="empty-state panel compact-empty"><Search size={22} /><h2>No merchants found</h2><p>Try clearing one of the filters.</p></div>}
    {adding && <Modal title="Add merchant" close={() => setAdding(false)}><div className="form-stack"><label>Business name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Merchant name" /></label><label>Category<select value={category === "all" ? "restaurants" : category} onChange={(event) => setCategory(event.target.value)}>{Object.entries(tones).map(([slug, value]) => <option value={slug} key={slug}>{value.label}</option>)}</select></label><div className="modal-actions"><button className="secondary-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={!name.trim()} onClick={addMerchant}><Plus size={16} /> Add merchant</button></div></div></Modal>}
  </div>;
}

function Conversations({ data, initialMerchantId }: { data: DemoData; initialMerchantId?: string }) {
  const [selected, setSelected] = useState(data.merchants.find((item) => item.merchant_id === initialMerchantId) || data.merchants[0]);
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Record<string, Record<string, any>[]>>({});
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [chatSettings, setChatSettings] = useState(false);
  const trigger = data.triggers.find((t) => t.merchant_id === selected.merchant_id);
  const visibleMerchants = data.merchants.filter((item) => {
    const matchesFilter = filter === "all" || (filter === "unread" && item.conversation_history.at(-1)?.from === "merchant") || (filter === "escalated" && item.signals.some((signal: string) => signal.includes("severe")));
    return matchesFilter && `${item.identity.name} ${item.identity.owner_first_name || ""}`.toLowerCase().includes(query.toLowerCase());
  });
  async function sendMessage() {
    const body = message.trim();
    if (!body || sending) return;
    const merchantId = selected.merchant_id;
    setTurns((current) => ({ ...current, [merchantId]: [...(current[merchantId] || []), { from: "merchant", body }] }));
    setMessage("");
    if (!aiEnabled) return;
    setSending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: merchantId,
          message: body
        })
      });
      const result = await response.json();
      const reply = result.body || (result.action === "end" ? "Conversation closed. Vera will not send another message." : `Vera is waiting before the next follow-up. ${result.rationale || ""}`);
      setTurns((current) => ({ ...current, [merchantId]: [...(current[merchantId] || []), { from: "vera", body: reply }] }));
    } catch {
      setTurns((current) => ({ ...current, [merchantId]: [...(current[merchantId] || []), { from: "vera", body: "I couldn’t reach the conversation service. Your message is still visible here—please try again." }] }));
    } finally {
      setSending(false);
    }
  }
  return <div className="conversation-page">
    <div className="conversation-list panel"><div className="conversation-title"><div><h2>Conversations</h2><p>{visibleMerchants.length} in this view</p></div><button onClick={() => { setSearching(!searching); setQuery(""); }}><Search size={17} /></button></div>{searching && <div className="conversation-search"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations..." /></div>}<div className="conversation-filter">{["all", "unread", "escalated"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      <div className="conversation-scroll">
        {visibleMerchants.map((merchant) => { const lastTurn = merchant.conversation_history.at(-1); return <button className={selected.merchant_id === merchant.merchant_id ? "conversation-row selected" : "conversation-row"} onClick={() => setSelected(merchant)} key={merchant.merchant_id}><Avatar name={merchant.identity.name} category={merchant.category_slug} size="sm" /><span><strong>{merchant.identity.owner_first_name || merchant.identity.name}</strong><p>{turns[merchant.merchant_id]?.at(-1)?.body || lastTurn?.body || "No conversation history in seed data"}</p></span><small>{turns[merchant.merchant_id]?.length ? "Now" : formatTimestamp(lastTurn?.ts || lastTurn?.at)}</small>{lastTurn?.from === "merchant" && <i />}</button>; })}
        {!visibleMerchants.length && <div className="conversation-empty">No conversations match this filter.</div>}
      </div>
    </div>
    <div className="chat-panel panel"><div className="chat-head"><div className="merchant-cell"><Avatar name={selected.identity.name} category={selected.category_slug} size="sm" /><span><strong>{selected.identity.name}</strong><small><i /> WhatsApp · {aiEnabled ? "Vera handling" : "Human handling"}</small></span></div><div><button className={aiEnabled ? "" : "ai-off"} onClick={() => setAiEnabled(!aiEnabled)}><Bot size={17} /> AI {aiEnabled ? "on" : "off"}</button><button onClick={() => setChatSettings(true)}><MoreHorizontal size={18} /></button></div></div>
      <div className="context-banner"><Sparkles size={16} /><span><strong>Active context:</strong> {String(trigger?.kind || "merchant growth").replaceAll("_", " ")} · {selected.signals.slice(0, 2).join(" · ").replaceAll("_", " ")}</span><ChevronRight size={15} /></div>
      <div className="messages"><div className="date-divider"><span>Seed conversation history</span></div>
        {(selected.conversation_history.length ? selected.conversation_history : [{ from: "vera", body: `No stored conversation is available for ${selected.identity.name}.`, ts: "" }]).map((turn: any, i: number) => <div key={i} className={`message ${turn.from === "merchant" ? "incoming" : "outgoing"}`}><p>{turn.body}</p><small>{formatTimestamp(turn.ts || turn.at, true)} {turn.from !== "merchant" && "✓✓"}</small></div>)}
        {(turns[selected.merchant_id] || []).map((turn, i) => <div className={`message ${turn.from === "merchant" ? "incoming" : "outgoing"}`} key={i}><p>{turn.body}</p><small>Now {turn.from !== "merchant" && "✓✓"}</small></div>)}
        {sending && <div className="typing"><i /><i /><i /></div>}
        <div className="ai-draft"><div><Sparkles size={15} /><strong>Vera’s suggested reply</strong><span>Grounded in 4 contexts</span></div><p>I can prepare that now. I’ll use your active offer and latest profile performance, then share the draft here for your approval.</p><button onClick={() => setMessage("I can prepare that now. I’ll use your active offer and latest profile performance, then share the draft here for your approval.")}>Use reply</button></div>
      </div>
      <div className="composer"><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Reply to Vera..." /><div><span><Command size={14} /> Enter to send</span><button disabled={!message.trim() || sending} onClick={sendMessage}>{sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Send</button></div></div>
    </div>
    <aside className="context-panel"><div className="context-profile"><Avatar name={selected.identity.name} category={selected.category_slug} size="lg" /><h3>{selected.identity.name}</h3><p>{selected.identity.locality}, {selected.identity.city}</p><span><BadgeCheck size={14} /> {selected.identity.verified ? "Verified profile" : "Verification needed"}</span></div><div className="context-section"><h4>Growth snapshot</h4><div className="snapshot-grid"><span><small>30d views</small><strong>{formatNum(selected.performance.views)}</strong></span><span><small>Calls</small><strong>{selected.performance.calls}</strong></span><span><small>CTR</small><strong>{(selected.performance.ctr * 100).toFixed(1)}%</strong></span><span><small>Leads</small><strong>{selected.performance.leads}</strong></span></div></div><div className="context-section"><h4>Signals</h4>{selected.signals.map((signal: string) => <span className="signal-pill" key={signal}>{signal.replaceAll("_", " ")}</span>)}</div><div className="context-section"><h4>Active offers</h4>{selected.offers.filter((o: any) => o.status === "active").map((offer: any) => <div className="offer-row" key={offer.id}><Target size={15} /><span>{offer.title}</span></div>)}{!selected.offers.some((o: any) => o.status === "active") && <p className="muted">No active offers</p>}</div></aside>
    {chatSettings && <Modal title="Conversation settings" close={() => setChatSettings(false)}><div className="form-stack"><div className="assistant-intro"><Settings2 size={18} /><p>Control this conversation without changing the merchant’s global automation rules.</p></div><div className="modal-actions"><button className="secondary-button" onClick={() => setChatSettings(false)}>Mute notifications</button><button className="primary-button" onClick={() => { setTurns((current) => ({ ...current, [selected.merchant_id]: [...(current[selected.merchant_id] || []), { from: "vera", body: "Conversation marked resolved." }] })); setChatSettings(false); }}>Mark resolved</button></div></div></Modal>}
  </div>;
}

function Campaigns({ data, createRequest, onCreateRequestHandled }: { data: DemoData; createRequest: number; onCreateRequestHandled: () => void }) {
  const categoryCounts = (slug: string) => {
    const merchantIds = new Set(data.merchants.filter((item) => item.category_slug === slug).map((item) => item.merchant_id));
    return {
      audience: data.customers.filter((item) => merchantIds.has(item.merchant_id) && item.consent?.opted_in_at).length,
      triggers: data.triggers.filter((item) => merchantIds.has(item.merchant_id)).length
    };
  };
  const [cards, setCards] = useState(() => [
    { title: "Dental recall accelerator", category: "dentists", status: "Suggested", reach: String(categoryCounts("dentists").audience), lift: `${categoryCounts("dentists").triggers} signals`, icon: CalendarClock },
    { title: "Restaurant event moments", category: "restaurants", status: "Suggested", reach: String(categoryCounts("restaurants").audience), lift: `${categoryCounts("restaurants").triggers} signals`, icon: Activity },
    { title: "Fitness retention follow-up", category: "gyms", status: "Suggested", reach: String(categoryCounts("gyms").audience), lift: `${categoryCounts("gyms").triggers} signals`, icon: Target },
    { title: "Salon reactivation", category: "salons", status: "Suggested", reach: String(categoryCounts("salons").audience), lift: `${categoryCounts("salons").triggers} signals`, icon: Sparkles }
  ]);
  const [creating, setCreating] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<(typeof cards)[number] | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("dentists");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const recallEligible = data.triggers.filter((item) => {
    if (item.kind !== "recall_due" || !item.customer_id) return false;
    const customer = data.customers.find((record) => record.customer_id === item.customer_id);
    return customer?.consent?.opted_in_at && customer?.preferences?.reminder_opt_in !== false;
  }).length;
  useEffect(() => {
    if (createRequest > 0) {
      setCreating(true);
      onCreateRequestHandled();
    }
  }, [createRequest, onCreateRequestHandled]);
  function createCampaign() {
    if (!title.trim()) return;
    const counts = categoryCounts(category);
    const next = { title: title.trim(), category, status: "Draft", reach: String(counts.audience), lift: `${counts.triggers} signals`, icon: Sparkles };
    setCards((current) => [next, ...current]);
    setCreating(false);
    setTitle("");
    setSelectedCampaign(next);
  }
  return <div className="page"><div className="page-title-row"><div><p className="eyebrow">Synthetic seed workspace</p><h1>Campaign studio</h1><p>Recommendations are generated from the bundled merchant, customer, and trigger records.</p></div><button className="primary-button" onClick={() => setCreating(true)}><Sparkles size={17} /> New AI campaign</button></div><div className="campaign-hero panel"><div><span className="ai-label">Dataset recommendation</span><h2>Review the dental recall window</h2><p>{recallEligible} customer-linked recall trigger{recallEligible === 1 ? " is" : "s are"} present in the seed dataset. Vera can use only customers with recorded consent.</p><div><button className="primary-button" onClick={() => setSelectedCampaign(cards[0])}>Review audience <ArrowUpRight size={16} /></button><button className="secondary-button" onClick={() => setSelectedCampaign(cards[0])}>See rationale</button></div></div><div className="campaign-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Sparkles size={28} /></div><span className="orbit-stat"><strong>{recallEligible}</strong> ready</span></div></div>
    <div className="section-title"><div><h2>Campaign drafts</h2><p>{cards.filter((card) => campaignFilter === "all" || card.status.toLowerCase().startsWith(campaignFilter)).length} visible dataset-backed items</p></div><select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)} aria-label="Campaign status filter"><option value="all">All items</option><option value="suggested">Suggested</option><option value="draft">Drafts</option><option value="scheduled">Scheduled demos</option></select></div><div className="campaign-grid">{cards.filter((card) => campaignFilter === "all" || card.status.toLowerCase().startsWith(campaignFilter)).map(({ icon: Icon, ...card }) => <div className="campaign-card panel" key={card.title}><div className="campaign-card-top"><span className="campaign-icon" style={{ "--campaign": tones[card.category].color } as any}><Icon size={19} /></span><em>{card.status}</em><MoreHorizontal size={17} /></div><h3>{card.title}</h3><p>{tones[card.category].label} · proposed channels</p><div className="campaign-metrics"><span><small>Consented audience</small><strong>{card.reach}</strong></span><span><small>Source context</small><strong>{card.lift}</strong></span></div><div className="campaign-progress"><i style={{ width: `${data.customers.length ? Math.min(100, (Number(card.reach) / data.customers.length) * 100) : 0}%` }} /></div><button onClick={() => setSelectedCampaign({ ...card, icon: Icon })}>Open campaign <ChevronRight size={15} /></button></div>)}</div>
    {creating && <Modal title="Create AI campaign" close={() => setCreating(false)}><div className="form-stack"><label>Campaign name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Monsoon reactivation" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{Object.entries(tones).map(([slug, value]) => <option value={slug} key={slug}>{value.label}</option>)}</select></label><div className="modal-actions"><button className="secondary-button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button" disabled={!title.trim()} onClick={createCampaign}><Plus size={16} /> Create draft</button></div></div></Modal>}
    {selectedCampaign && <Modal title={selectedCampaign.title} close={() => setSelectedCampaign(null)}><div className="campaign-detail"><span className="signal-pill">{selectedCampaign.status}</span><h3>Audience and launch plan</h3><p>Vera will personalize this draft using category, merchant, recorded customer consent, and trigger context. Seed audience: <strong>{selectedCampaign.reach}</strong>.</p><div className="detail-grid"><span><small>Proposed channel</small><strong>WhatsApp + GBP</strong></span><span><small>Available context</small><strong>{selectedCampaign.lift}</strong></span></div><div className="modal-actions"><button className="secondary-button" onClick={() => setSelectedCampaign(null)}>Close</button><button className="primary-button" onClick={() => { setCards((current) => current.map((item) => item.title === selectedCampaign.title ? { ...item, status: "Scheduled demo" } : item)); setSelectedCampaign(null); }}>Schedule demo</button></div></div></Modal>}
  </div>;
}

function Knowledge({ data }: { data: DemoData }) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [categorySlug, setCategorySlug] = useState(data.categories[0]?.slug || "dentists");
  const [additions, setAdditions] = useState<Record<string, number>>({});
  function addKnowledge() {
    if (!knowledgeTitle.trim()) return;
    setAdditions((current) => ({ ...current, [categorySlug]: (current[categorySlug] || 0) + 1 }));
    setKnowledgeTitle("");
    setAdding(false);
    setSelected(data.categories.find((item) => item.slug === categorySlug) || null);
  }
  return <div className="page"><div className="page-title-row"><div><p className="eyebrow">Bundled category JSON</p><h1>Category intelligence</h1><p>These counts and voice settings come from the five synthetic category seed files.</p></div><button className="primary-button" onClick={() => setAdding(true)}><BookOpen size={17} /> Add knowledge</button></div><div className="knowledge-grid">{data.categories.map((category) => <div className="knowledge-card panel" key={category.slug}><div className="knowledge-head"><span style={{ background: tones[category.slug].color }}><BookOpen size={20} /></span><em>Seed pack</em></div><h2>{category.display_name}</h2><p>{category.tone.replaceAll("_", " ")} voice · India metros</p><div className="knowledge-stats"><span><strong>{category.digest + (additions[category.slug] || 0)}</strong><small>Digest records</small></span><span><strong>{category.offers}</strong><small>Offer patterns</small></span></div><div className="knowledge-tags"><span>Voice profile</span><span>Peer benchmarks</span><span>Compliance</span><span>Seasonality</span></div><button onClick={() => setSelected(category)}>Explore knowledge pack <ArrowUpRight size={15} /></button></div>)}</div>
    {adding && <Modal title="Add knowledge" close={() => setAdding(false)}><div className="form-stack"><label>Knowledge title<input autoFocus value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} placeholder="Research, regulation, or market signal" /></label><label>Category<select value={categorySlug} onChange={(event) => setCategorySlug(event.target.value)}>{data.categories.map((category) => <option value={category.slug} key={category.slug}>{category.display_name}</option>)}</select></label><div className="modal-actions"><button className="secondary-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={!knowledgeTitle.trim()} onClick={addKnowledge}><Plus size={16} /> Add to pack</button></div></div></Modal>}
    {selected && <Modal title={`${selected.display_name} knowledge pack`} close={() => setSelected(null)}><div className="campaign-detail"><span className="signal-pill">{selected.tone.replaceAll("_", " ")} voice</span><h3>Grounding coverage</h3><p>This pack contains {selected.digest + (additions[selected.slug] || 0)} current signals and {selected.offers} verified offer patterns. Vera applies these alongside merchant, customer, and trigger context.</p><div className="knowledge-tags"><span>Voice profile</span><span>Peer benchmarks</span><span>Compliance</span><span>Seasonality</span></div><div className="modal-actions"><button className="primary-button" onClick={() => setSelected(null)}>Done</button></div></div></Modal>}
  </div>;
}

function Workspace({ section, data, openAssistant }: { section: string; data: DemoData; openAssistant: () => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ "Performance dip recovery": true, "Recall reminders": true, "Auto-reply protection": true, "Renewal nudges": false });
  const title = section === "customers" ? "Audiences" : section[0].toUpperCase() + section.slice(1);
  if (section === "customers") {
    const optedIn = data.customers.filter((customer) => customer.consent?.opted_in_at).length;
    const segments = [
      { name: "Recall due", count: data.triggers.filter((item) => item.kind === "recall_due" && item.customer_id).length },
      { name: "Lapsed customers", count: data.customers.filter((item) => String(item.state).includes("lapsed")).length },
      { name: "Pharmacy refill due", count: data.triggers.filter((item) => item.kind === "chronic_refill_due" && item.customer_id).length },
      { name: "Trial follow-up", count: data.triggers.filter((item) => item.kind === "trial_followup" && item.customer_id).length }
    ];
    const customerTriggers = data.triggers.filter((item) => item.customer_id).length;
    return <div className="page"><div className="page-title-row"><div><p className="eyebrow">Synthetic customer records</p><h1>Audiences</h1><p>Counts are calculated from bundled customer consent and trigger data.</p></div><button className="primary-button" onClick={openAssistant}><Sparkles size={16} /> Build audience</button></div><div className="stats-grid"><StatCard eyebrow="Customer profiles" value={formatNum(data.customers.length)} delta="JSON records" icon={Users} /><StatCard eyebrow="Recorded opt-ins" value={formatNum(optedIn)} delta="consent records" icon={BadgeCheck} /><StatCard eyebrow="Customer triggers" value={formatNum(customerTriggers)} delta="trigger records" icon={CalendarClock} /><StatCard eyebrow="Without opt-in" value={formatNum(data.customers.length - optedIn)} delta="excluded by default" positive={false} icon={ShieldCheck} /></div><section className="panel workspace-list"><div className="panel-head"><div><h2>Dataset segments</h2><p>Calculated directly from customer states and trigger kinds</p></div></div>{segments.map((segment) => <button key={segment.name} onClick={openAssistant}><span className="priority-icon"><Users size={16} /></span><span><strong>{segment.name}</strong><small>{segment.count} matching seed record{segment.count === 1 ? "" : "s"}</small></span><em>Derived</em><ChevronRight size={16} /></button>)}</section></div>;
  }
  if (section === "automations") {
    return <div className="page"><div className="page-title-row"><div><p className="eyebrow">Always-on orchestration</p><h1>Automations</h1><p>Rules Vera uses to act on live merchant and customer signals.</p></div><button className="primary-button" onClick={openAssistant}><Plus size={16} /> New automation</button></div><section className="panel workspace-list">{Object.entries(enabled).map(([name, active]) => <div className="automation-row" key={name}><span className="priority-icon"><WandSparkles size={16} /></span><span><strong>{name}</strong><small>{active ? "Monitoring live context" : "Paused"}</small></span><button className={`switch ${active ? "on" : ""}`} onClick={() => setEnabled((current) => ({ ...current, [name]: !active }))} aria-label={`Toggle ${name}`}><i /></button></div>)}</section></div>;
  }
  const copy: Record<string, [string, string, string[]]> = {
    analytics: ["Network analytics", "Performance across Vera’s merchant-growth engine.", ["Conversation resolution", "Merchant engagement", "Revenue influence"]],
    compliance: ["Consent & compliance", "Controls for safe, permissioned customer engagement.", ["WhatsApp consent", "Opt-out protection", "Template compliance"]],
    settings: ["Workspace settings", "Manage channels, defaults, and team preferences.", ["WhatsApp channel", "Google Business", "Vera approval mode"]]
  };
  const [heading, description, items] = copy[section] || [title, "Connected to Vera’s shared context engine.", ["Context engine", "Merchant data", "Conversation routing"]];
  const callRate = data.metrics.totalViews ? ((data.metrics.totalCalls / data.metrics.totalViews) * 100).toFixed(1) : "0";
  const analyticsValues = [`${data.metrics.conversations} seed turns`, `${data.metrics.engagementRate}% of merchants`, `${callRate}% calls / views`];
  const complianceValues = [`${data.metrics.consentedCustomers}/${data.customers.length} recorded opt-ins`, `${data.customers.length - data.metrics.consentedCustomers} excluded profiles`, `${data.categories.length} category packs`];
  return <div className="page"><div className="page-title-row"><div><p className="eyebrow">Bundled challenge dataset</p><h1>{heading}</h1><p>{description}</p></div><button className="primary-button" onClick={openAssistant}><Sparkles size={16} /> Ask Vera</button></div><div className="settings-grid">{items.map((item, index) => <section className="panel setting-card" key={item}><span className="priority-icon">{section === "compliance" ? <ShieldCheck size={17} /> : section === "analytics" ? <Gauge size={17} /> : <Settings2 size={17} />}</span><div><h3>{item}</h3><p>{section === "analytics" ? analyticsValues[index] : section === "compliance" ? complianceValues[index] : "Demo configuration—not a live connection"}</p></div><em className="status">{section === "settings" ? "Demo" : "Derived"}</em></section>)}</div></div>;
}

function MerchantDrawer({ merchant, close, navigate, createCampaign }: { merchant: Merchant; close: () => void; navigate: (section: string, merchantId?: string) => void; createCampaign: () => void }) {
  return <><button className="drawer-backdrop" onClick={close} /><aside className="merchant-drawer"><div className="drawer-head"><span>Merchant 360</span><button onClick={close}><X size={19} /></button></div><div className="drawer-profile"><Avatar name={merchant.identity.name} category={merchant.category_slug} size="lg" /><div><span className="tiny-category" style={{ color: tones[merchant.category_slug].color }}>{tones[merchant.category_slug].label}</span><h2>{merchant.identity.name}</h2><p>{merchant.identity.locality}, {merchant.identity.city}</p></div></div><div className="drawer-actions"><button onClick={() => navigate("conversations", merchant.merchant_id)}><MessageCircleMore size={16} /> Open conversation</button><button onClick={createCampaign}><Megaphone size={16} /> Create campaign</button></div><div className="drawer-metrics"><span><small>Profile views</small><strong>{formatNum(merchant.performance.views)}</strong><em className={merchant.performance.delta_7d.views_pct >= 0 ? "positive" : "negative"}>{(merchant.performance.delta_7d.views_pct * 100).toFixed(0)}%</em></span><span><small>Calls</small><strong>{merchant.performance.calls}</strong></span><span><small>Directions</small><strong>{merchant.performance.directions}</strong></span></div><div className="drawer-section"><h3>Vera’s read</h3><div className="drawer-insight"><Sparkles size={17} /><p>{merchant.signals.includes("perf_dip_severe") ? "Performance needs intervention. Calls are materially below the merchant’s recent baseline." : "This merchant has enough signal quality for a highly personalized growth conversation."}</p></div></div><div className="drawer-section"><h3>Signals</h3>{merchant.signals.map((s: string) => <span className="signal-pill" key={s}>{s.replaceAll("_", " ")}</span>)}</div><div className="drawer-section"><h3>Offers</h3>{merchant.offers.map((offer: any) => <div className="drawer-offer" key={offer.id}><span><Target size={15} /></span><div><strong>{offer.title}</strong><small>{offer.status}</small></div></div>)}{!merchant.offers.length && <p className="muted">No offer configured. Vera recommends creating one.</p>}</div></aside></>;
}

export default function Home() {
  const [data, setData] = useState<DemoData | null>(null);
  const [section, setSection] = useState("overview");
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [mobile, setMobile] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [conversationMerchantId, setConversationMerchantId] = useState<string>();
  const [campaignCreateRequest, setCampaignCreateRequest] = useState(0);
  useEffect(() => { fetch("/api/demo").then((r) => r.json()).then(setData); }, []);
  function navigate(sectionName: string, merchantId?: string) {
    if (merchantId) setConversationMerchantId(merchantId);
    setSection(sectionName);
    setMerchant(null);
  }
  function openCampaignComposer() {
    setCampaignCreateRequest((current) => current + 1);
    setSection("campaigns");
    setMerchant(null);
  }
  const view = useMemo(() => {
    if (!data) return null;
    if (section === "overview") return <Overview data={data} openMerchant={setMerchant} setSection={setSection} createCampaign={openCampaignComposer} />;
    if (section === "merchants") return <Merchants data={data} openMerchant={setMerchant} />;
    if (section === "conversations") return <Conversations data={data} initialMerchantId={conversationMerchantId} />;
    if (section === "campaigns") return <Campaigns data={data} createRequest={campaignCreateRequest} onCreateRequestHandled={() => setCampaignCreateRequest(0)} />;
    if (section === "knowledge") return <Knowledge data={data} />;
    return <Workspace section={section} data={data} openAssistant={() => setAssistant(true)} />;
  }, [data, section, conversationMerchantId, campaignCreateRequest]);
  return <Shell section={section} setSection={setSection} mobile={mobile} setMobile={setMobile} data={data} openMerchant={setMerchant} openAssistant={() => setAssistant(true)}>{data ? view : <div className="loading"><div className="brand-mark"><Sparkles size={22} /></div><span>Loading merchant intelligence…</span></div>}{merchant && <MerchantDrawer merchant={merchant} close={() => setMerchant(null)} navigate={navigate} createCampaign={openCampaignComposer} />}{assistant && data && <VeraAssistant data={data} close={() => setAssistant(false)} goTo={setSection} />}</Shell>;
}
