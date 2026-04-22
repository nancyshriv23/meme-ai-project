import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Prompt Builder ───────────────────────────────────────────
function buildPrompt(topic, tone = "funny") {
    const tones = {
        funny:     "funny and relatable internet humor",
        savage:    "savage, roast-style, dark humor",
        wholesome: "wholesome, heartwarming, feel-good",
        hindi:     "Hinglish (mix of Hindi and English), very desi and relatable for Indian students"
    };
    return `Generate ONLY ONE meme caption about "${topic}" with ${tones[tone] || tones.funny} tone.

Strict format: Part1 | Part2

Rules:
- ONLY output the caption line, nothing else
- No numbering, no explanation, no extra lines
- Must contain exactly one "|"
- Keep each part under 8 words

Example: Me before exam | Me after seeing paper`;
}

// ─── Clean AI Output ──────────────────────────────────────────
function cleanCaption(raw) {
    if (!raw) return null;
    const cleaned = raw
        .replace(/HERE ARE.*?:/i, "")
        .replace(/^(caption:|meme:)\s*/i, "")
        .replace(/\d+\.\s*/g, "")
        .split("\n").find(l => l.includes("|")) || raw.split("\n")[0].trim();
    // Must have | to be valid
    return cleaned.includes("|") ? cleaned : null;
}

// ─── Helper 1: LLaMA 3 via OpenRouter ────────────────────────
async function getLLaMACaption(topic, tone) {
    console.log("   → Trying OpenRouter...");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "meta-llama/llama-3-8b-instruct",
            messages: [{ role: "user", content: buildPrompt(topic, tone) }],
            temperature: 0.85,
            top_p: 0.9,
            max_tokens: 80
        })
    });
    const text = await response.text();
    if (text.trim().startsWith("<")) throw new Error("OpenRouter returned HTML — server may be down");
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const caption = cleanCaption(data?.choices?.[0]?.message?.content || "");
    if (!caption) throw new Error("Invalid format from OpenRouter");
    return { caption, source: "LLaMA 3 (OpenRouter)" };
}

// ─── Helper 2: LLaMA via Hugging Face (free fallback) ────────
async function getHuggingFaceCaption(topic, tone) {
    console.log("   → Trying Hugging Face...");
    const response = await fetch(
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: buildPrompt(topic, tone),
                parameters: { max_new_tokens: 80, temperature: 0.85, return_full_text: false }
            })
        }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    const raw = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    const caption = cleanCaption(raw || "");
    if (!caption) throw new Error("Invalid format from HuggingFace");
    return { caption, source: "Mistral 7B (HuggingFace)" };
}

// ─── Helper 3: Claude Sonnet via Anthropic ───────────────────
async function getClaudeCaption(topic, tone) {
    console.log("   → Trying Claude...");
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY missing in .env");
    console.log("   → Claude key loaded:", key.slice(0,12) + "...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 80,
            messages: [{ role: "user", content: buildPrompt(topic, tone) }]
        })
    });

    const text = await response.text();
    console.log("   → Claude HTTP status:", response.status);
    if (text.trim().startsWith("<")) throw new Error("Claude returned HTML — check API key");
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const caption = cleanCaption(data.content[0].text);
    if (!caption) throw new Error("Invalid format from Claude");
    return { caption, source: "Claude Sonnet (Anthropic)" };
}

// ─── Fallback Chain for LLaMA ─────────────────────────────────
// OpenRouter fail → HuggingFace try karo automatically
async function getLLaMAWithFallback(topic, tone) {
    try {
        return await getLLaMACaption(topic, tone);
    } catch (err) {
        console.warn("   ⚠ OpenRouter failed:", err.message, "→ switching to HuggingFace");
        return await getHuggingFaceCaption(topic, tone);
    }
}

// ─── Route 1: LLaMA 3 (with auto fallback) ───────────────────
app.post("/generate", async (req, res) => {
    try {
        const topic = req.body.text || "Exam";
        const tone  = req.body.tone || "funny";
        console.log(">>> [LLaMA] Topic:", topic, "| Tone:", tone);
        const result = await getLLaMAWithFallback(topic, tone);
        console.log(">>> [LLaMA] Result:", result.caption, "via", result.source);
        res.json({ response: result.caption, model: result.source });
    } catch (err) {
        console.error(">>> [LLaMA] All sources failed:", err.message);
        res.status(500).json({ error: "Both OpenRouter and HuggingFace failed: " + err.message });
    }
});

// ─── Route 2: Claude Sonnet ───────────────────────────────────
app.post("/generate-claude", async (req, res) => {
    try {
        const topic = req.body.text || "Exam";
        const tone  = req.body.tone || "funny";
        console.log(">>> [Claude] Topic:", topic, "| Tone:", tone);
        const result = await getClaudeCaption(topic, tone);
        console.log(">>> [Claude] Result:", result.caption);
        res.json({ response: result.caption, model: result.source });
    } catch (err) {
        console.error(">>> [Claude] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Route 3: Compare All Models ─────────────────────────────
app.post("/compare", async (req, res) => {
    try {
        const topic = req.body.text || "Exam";
        const tone  = req.body.tone || "funny";
        console.log(">>> [Compare] Topic:", topic, "| Tone:", tone);

        const [llamaRes, claudeRes] = await Promise.allSettled([
            getLLaMAWithFallback(topic, tone),
            getClaudeCaption(topic, tone)
        ]);

        res.json({
            llama:       llamaRes.status  === "fulfilled" ? llamaRes.value.caption  : "Error",
            llama_src:   llamaRes.status  === "fulfilled" ? llamaRes.value.source   : "Failed",
            claude:      claudeRes.status === "fulfilled" ? claudeRes.value.caption : "Error",
            claude_src:  claudeRes.status === "fulfilled" ? claudeRes.value.source  : "Failed",
        });

    } catch (err) {
        console.error(">>> [Compare] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});