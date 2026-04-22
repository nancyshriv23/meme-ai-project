import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/generate", async (req, res) => {
    try {
        const topic = req.body.text || "Exam";
        console.log(">>> User asked:", topic);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        });

        const data = await response.json();

        console.log(">>> Status:", response.status);
        console.log(">>> Data:", data);

        // 🔥 RAW AI OUTPUT
        const raw = data?.choices?.[0]?.message?.content || "";

        // 🔥 CLEANING LOGIC (IMPORTANT)
        const cleaned = raw
            .replace(/HERE ARE.*?:/i, "")   // remove headings
            .replace(/\d+\.\s*/g, "")       // remove numbering
            .split("\n")[0]                 // take first line only
            .trim();

        console.log(">>> Cleaned:", cleaned);

        res.json({ response: cleaned });

    } catch (err) {
        console.error(">>> ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});