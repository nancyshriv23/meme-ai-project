import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const HF_KEY = process.env.HF_API_KEY;

// ─── Prompt Builder ───────────────────────────────────────────
function buildPrompt(topic, tone = "funny") {
    const tones = {
        funny:     "funny and relatable internet humor",
        savage:    "savage, roast-style, dark humor",
        wholesome: "wholesome, heartwarming, feel-good",
        hindi:     "Hinglish (mix of Hindi and English), desi and relatable for Indian students"
    };
    return `Generate ONLY ONE meme caption about "${topic}" with ${tones[tone] || tones.funny} tone.

Strict format: Part1 | Part2

Rules:
- Output ONLY the caption line, nothing else
- No numbering, no explanation, no extra lines
- Must contain exactly one "|"
- Keep each part under 8 words

Example: Me before exam | Me after seeing paper`;
}

// ─── Clean AI Output ──────────────────────────────────────────
function cleanCaption(raw) {
    if (!raw) return null;
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const line = lines.find(l => l.includes("|")) || lines[0] || "";
    const cleaned = line
        .replace(/^(caption:|meme:|output:)\s*/i, "")
        .replace(/^\d+\.\s*/, "")
        .trim();
    return cleaned.includes("|") ? cleaned : null;
}

// ─── HuggingFace API call (reusable) ─────────────────────────
async function callHF(model, topic, tone) {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${HF_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputs: buildPrompt(topic, tone),
            parameters: {
                max_new_tokens: 60,
                temperature: 0.85,
                return_full_text: false,
                do_sample: true
            }
        })
    });
    const text = await res.text();
    if (text.trim().startsWith("<")) throw new Error("HuggingFace returned HTML - model loading, retry");
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error);
    const raw = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    const caption = cleanCaption(raw || "");
    if (!caption) throw new Error("No valid caption format received");
    return caption;
}

// ─── Route 1: Mistral 7B ─────────────────────────────────────
app.post("/generate", async (req, res) => {
    const topic = req.body.text || "Exam";
    const tone  = req.body.tone || "funny";
    console.log(">>> [Mistral] Topic:", topic);
    try {
        const caption = await callHF("mistralai/Mistral-7B-Instruct-v0.3", topic, tone);
        console.log(">>> [Mistral] Result:", caption);
        res.json({ response: caption, model: "Mistral 7B (HuggingFace)" });
    } catch (err) {
        console.error(">>> [Mistral] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Route 2: Zephyr 7B ──────────────────────────────────────
app.post("/generate-claude", async (req, res) => {
    const topic = req.body.text || "Exam";
    const tone  = req.body.tone || "funny";
    console.log(">>> [Zephyr] Topic:", topic);
    try {
        const caption = await callHF("HuggingFaceH4/zephyr-7b-beta", topic, tone);
        console.log(">>> [Zephyr] Result:", caption);
        res.json({ response: caption, model: "Zephyr 7B (HuggingFace)" });
    } catch (err) {
        console.error(">>> [Zephyr] ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Route 3: Compare — Mistral vs Zephyr ────────────────────
app.post("/compare", async (req, res) => {
    const topic = req.body.text || "Exam";
    const tone  = req.body.tone || "funny";
    console.log(">>> [Compare] Topic:", topic);

    const [mistralRes, zephyrRes] = await Promise.allSettled([
        callHF("mistralai/Mistral-7B-Instruct-v0.3", topic, tone),
        callHF("HuggingFaceH4/zephyr-7b-beta", topic, tone)
    ]);

    res.json({
        llama:      mistralRes.status === "fulfilled" ? mistralRes.value : "Error",
        llama_src:  "Mistral 7B (HuggingFace)",
        claude:     zephyrRes.status  === "fulfilled" ? zephyrRes.value  : "Error",
        claude_src: "Zephyr 7B (HuggingFace)",
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));
