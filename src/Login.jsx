import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="eyebrow">
          <div className="eyebrow-bar" />
          <span className="eyebrow-text">Follow-up autopilot</span>
        </div>
        <h1 className="title">Doorstep</h1>
        <p className="subtitle">The dead-simple way to stop losing real estate leads to forgetting.</p>

        <div className="login-features">
          <div className="login-feature-item">
            <span className="login-feature-check">✓</span>
            <span>Add a lead once — Doorstep schedules follow-ups automatically at 1, 3, 7, 14, 30, and 90 days.</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-check">✓</span>
            <span>Your dashboard shows exactly who's overdue today — no spreadsheet, no guessing.</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-check">✓</span>
            <span>Your leads follow you across your phone and laptop, private to your account only.</span>
          </div>
        </div>

        <hr className="login-divider" />

        {sent ? (
          <div className="login-sent">
            <p>Check <strong>{email}</strong> for a sign-in link. Click it on this device to log in — no password needed.</p>
            <button className="btn-snooze" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={sendLink} className="login-form">
            <input
              className="field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="add-btn" type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send sign-in link"}
            </button>
            {error && <p className="login-error">{error}</p>}
          </form>
        )}

        <p className="login-price-note">Free for your first 15 active leads · ₦20,000/mo for unlimited</p>
      </div>
    </div>
  );
}
