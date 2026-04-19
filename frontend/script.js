const templateSelect = document.getElementById("templateSelect");
const memeImage = document.getElementById("memeImage");
const line1 = document.getElementById("line1");
const line2 = document.getElementById("line2");
const container = document.getElementById("memeTextContainer");
const generateBtn = document.getElementById("generateBtn");

// =========================
// TEMPLATE SWITCHING
// =========================
templateSelect.addEventListener("change", () => {
    const value = templateSelect.value;
    memeImage.src = `templates/${value}`;

    container.className = "";

    if (value === "drake.jpg" || value === "tuxedowinnie.jpg") {
        container.classList.add("layout-split");
    } else {
        container.classList.add("layout-stacked");
    }
});

// =========================
// EVENT HANDLER
// =========================
generateBtn.addEventListener("click", generateMeme);

// =========================
// MAIN FUNCTION
// =========================
async function generateMeme() {
    const input = document.getElementById("userInput");
    const topic = input.value.trim();

    if (!topic) {
        showMessage("Please enter a topic to generate a meme.");
        return;
    }

    setLoadingState(true);

    try {
        const response = await fetch("https://meme-ai-project.onrender.com/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: topic })
        });

        if (!response.ok) {
            throw new Error("Failed to fetch from server");
        }

        const data = await response.json();

        let caption = data?.response?.trim() || "";

        if (!caption) {
            throw new Error("Empty response from AI");
        }

        // =========================
        // CLEANING RESPONSE
        // =========================
        caption = caption
            .replace(/HERE ARE.*?:/i, "")
            .replace(/\d+\.\s*/g, "")
            .split("\n")[0]
            .trim()
            .toUpperCase();

        // =========================
        // SPLIT LOGIC
        // =========================
        if (caption.includes("|")) {
            const [top, bottom] = caption.split("|");

            line1.innerText = top.trim();
            line2.innerText = bottom.trim();
        } else {
            line1.innerText = caption;
            line2.innerText = "";
        }

    } catch (error) {
        console.error("Error:", error);
        line1.innerText = "FAILED TO GENERATE";
        line2.innerText = "PLEASE TRY AGAIN";
    } finally {
        setLoadingState(false);
    }
}

// =========================
// UI HELPERS
// =========================
function setLoadingState(isLoading) {
    if (isLoading) {
        line1.innerText = "GENERATING...";
        line2.innerText = "";
        generateBtn.disabled = true;
    } else {
        generateBtn.disabled = false;
    }
}

function showMessage(message) {
    line1.innerText = message;
    line2.innerText = "";
}