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
    const topic = document.getElementById("userInput").value.trim();

    if (!topic) {
        alert("Kuch likho!");
        return;
    }

    document.getElementById("line1").innerText = "THINKING...";
    document.getElementById("line2").innerText = "";

    try {
        const res = await fetch("http://localhost:3000/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // ✅ THIS IS IMPORTANT
            body: JSON.stringify({ text: topic })
        });

        const data = await res.json();
        console.log("API Response:", data);

        // ✅ THIS IS IMPORTANT
        let caption = data.response || "";

        // 🔥 CLEAN AI JUNK
        caption = caption
            .replace(/HERE ARE.*?:/i, "")
            .replace(/\d+\.\s*/g, "")
            .split("\n")[0] // take first line only
            .trim();

        if (!caption) {
            throw new Error("No response from API");
        }

        caption = caption.toUpperCase();

        if (caption.includes("|")) {
            const parts = caption.split("|");

            document.getElementById("line1").innerText = parts[0].trim();
            document.getElementById("line2").innerText = parts[1].trim();
        } else {
            document.getElementById("line1").innerText = caption;
            document.getElementById("line2").innerText = "";
        }

    } catch (err) {
        console.error(err);
        document.getElementById("line1").innerText = "AI FAILED 💀";
        document.getElementById("line2").innerText = "TRY AGAIN";
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