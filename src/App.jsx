import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";

const CADENCE_DAYS = [1, 3, 7, 14, 30, 90];
const SOURCES = ["Website", "Zillow", "Referral", "Open House", "Walk-in", "Other"];
const FREE_LEAD_LIMIT = 15;

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

// Maps between our camelCase app model and Supabase's snake_case columns.
function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    source: row.source,
    notes: row.notes || "",
    addedDate: row.added_date,
    lastContact: row.last_contact,
    stage: row.stage,
    nextDue: row.next_due,
    history: row.history || [],
    archived: row.archived,
  };
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = logged out
  const [leads, setLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", source: SOURCES[0], notes: "" });
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from("profiles")
      .select("subscribed")
      .eq("id", userId)
      .maybeSingle();
    setSubscribed(Boolean(data?.subscribed));
  }, []);

  useEffect(() => {
    if (session) fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  // After returning from Stripe Checkout, re-check subscription status a
  // couple of times — the webhook usually lands within a second or two.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true" && session) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts += 1;
        fetchProfile(session.user.id);
        if (attempts >= 5) clearInterval(interval);
      }, 2000);
      window.history.replaceState({}, "", window.location.pathname);
      return () => clearInterval(interval);
    }
  }, [session, fetchProfile]);

  const startUpgrade = async () => {
    setUpgrading(true);
    setError("");
    try {
      const res = await fetch("/api/create-paystack-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError("Couldn't start checkout: " + (data.error || "unknown error"));
    } catch (err) {
      setError("Couldn't start checkout: " + err.message);
    }
    setUpgrading(false);
  };

  const leadLimit = subscribed ? Infinity : FREE_LEAD_LIMIT;

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("next_due", { ascending: true });
    if (error) {
      setError("Couldn't load your leads: " + error.message);
    } else {
      setLeads(data.map(fromRow));
      setError("");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (session) fetchLeads();
  }, [session, fetchLeads]);

  if (session === undefined) {
    return <div className="app"><p style={{ opacity: 0.6 }}>Loading…</p></div>;
  }
  if (!session) {
    return <Login />;
  }

  const addLead = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const active = leads.filter((l) => !l.archived);
    if (active.length >= leadLimit) {
      setError(`You've hit the free plan limit of ${FREE_LEAD_LIMIT} active leads. Upgrade to add more.`);
      return;
    }
    const today = todayISO();
    const { error } = await supabase.from("leads").insert({
      user_id: session.user.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      source: form.source,
      notes: form.notes.trim(),
      added_date: today,
      last_contact: null,
      stage: 0,
      next_due: addDays(today, CADENCE_DAYS[0]),
      history: [],
      archived: false,
    });
    if (error) {
      setError("Couldn't add lead: " + error.message);
    } else {
      setForm({ name: "", phone: "", source: SOURCES[0], notes: "" });
      setShowForm(false);
      fetchLeads();
    }
  };

  const markContacted = async (l) => {
    const today = todayISO();
    const nextStage = Math.min(l.stage + 1, CADENCE_DAYS.length - 1);
    const { error } = await supabase
      .from("leads")
      .update({
        last_contact: today,
        stage: nextStage,
        next_due: addDays(today, CADENCE_DAYS[nextStage]),
        history: [...l.history, { date: today, action: "Contacted" }],
      })
      .eq("id", l.id);
    if (error) setError("Couldn't update: " + error.message);
    else fetchLeads();
  };

  const snooze = async (l, days) => {
    const { error } = await supabase
      .from("leads")
      .update({ next_due: addDays(l.nextDue, days) })
      .eq("id", l.id);
    if (error) setError("Couldn't update: " + error.message);
    else fetchLeads();
  };

  const archive = async (l) => {
    const { error } = await supabase.from("leads").update({ archived: true }).eq("id", l.id);
    if (error) setError("Couldn't update: " + error.message);
    else fetchLeads();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, opacity: 0.5 }}>{session.user.email}</span>
          {subscribed ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--forest)", background: "#E4EEED", padding: "4px 10px", borderRadius: 999 }}>
              Unlimited plan
            </span>
          ) : (
            <button className="submit-btn" onClick={startUpgrade} disabled={upgrading}>
              {upgrading ? "Loading…" : "Upgrade — ₦18,000/mo"}
            </button>
          )}
          <button className="btn-snooze" onClick={signOut}>Sign out</button>
          <button className="add-btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ Add lead"}
          </button>
        </div>
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
          <p className="stat-value">{active.length}{subscribed ? "" : ` / ${FREE_LEAD_LIMIT}`}</p>
          <p className="stat-label">{subscribed ? "Active leads" : "Active leads (free plan)"}</p>
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
                  <button className="btn-contact" onClick={() => markContacted(l)}>Mark contacted</button>
                  <button className="btn-snooze" onClick={() => snooze(l, 3)}>Snooze 3d</button>
                  <button className="btn-archive" onClick={() => archive(l)}>Archive</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
