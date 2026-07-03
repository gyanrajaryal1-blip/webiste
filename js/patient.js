const problemForm = document.querySelector("#problemForm");
const problemList = document.querySelector("#problemList");
const formStatus = document.querySelector("#formStatus");
const refreshProblems = document.querySelector("#refreshProblems");
const canUseApi = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1";
const apiBase = window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "";
const storageKey = "drGyanPatientProblems";
const adminPin = "1111";

const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const readStoredProblems = () => {
    try {
        return JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch (error) {
        return [];
    }
};

const saveStoredProblems = (problems) => {
    localStorage.setItem(storageKey, JSON.stringify(problems));
};

const formatDate = () => new Date().toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

const renderProblems = (problems) => {
    if (!problems.length) {
        problemList.innerHTML = '<p class="empty-state">No patient problems have been saved yet.</p>';
        return;
    }

    problemList.innerHTML = problems.map((item) => `
        <article class="problem-card" data-id="${item.id}">
            <div class="problem-card__meta">
                <strong>${escapeHtml(item.patient_name)}</strong>
                <span>${escapeHtml(item.created_at)}</span>
            </div>
            <p class="problem-contact">${escapeHtml(item.contact)}</p>
            <div class="chat-bubble chat-bubble--patient">
                <span>Patient problem</span>
                <p>${escapeHtml(item.problem)}</p>
            </div>
            <div class="reply-box">
                <h3>Doctor Reply</h3>
                <div class="chat-bubble chat-bubble--doctor">
                    <span>Saved reply</span>
                    <p>${item.reply ? escapeHtml(item.reply) : "No reply yet."}</p>
                </div>
                <form class="reply-form">
                    <input type="password" name="pin" inputmode="numeric" placeholder="Enter reply PIN" required>
                    <textarea name="reply" placeholder="Write or update reply" required>${escapeHtml(item.reply)}</textarea>
                    <button class="primary-btn" type="submit">Save Reply</button>
                </form>
                <form class="delete-form">
                    <input type="password" name="pin" inputmode="numeric" placeholder="Enter delete PIN" required>
                    <button class="danger-btn" type="submit">Delete Chat</button>
                </form>
            </div>
        </article>
    `).join("");
};

async function loadProblems() {
    if (!problemList) {
        return;
    }

    problemList.innerHTML = '<p class="empty-state">Loading saved problems...</p>';

    if (!canUseApi) {
        renderProblems(readStoredProblems());
        return;
    }

    try {
        const response = await fetch(`${apiBase}/api/problems`);
        if (!response.ok) {
            throw new Error("Unable to load problems");
        }
        const problems = await response.json();
        renderProblems(problems);
    } catch (error) {
        renderProblems(readStoredProblems());
    }
}

if (problemForm) {
    problemForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        formStatus.textContent = "Saving...";
        const payload = Object.fromEntries(new FormData(problemForm).entries());

        if (!canUseApi) {
            const problems = readStoredProblems();
            problems.unshift({
                id: String(Date.now()),
                patient_name: payload.patient_name,
                contact: payload.contact,
                problem: payload.problem,
                reply: "",
                created_at: formatDate()
            });
            saveStoredProblems(problems);
            problemForm.reset();
            formStatus.textContent = "Problem saved successfully.";
            await loadProblems();
            return;
        }

        try {
            const response = await fetch(`${apiBase}/api/problems`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error("Unable to save problem");
            }
            problemForm.reset();
            formStatus.textContent = "Problem saved successfully.";
            await loadProblems();
        } catch (error) {
            const problems = readStoredProblems();
            problems.unshift({
                id: String(Date.now()),
                patient_name: payload.patient_name,
                contact: payload.contact,
                problem: payload.problem,
                reply: "",
                created_at: formatDate()
            });
            saveStoredProblems(problems);
            problemForm.reset();
            formStatus.textContent = "Problem saved in this browser.";
            await loadProblems();
        }
    });
}

if (problemList) {
    problemList.addEventListener("submit", async (event) => {
        const replyForm = event.target.closest(".reply-form");
        const deleteForm = event.target.closest(".delete-form");

        event.preventDefault();
        const card = event.target.closest(".problem-card");
        const id = card?.dataset.id;

        if (deleteForm) {
            const pin = new FormData(deleteForm).get("pin");

            if (!canUseApi) {
                if (pin !== adminPin) {
                    alert("Could not delete chat. Please check the PIN.");
                    return;
                }
                saveStoredProblems(readStoredProblems().filter((item) => String(item.id) !== String(id)));
                await loadProblems();
                return;
            }

            try {
                const response = await fetch(`${apiBase}/api/problems/${id}/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pin })
                });
                if (!response.ok) {
                    throw new Error("Unable to delete chat");
                }
                await loadProblems();
            } catch (error) {
                alert("Could not delete chat. Please check the PIN and make sure the local database server is running.");
            }
            return;
        }

        if (!replyForm) {
            return;
        }

        const formData = new FormData(replyForm);
        const reply = formData.get("reply");
        const pin = formData.get("pin");

        if (!canUseApi) {
            if (pin !== adminPin) {
                alert("Could not save reply. Please check the PIN.");
                return;
            }
            const problems = readStoredProblems().map((item) => (
                String(item.id) === String(id) ? { ...item, reply } : item
            ));
            saveStoredProblems(problems);
            await loadProblems();
            return;
        }

        try {
            const response = await fetch(`${apiBase}/api/problems/${id}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reply, pin })
            });
            if (!response.ok) {
                throw new Error("Unable to save reply");
            }
            await loadProblems();
        } catch (error) {
            alert("Could not save reply. Please check the PIN and make sure the local database server is running.");
        }
    });
}

if (refreshProblems) {
    refreshProblems.addEventListener("click", loadProblems);
}

loadProblems();
