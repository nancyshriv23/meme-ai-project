import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const HF_KEY = process.env.HF_API_KEY;

// ─── Prompt ───────────────────────────────────────────────────
function buildPrompt(topic, tone) {
    const tones = {
        funny:     "funny and relatable internet humor",
        savage:    "savage, roast-style, dark humor",
        wholesome: "wholesome, heartwarming, feel-good",
        hindi:     "Hinglish desi Indian student humor"
    };
    const t = tones[tone] || tones.funny;
    return `Generate ONE meme caption about "${topic}" in ${t} style.\nFormat: Part1 | Part2\nOnly output the caption line. Example: Me before exam | Me after seeing paper`;
}

// ─── Clean output ─────────────────────────────────────────────
function cleanCaption(raw) {
    if (!raw) return null;
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const line = lines.find(l => l.includes("|")) || lines[0] || "";
    const cleaned = line.replace(/^(caption:|meme:|output:)\s*/i, "").replace(/^\d+\.\s*/, "").trim();
    return cleaned.includes("|") ? cleaned : null;
}

// ─── Pollinations AI — free, no key, instant ─────────────────
async function callPollinations(topic, tone) {
    const tones = {
        funny: "funny and relatable",
        savage: "savage and dark",
        wholesome: "wholesome and heartwarming",
        hindi: "Hinglish desi Indian humor"
    };
    const prompt = encodeURIComponent(
        `Generate ONE meme caption about ${topic} in ${tones[tone] || tones.funny} style. Format: Part1 | Part2. Only output the caption.`
    );
    const res = await fetch(`https://text.pollinations.ai/${prompt}`);
    const text = await res.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const line = lines.find(l => l.includes("|")) || lines[0] || "";
    const cleaned = line.replace(/^(caption:|meme:)\s*/i, "").trim();
    if (!cleaned.includes("|")) throw new Error("No valid format from Pollinations");
    return cleaned;
}

// ─── HuggingFace — free with key, used as fallback ───────────
async function callHF(model, topic, tone) {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${HF_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputs: buildPrompt(topic, tone),
            parameters: { max_new_tokens: 60, temperature: 0.85, return_full_text: false, do_sample: true }
        })
    });
    const text = await res.text();
    if (text.trim().startsWith("<")) throw new Error("HF model loading, retry");
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error);
    const raw = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    const caption = cleanCaption(raw || "");
    if (!caption) throw new Error("No valid caption from HF");
    return caption;
}

// ─── Route 1: /generate — Pollinations → HF fallback ─────────
app.post("/generate", async (req, res) => {
    const topic = req.body.text || "Exam";
    const tone  = req.body.tone || "funny";
    console.log(">>> [Route1] Topic:", topic, "Tone:", tone);
    try {
        let caption, model;
        try {
            caption = await callPollinations(topic, tone);
            model = "Mistral (Pollinations AI)";
            console.log(">>> Pollinations success:", caption);
        } catch (e) {
            console.warn(">>> Pollinations failed:", e.message, "→ trying HF");
            caption = await callHF("mistralai/Mistral-7B-Instruct-v0.3", topic, tone);
            model = "Mistral 7B (HuggingFace)";
        }
        res.json({ response: caption, model });
    } catch (err) {
        console.error(">>> Route1 ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Route 2: /generate-claude — HF Zephyr → Pollinations ───
app.post("/generate-claude", async (req, res) => {
    const topic = req.body.text || "Exam";
    const tone  = req.body.tone || "funny";
    console.log(">>> [Route2] Topic:", topic, "Tone:", tone);
    try {
        let caption, model;
        try {
            caption = await callHF("HuggingFaceH4/zephyr-7b-beta", topic, tone);
            model = "Zephyr 7B (HuggingFace)";
            console.log(">>> Zephyr success:", caption);
        } catch (e) {
            console.warn(">>> Zephyr failed:", e.message, "→ trying Pollinations");
            caption = await callPollinations(topic, tone);
            model = "Mistral (Pollinations AI)";
        }
        res.json({ response: caption, model });
    } catch (err) {
        console.error(">>> Route2 ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Route 3: /compare — both simultaneously ─────────────────
app.post("/compare", async (req, res) => {
    const topic = req.body.text || "Exam";
    const tone  = req.body.tone || "funny";
    console.log(">>> [Compare] Topic:", topic, "Tone:", tone);

    const [r1, r2] = await Promise.allSettled([
        callPollinations(topic, tone),
        callHF("HuggingFaceH4/zephyr-7b-beta", topic, tone)
    ]);

    res.json({
        llama:      r1.status === "fulfilled" ? r1.value : "Error",
        llama_src:  "Pollinations AI",
        claude:     r2.status === "fulfilled" ? r2.value : "Error",
        claude_src: "Zephyr 7B (HuggingFace)",
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));
