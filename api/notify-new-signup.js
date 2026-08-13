// Supabase calls this the instant a new row appears in auth.users (i.e. the
// moment someone signs up for the first time). It's protected by a shared
// secret so random requests can't trigger fake emails.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.headers["x-notify-secret"] !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { email, created_at } = req.body || {};

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Doorstep <onboarding@resend.dev>",
        to: process.env.NOTIFY_EMAIL,
        subject: "New Doorstep signup 🎉",
        text: `${email} just signed up for Doorstep.\n\nTime: ${created_at || new Date().toISOString()}`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Resend error:", detail);
      return res.status(500).json({ error: "Email failed to send" });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Notify signup error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
