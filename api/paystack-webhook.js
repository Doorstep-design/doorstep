// Paystack calls this URL directly whenever a payment or subscription event
// happens (never the browser) — so this is where we actually mark someone
// as "subscribed" in the database. This uses the Supabase SERVICE ROLE key,
// which can write to any row, bypassing the privacy rules that normally
// restrict each user to their own data — that's intentional and safe here,
// since only Paystack (verified by its signature below) can call this
// endpoint in a way that updates anything.
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Paystack requires the raw, unparsed request body to verify its signature.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const rawBody = await readRawBody(req);
  const signature = req.headers["x-paystack-signature"];

  const expectedSignature = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.error("Paystack webhook signature mismatch");
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(rawBody.toString());

  try {
    if (event.event === "charge.success") {
      const userId = event.data?.metadata?.userId;
      const customerCode = event.data?.customer?.customer_code;
      if (userId) {
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          paystack_customer_code: customerCode,
          subscribed: true,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (event.event === "subscription.disable" || event.event === "subscription.not_renew") {
      const customerCode = event.data?.customer?.customer_code;
      if (customerCode) {
        await supabaseAdmin
          .from("profiles")
          .update({ subscribed: false, updated_at: new Date().toISOString() })
          .eq("paystack_customer_code", customerCode);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
