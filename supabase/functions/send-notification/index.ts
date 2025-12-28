// @ts-ignore
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";

const SENDGRID_API = "https://api.sendgrid.com/v3/mail/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendEmail(
  sendgridKey: string,
  from: string,
  to: string,
  subject: string,
  plainText: string,
  html?: string
) {
  const body: any = {
    personalizations: [{ to: [{ email: to }], subject }],
    from: { email: from },
    content: [{ type: "text/plain", value: plainText }],
  };
  if (html) body.content.push({ type: "text/html", value: html });

  const res = await fetch(SENDGRID_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${txt}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendgridKey = Deno.env.get("SENDGRID_API_KEY") || "";
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();

    const { member_id = null, recipient_role = null, type, title, message, metadata = null } = payload;

    // Insert notification record in Supabase
    const { data: inserted, error: insertErr } = await supabase
      .from("notifications")
      .insert([
        {
          member_id: member_id || null,
          recipient_role: recipient_role || null,
          type,
          title,
          message,
          metadata: metadata ? metadata : null,
          sent_at: new Date().toISOString(),
          read: false,
        },
      ])
      .select()
      .maybeSingle();
    if (insertErr) throw insertErr;

    // Determine email recipients
    let recipients: string[] = [];

    if (member_id) {
      const { data: memberRow } = await supabase
        .from("members")
        .select("profile_id")
        .eq("id", member_id)
        .maybeSingle();
      if (memberRow?.profile_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", memberRow.profile_id)
          .maybeSingle();
        if (profile?.email) recipients.push(profile.email);
      }
    } else if (recipient_role === "admin") {
      const { data: admins } = await supabase.from("profiles").select("email").eq("role", "admin");
      if (Array.isArray(admins)) recipients.push(...admins.map((a: any) => a.email).filter(Boolean));
    }

    // Optional testing email
    if (payload.toEmail) recipients.push(payload.toEmail);

    // Send emails via SendGrid (best-effort)
    if (sendgridKey && senderEmail && recipients.length > 0) {
      for (const to of recipients) {
        try {
          await sendEmail(sendgridKey, senderEmail, to, `[SmartSave] ${title}`, message);
        } catch (e) {
          console.warn("Failed sending email to", to, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notification: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-notification error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
