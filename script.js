/*
    /c:/github-personal/DnD-coplay/script.js

    Minimal client-side handler for:
    - sending player input to the Hugging Face Inference API
    - receiving the model reply
    - rendering text in the story window
    - managing simple state (turns, history)

    Replace HF_API_KEY and MODEL with your values.
*/

/* Configuration */
const HF_API_KEY = 'REPLACE_WITH_YOUR_HF_API_KEY';
const MODEL = 'REPLACE_WITH_YOUR_MODEL'; // e.g. "gpt2" or "meta-llama/Llama-2-7b-chat" (use an appropriate hosted model)
const HF_TIMEOUT_MS = 30000;
const MAX_HISTORY_TURNS = 8;

/* Simple state */
const state = {
    turn: 0,
    history: [], // { role: 'player'|'dm', text: '...' , turn: n }
    pending: false
};

/* DOM refs (assumes elements exist in your HTML) */
const storyWindow = document.getElementById('storyWindow'); // e.g. a div
const inputField = document.getElementById('playerInput'); // e.g. a textarea or input
const sendButton = document.getElementById('sendButton');  // e.g. a button

/* Utilities */
function addHistory(role, text) {
    state.history.push({ role, text, turn: state.turn });
    // keep history bounded
    if (state.history.length > MAX_HISTORY_TURNS * 2) {
        state.history.splice(0, state.history.length - MAX_HISTORY_TURNS * 2);
    }
}

function renderStory() {
    if (!storyWindow) return;
    storyWindow.innerHTML = '';
    state.history.forEach(entry => {
        const p = document.createElement('p');
        p.className = entry.role === 'player' ? 'entry-player' : 'entry-dm';
        p.textContent = `${entry.role === 'player' ? 'Player' : 'DM'}: ${entry.text}`;
        storyWindow.appendChild(p);
    });
    // scroll to bottom
    storyWindow.scrollTop = storyWindow.scrollHeight;
}

/* Build a prompt from recent history */
function buildPromptForModel() {
    // join last N turns into a prompt, label roles for clarity
    const relevant = state.history.slice(-MAX_HISTORY_TURNS * 2);
    const lines = relevant.map(e => (e.role === 'player' ? `Player: ${e.text}` : `DM: ${e.text}`));
    // The model prompt asks DM to continue the story in a roleplaying style
    lines.push('DM:');
    return lines.join('\n') + '\n';
}

/* Call Hugging Face Inference API */
async function callHuggingFace(prompt, options = {}) {
    const url = `https://api-inference.huggingface.co/models/${MODEL}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

    const body = {
        inputs: prompt,
        parameters: {
            max_new_tokens: options.max_new_tokens || 150,
            temperature: options.temperature ?? 0.8,
            top_k: options.top_k ?? 50,
            top_p: options.top_p ?? 0.95
        },
        // options: { wait_for_model: true } // can be added if needed
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(id);
        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`HF API error: ${res.status} ${res.statusText} ${errText}`);
        }
        const data = await res.json();

        // Response formats vary by model / endpoint:
        // - some models return [{ generated_text: "..." }]
        // - some return { error: "..." } on failure
        // - some return plain text (rare when JSON expected)
        if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
            return data[0].generated_text;
        }
        if (data.generated_text) {
            return data.generated_text;
        }
        // fallback: try to stringify or return a best-effort
        if (typeof data === 'string') return data;
        return JSON.stringify(data);
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('Request timed out');
        throw err;
    }
}

/* Main flow: send player input, get model reply, update UI/state */
async function sendPlayerInput() {
    if (state.pending) return;
    if (!inputField) return;
    const text = inputField.value.trim();
    if (!text) return;

    // Record player turn immediately
    addHistory('player', text);
    renderStory();

    // prepare state
    state.pending = true;
    sendButton.disabled = true;
    inputField.value = '';
    // Optionally show a typing indicator
    addHistory('dm', '...'); // placeholder for pending reply
    renderStory();

    try {
        const prompt = buildPromptForModel();
        const replyRaw = await callHuggingFace(prompt, { max_new_tokens: 200, temperature: 0.9 });
        // Remove the placeholder '...' last DM entry and replace with actual
        // Find last DM placeholder at same turn
        const lastIndex = state.history.map(h => h.role).lastIndexOf('dm');
        if (lastIndex >= 0 && state.history[lastIndex].text === '...') {
            state.history.splice(lastIndex, 1); // remove placeholder
        }
        addHistory('dm', replyRaw.trim());
        state.turn += 1;
        renderStory();
    } catch (err) {
        // Replace placeholder with error message
        const lastIndex = state.history.map(h => h.role).lastIndexOf('dm');
        if (lastIndex >= 0 && state.history[lastIndex].text === '...') {
            state.history.splice(lastIndex, 1);
        }
        addHistory('dm', `Error: ${err.message}`);
        renderStory();
    } finally {
        state.pending = false;
        if (sendButton) sendButton.disabled = false;
    }
}

/* Wire UI events */
function initUI() {
    if (sendButton) {
        sendButton.addEventListener('click', sendPlayerInput);
    }
    if (inputField) {
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendPlayerInput();
            }
        });
    }
}

/* Initialize */
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    // optional: seed game start
    addHistory('dm', 'You awaken in a dim tavern. The hearth glows; a stranger beckons. What do you do?');
    renderStory();
});