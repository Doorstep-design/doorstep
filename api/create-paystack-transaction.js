// This runs on Vercel's servers, not in the browser — so it's safe to use
// the secret Paystack key here. It never gets sent to the person's computer.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, email } = req.body || {};
  if (!userId || !email) {
    return res.status(400).json({ error: "Missing userId or email" });
  }

  try {
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: process.env.PAYSTACK_PLAN_AMOUNT_KOBO, // must match the plan's price, in kobo
        plan: process.env.PAYSTACK_PLAN_CODE,
        callback_url: `${origin}/?upgraded=true`,
        metadata: { userId },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      return res.status(500).json({ error: data.message || "Could not start payment" });
    }

    res.status(200).json({ url: data.data.authorization_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
