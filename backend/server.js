import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   🏠 ROOT ROUTE
========================= */
app.get("/", (req, res) => {
    res.send("🚀 Meme AI Backend is Running Successfully");
});

/* =========================
   🤖 AI GENERATE ROUTE
========================= */
app.post("/generate", async (req, res) => {
    try {
        const topic = req.body.text || "Exam";
        console.log(">>> User asked:", topic);

        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-3-8b-instruct",
                    messages: [
                        {
                            role: "user",
                            content: `Generate ONLY ONE meme caption about "${topic}" in EXACT format:

Part1 | Part2

Rules:
- Do NOT add numbering
- Do NOT add explanation
- Do NOT add extra lines
- Output ONLY one line
- Must include "|"

Example:
Me before exam | Me after exam`
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        console.log(">>> Status:", response.status);
        console.log(">>> Data:", data);

        const raw = data?.choices?.[0]?.message?.content || "";

        const cleaned = raw
            .replace(/HERE ARE.*?:/i, "")
            .replace(/\d+\.\s*/g, "")
            .split("\n")[0]
            .trim();

        console.log(">>> Cleaned:", cleaned);

        res.json({ response: cleaned });

    } catch (err) {
        console.error(">>> ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
});