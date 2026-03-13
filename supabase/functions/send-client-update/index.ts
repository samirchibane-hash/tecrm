import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "Treat Engine <info@treatengine.com>";
const REPLY_TO = "info@treatleads.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountName, recipientEmail, kpis, recentUpdates, dateLabel, customNote, draftOnly } = await req.json();

    if (!recipientEmail) throw new Error("recipientEmail is required");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");
    if (!draftOnly && !resendKey) throw new Error("RESEND_API_KEY not configured");

    const fmt = (v: number) => (v > 0 ? `$${v.toFixed(2)}` : "–");

    const updatesText = (recentUpdates ?? [])
      .slice(0, 5)
      .map((u: { date: string; title: string; details: string }) =>
        `- [${u.date}] ${u.title}${u.details ? ": " + u.details : ""}`
      )
      .join("\n") || "No recent changes logged.";

    const prompt = `You are writing a short, direct client notification email on behalf of Treat Engine, a digital marketing agency.

Write 2–3 sentences maximum. Focus only on the specific campaign update below — do not mention general metrics or performance summaries. Be clear and professional. Sign off as "The Treat Engine Team".

Account: ${accountName}
${customNote ? `Note: ${customNote}` : ""}

Campaign update:
${updatesText}

Respond with a JSON object only — no markdown, no extra text:
{"subject": "...", "body": "..."}

The subject should reference the specific update (e.g. "Campaign update — budget adjustment on March 7"). The body should be plain text, no HTML.`;

    // Generate email with Claude
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) throw new Error(`Anthropic error ${aiRes.status}: ${await aiRes.text()}`);

    const aiData = await aiRes.json();
    const text: string = aiData.content?.[0]?.text ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const { subject, body } = jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: "", body: "" };

    if (!subject || !body) throw new Error("AI did not return valid email content");

    // If draft-only, return without sending
    if (draftOnly) {
      return new Response(JSON.stringify({ success: true, subject, body }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Resend
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [recipientEmail],
        reply_to: REPLY_TO,
        subject,
        text: body,
      }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`Resend error ${sendRes.status}: ${err}`);
    }

    const sendData = await sendRes.json();

    return new Response(JSON.stringify({ success: true, subject, body, id: sendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-client-update error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
