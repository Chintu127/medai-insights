import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are MedAI Assistant, a medically-literate AI helper.

RULES:
- You are NOT a doctor and do NOT provide diagnoses or prescriptions.
- Provide educational, evidence-based information only.
- Always recommend consulting a qualified healthcare professional for medical decisions.
- Use clear, empathetic, plain language. Use markdown formatting (lists, bold) where helpful.
- For urgent symptoms (chest pain, stroke signs, severe bleeding, suicidal thoughts, anaphylaxis), tell the user to seek emergency care immediately.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as {
            messages: Array<{ role: string; content: string }>;
          };
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              stream: true,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages.slice(-20),
              ],
            }),
          });
          if (!upstream.ok) {
            if (upstream.status === 429)
              return new Response(JSON.stringify({ error: "Rate limit reached." }), {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            if (upstream.status === 402)
              return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
                status: 402,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            const txt = await upstream.text();
            return new Response(JSON.stringify({ error: txt.slice(0, 300) }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(upstream.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
