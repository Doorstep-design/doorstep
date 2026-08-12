import React, { useState, useEffect } from "react";

const CADENCE_DAYS = [1, 3, 7, 14, 30, 90];
const SOURCES = ["Website", "Zillow", "Referral", "Open House", "Walk-in", "Other"];
const STORAGE_KEY = "doorstep:leads";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export default function App() {
  const [leads, setLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", source: SOURCES[0], notes: "" });
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setLeads(raw ? JSON.parse(raw) : []);
    } catch {
      setLeads([]);
    }
    setLoaded(true);
  }, []);

  const persist = (next) => {
    setLeads(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setError("");
    } catch {
      setError("Couldn't save — your browser storage may be full or blocked.");
    }
  };

  const addLead = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const today = todayISO();
    const newLead = {
      id: `${Date.now()}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      source: form.source,
      notes: form.notes.trim(),
      addedDate: today,
      lastContact: null,
      stage: 0,
      nextDue: addDays(today, CADENCE_DAYS[0]),
      history: [],
      archived: false,
    };
    persist([newLead, ...leads]);
    setForm({ name: "", phone: "", source: SOURCES[0], notes: "" });
    setShowForm(false);
  };

  const markContacted = (id) => {
    const today = todayISO();
    const next = leads.map((l) => {
      if (l.id !== id) return l;
      const nextStage = Math.min(l.stage + 1, CADENCE_DAYS.length - 1);
      return {
        ...l,
        lastContact: today,
        stage: nextStage,
        nextDue: addDays(today, CADENCE_DAYS[nextStage]),
        history: [...l.history, { date: today, action: "Contacted" }],
      };
    });
    persist(next);
  };

  const snooze = (id, days) => {
    persist(leads.map((l) => (l.id === id ? { ...l, nextDue: addDays(l.nextDue, days) } : l)));
  };

  const archive = (id) => {
    persist(leads.map((l) => (l.id === id ? { ...l, archived: true } : l)));
  };

  if (!loaded) {
    return <div className="app"><p style={{ opacity: 0.6 }}>Loading your leads…</p></div>;
  }

  const today = todayISO();
  const active = leads.filter((l) => !l.archived);
  const overdue = active.filter((l) => l.nextDue < today);
  const dueToday = active.filter((l) => l.nextDue === today);
  const upcoming = active.filter((l) => l.nextDue > today);

  let shown = active;
  if (filter === "overdue") shown = overdue;
  if (filter === "today") shown = dueToday;
  if (filter === "upcoming") shown = upcoming;
  shown = [...shown].sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1));

  const statusOf = (l) => {
    if (l.nextDue < today) return { label: `${daysBetween(l.nextDue, today)}d overdue`, color: "var(--overdue)" };
    if (l.nextDue === today) return { label: "Due today", color: "var(--brass)" };
    return { label: `Due ${l.nextDue}`, color: "#5B6B63" };
  };

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="eyebrow">
            <div className="eyebrow-bar" />
            <span className="eyebrow-text">Follow-up autopilot</span>
          </div>
          <h1 className="title">Doorstep</h1>
          <p className="subtitle">Every lead gets knocked on until they answer, or you decide to stop.</p>
        </div>
        <button className="add-btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add lead"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card" style={{ borderTop: "3px solid var(--overdue)" }}>
          <p className="stat-value" style={{ color: "var(--overdue)" }}>{overdue.length}</p>
          <p className="stat-label">Overdue</p>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid var(--brass)" }}>
          <p className="stat-value" style={{ color: "var(--brass)" }}>{dueToday.length}</p>
          <p className="stat-label">Due today</p>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid var(--forest)" }}>
          <p className="stat-value" style={{ color: "var(--forest)" }}>{upcoming.length}</p>
          <p className="stat-label">Upcoming</p>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid var(--ink)" }}>
          <p className="stat-value">{active.length}</p>
          <p className="stat-label">Total active</p>
        </div>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={addLead}>
          <div className="form-grid">
            <input className="field" placeholder="Lead name" required
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="field" placeholder="Phone or email (optional)"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <select className="field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="field" placeholder="Notes (optional)"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="submit-btn">Add to Doorstep</button>
        </form>
      )}

      <div className="filters">
        {[
          ["all", `All (${active.length})`],
          ["overdue", `Overdue (${overdue.length})`],
          ["today", `Today (${dueToday.length})`],
          ["upcoming", `Upcoming (${upcoming.length})`],
        ].map(([key, label]) => (
          <button key={key} className={`filter-btn ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <p>{active.length === 0 ? "No leads yet — add your first one above." : "Nothing here right now."}</p>
        </div>
      ) : (
        <div className="lead-list">
          {shown.map((l) => {
            const status = statusOf(l);
            return (
              <div key={l.id} className="lead-card" style={{ borderLeft: `4px solid ${status.color}` }}>
                <div>
                  <div className="lead-name-row">
                    <p className="lead-name">{l.name}</p>
                    <span className="source-tag">{l.source}</span>
                  </div>
                  {l.phone && <p className="lead-phone">{l.phone}</p>}
                  <p className="lead-status" style={{ color: status.color }}>{status.label}</p>
                  <p className="lead-meta">
                    Stage {l.stage + 1} of {CADENCE_DAYS.length} · Added {l.addedDate}
                    {l.lastContact ? ` · Last contact ${l.lastContact}` : " · Never contacted"}
                  </p>
                </div>
                <div className="lead-actions">
                  <button className="btn-contact" onClick={() => markContacted(l.id)}>Mark contacted</button>
                  <button className="btn-snooze" onClick={() => snooze(l.id, 3)}>Snooze 3d</button>
                  <button className="btn-archive" onClick={() => archive(l.id)}>Archive</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
