import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, onValue, update, push 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ⚠️ STEP 1: Replace these values with your actual Firebase Console details!
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// --- DOM ELEMENTS ---
const joinOverlay = document.getElementById('join-overlay');
const usernameInput = document.getElementById('username-input');
const googleLoginBtn = document.getElementById('google-login-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinCodeBtn = document.getElementById('join-code-btn');
const roomWaitBox = document.getElementById('room-wait-box');
const lobbyInteractiveSection = document.getElementById('lobby-interactive-section');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');

const userProfileBar = document.getElementById('user-profile-bar');
const userAvatar = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');
const userStatsDisplay = document.getElementById('user-stats-display');
const logoutBtn = document.getElementById('logout-btn');

const statusText = document.getElementById('status-text');
const activeRoomBadge = document.getElementById('active-room-badge');
const gameRoomCode = document.getElementById('game-room-code');
const copyGameLink = document.getElementById('copy-game-link');

const p1Name = document.getElementById('p1-name');
const p1Score = document.getElementById('p1-score');
const p1Box = document.getElementById('p1-box');

const p2Name = document.getElementById('p2-name');
const p2Score = document.getElementById('p2-score');
const p2Box = document.getElementById('p2-box');

const boardElement = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const rematchBtn = document.getElementById('rematch-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const chatBox = document.getElementById('chat-box');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');

const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const musicToggleBtn = document.getElementById('music-toggle-btn');

// --- STATE VARIABLES ---
let currentUser = null;
let currentRoomCode = null;
let playerRole = null;
let isMyTurn = false;
let gameBoard = Array(9).fill("");

const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// --- MODERN TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = 'error', icon = '⚠️') {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast) return;

    toastMsg.textContent = message;
    toastIcon.textContent = icon;
    toast.className = `toast ${type}`;

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// --- PROCEDURAL AUDIO SYNTHESIZER (NO MP3 FILE NEEDED) ---
let audioCtx = null;
let musicInterval = null;
let isMusicPlaying = false;

function startProceduralMusic() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00]; // C4 Melody
    let noteIdx = 0;

    musicInterval = setInterval(() => {
        if (!isMusicPlaying) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[noteIdx % notes.length], audioCtx.currentTime);

        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);

        noteIdx++;
    }, 400);
}

function stopProceduralMusic() {
    if (musicInterval) clearInterval(musicInterval);
}

if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', () => {
        if (isMusicPlaying) {
            stopProceduralMusic();
            musicToggleBtn.textContent = '🎵';
            isMusicPlaying = false;
            showToast("Music Paused", "info", "🎵");
        } else {
            isMusicPlaying = true;
            startProceduralMusic();
            musicToggleBtn.textContent = '🔊';
            showToast("Playing Synth Background Music", "success", "🔊");
        }
    });
}

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (usernameInput) usernameInput.value = user.displayName || 'Player';
        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        if (userNameDisplay) userNameDisplay.textContent = user.displayName || 'Player';
        
        if (userProfileBar) userProfileBar.classList.remove('hidden');
        if (googleLoginBtn) {
            googleLoginBtn.classList.add('signed-in');
            googleLoginBtn.innerHTML = `✓ ${user.displayName ? user.displayName.split(' ')[0] : 'Connected'}`;
        }

        try {
            const userRef = ref(db, `users/${user.uid}`);
            const snap = await get(userRef);
            if (!snap.exists()) {
                await set(userRef, { name: user.displayName || 'Player', wins: 0 });
                if (userStatsDisplay) userStatsDisplay.textContent = "Wins: 0";
            } else {
                if (userStatsDisplay) userStatsDisplay.textContent = `Wins: ${snap.val().wins || 0}`;
            }
        } catch (err) {
            console.error("User data fetch error:", err);
        }
    } else {
        currentUser = null;
        if (userProfileBar) userProfileBar.classList.add('hidden');
        if (googleLoginBtn) {
            googleLoginBtn.classList.remove('signed-in');
            googleLoginBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="Google"> Link Account with Google`;
        }
    }
});

if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        if (!currentUser) {
            try {
                await signInWithPopup(auth, googleProvider);
                showToast("Logged in successfully!", "success", "✅");
            } catch (error) {
                console.error(error);
                if (error.code === 'auth/api-key-not-valid') {
                    showToast("Invalid Firebase API Key! Update app.js config.", "error", "🔑");
                } else {
                    showToast(error.message, "error", "🚫");
                }
            }
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => location.reload()).catch(console.error);
    });
}

// --- ROOM & MATCHMAKING LOGIC ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', async () => {
        const playerName = usernameInput ? (usernameInput.value.trim() || 'Host') : 'Host';
        currentRoomCode = generateRoomCode();
        playerRole = 'p1';

        try {
            const roomRef = ref(db, `rooms/${currentRoomCode}`);
            await set(roomRef, {
                p1: { name: playerName, score: 0 },
                p2: { name: 'Waiting...', score: 0 },
                board: Array(9).fill(""),
                turn: 'p1',
                status: 'waiting'
            });

            if (lobbyInteractiveSection) lobbyInteractiveSection.classList.add('hidden');
            if (roomWaitBox) roomWaitBox.classList.remove('hidden');
            if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;

            listenToRoomUpdates(currentRoomCode);
        } catch (err) {
            showToast("Database error! Check your Firebase rules.", "error", "⚠️");
        }
    });
}

if (joinCodeBtn) {
    joinCodeBtn.addEventListener('click', async () => {
        const code = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';
        const playerName = usernameInput ? (usernameInput.value.trim() || 'Guest') : 'Guest';

        if (!code) return showToast("Please enter a 6-digit room code!", "error", "✏️");

        try {
            const roomRef = ref(db, `rooms/${code}`);
            const snapshot = await get(roomRef);

            if (!snapshot.exists()) return showToast("Room code not found!", "error", "🔍");

            const data = snapshot.val();
            if (data.status !== 'waiting' && data.p2.name !== 'Waiting...') {
                return showToast("Room is full!", "error", "🚫");
            }

            currentRoomCode = code;
            playerRole = 'p2';

            await update(ref(db, `rooms/${code}/p2`), { name: playerName });
            await update(ref(db, `rooms/${code}`), { status: 'playing' });

            if (joinOverlay) joinOverlay.classList.add('hidden');
            listenToRoomUpdates(code);
        } catch (err) {
            showToast("Could not join room. Check connection.", "error", "⚠️");
        }
    });
}

function listenToRoomUpdates(code) {
    const roomRef = ref(db, `rooms/${code}`);

    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (p1Name) p1Name.textContent = data.p1.name;
        if (p1Score) p1Score.textContent = data.p1.score;
        if (p2Name) p2Name.textContent = data.p2.name;
        if (p2Score) p2Score.textContent = data.p2.score;

        gameBoard = data.board || Array(9).fill("");
        renderBoard();

        if (data.status === 'waiting') {
            if (statusText) statusText.textContent = "Waiting for opponent...";
            if (boardElement) boardElement.classList.add('disabled');
        } else if (data.status === 'playing') {
            if (joinOverlay) joinOverlay.classList.add('hidden');
            if (activeRoomBadge) activeRoomBadge.classList.remove('hidden');
            if (gameRoomCode) gameRoomCode.textContent = `ROOM: ${currentRoomCode}`;
            if (chatBox) chatBox.classList.remove('hidden');
            if (leaveRoomBtn) leaveRoomBtn.classList.remove('hidden');

            isMyTurn = (data.turn === playerRole);

            if (isMyTurn) {
                if (statusText) statusText.textContent = "Your Turn!";
                if (boardElement) boardElement.classList.remove('disabled');
            } else {
                if (statusText) statusText.textContent = `${data[data.turn].name}'s Turn...`;
                if (boardElement) boardElement.classList.add('disabled');
            }

            if (p1Box) p1Box.classList.toggle('active-turn', data.turn === 'p1');
            if (p2Box) p2Box.classList.toggle('active-turn', data.turn === 'p2');
        } else if (data.status === 'ended') {
            if (boardElement) boardElement.classList.add('disabled');
            if (p1Box) p1Box.classList.remove('active-turn');
            if (p2Box) p2Box.classList.remove('active-turn');

            if (data.winner === 'draw') {
                if (statusText) statusText.textContent = "It's a Draw! 🤝";
            } else {
                const winnerName = data[data.winner].name;
                if (statusText) statusText.textContent = `${winnerName} Wins! 🎉`;
            }

            if (playerRole === 'p1' && rematchBtn) rematchBtn.classList.remove('hidden');
        }
    });

    listenToChat(code);
}

function renderBoard() {
    cells.forEach((cell, index) => {
        const value = gameBoard[index];
        cell.textContent = value === 'X' ? '❌' : value === 'O' ? '⭕' : '';
    });
}

cells.forEach((cell, index) => {
    cell.addEventListener('click', async () => {
        if (!isMyTurn || gameBoard[index] !== "") return;

        const symbol = playerRole === 'p1' ? 'X' : 'O';
        gameBoard[index] = symbol;

        const winState = checkWinner();
        const roomRef = ref(db, `rooms/${currentRoomCode}`);

        if (winState.hasWinner) {
            const winnerKey = playerRole;
            const currentScore = playerRole === 'p1' ? parseInt(p1Score.textContent) : parseInt(p2Score.textContent);

            await update(ref(db, `rooms/${currentRoomCode}/${winnerKey}`), { score: currentScore + 1 });
            await update(roomRef, { board: gameBoard, status: 'ended', winner: winnerKey });

            if (currentUser) {
                const userRef = ref(db, `users/${currentUser.uid}`);
                const snap = await get(userRef);
                const wins = (snap.val()?.wins || 0) + 1;
                await update(userRef, { wins });
                if (userStatsDisplay) userStatsDisplay.textContent = `Wins: ${wins}`;
            }
        } else if (winState.isDraw) {
            await update(roomRef, { board: gameBoard, status: 'ended', winner: 'draw' });
        } else {
            const nextTurn = playerRole === 'p1' ? 'p2' : 'p1';
            await update(roomRef, { board: gameBoard, turn: nextTurn });
        }
    });
});

function checkWinner() {
    for (let combo of WINNING_COMBOS) {
        const [a, b, c] = combo;
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
            return { hasWinner: true, isDraw: false };
        }
    }
    return { hasWinner: false, isDraw: gameBoard.every(cell => cell !== "") };
}

if (rematchBtn) {
    rematchBtn.addEventListener('click', async () => {
        rematchBtn.classList.add('hidden');
        await update(ref(db, `rooms/${currentRoomCode}`), {
            board: Array(9).fill(""),
            turn: 'p1',
            status: 'playing'
        });
    });
}

if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', () => location.reload());

// --- CHAT SYSTEM ---
if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = chatInput ? chatInput.value.trim() : '';
        if (!msg || !currentRoomCode) return;

        const senderName = usernameInput ? (usernameInput.value.trim() || 'Player') : 'Player';
        await push(ref(db, `chats/${currentRoomCode}`), {
            sender: senderName, role: playerRole, text: msg, timestamp: Date.now()
        });

        if (chatInput) chatInput.value = '';
    });
}

function listenToChat(code) {
    onValue(ref(db, `chats/${code}`), (snapshot) => {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        if (!snapshot.exists()) return;

        snapshot.forEach((child) => {
            const data = child.val();
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('chat-msg');
            if (data.role === playerRole) msgDiv.classList.add('my-msg');
            msgDiv.innerHTML = `<strong>${data.sender}:</strong> ${data.text}`;
            chatMessages.appendChild(msgDiv);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

if (toggleChatBtn && chatBox) toggleChatBtn.addEventListener('click', () => chatBox.classList.remove('hidden'));
if (closeChatBtn && chatBox) closeChatBtn.addEventListener('click', () => chatBox.classList.add('hidden'));

// --- LEADERBOARD ---
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        if (leaderboardModal) leaderboardModal.classList.remove('hidden');
        if (leaderboardList) leaderboardList.innerHTML = '<div style="padding:10px;">Fetching Top Players...</div>';

        try {
            const snapshot = await get(ref(db, 'users'));
            let users = [];

            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const val = child.val();
                    if (val && typeof val === 'object') {
                        users.push({ 
                            uid: child.key, 
                            name: val.name || 'Anonymous', 
                            wins: typeof val.wins === 'number' ? val.wins : 0 
                        });
                    }
                });
            }

            users.sort((a, b) => b.wins - a.wins);

            const ownerName = currentUser ? currentUser.displayName : "Himanshu Yadav";

            let html = `
                <div class="lb-row owner-row">
                    <span class="owner-name">#1 👑 ${ownerName}</span>
                    <span class="owner-score">Owner</span>
                </div>
            `;

            if (users.length === 0) {
                html += `<div style="padding:10px; font-size:0.8rem; color:#64748b;">No rank history found yet! Play a match to get listed.</div>`;
            } else {
                html += users.slice(0, 8).map((u, i) => `
                    <div class="lb-row">
                        <span>#${i + 2} ${u.name}</span>
                        <span class="lb-score">🏆 ${u.wins} Wins</span>
                    </div>
                `).join('');
            }

            if (leaderboardList) leaderboardList.innerHTML = html;
        } catch (err) {
            showToast("Failed to load leaderboard.", "error", "🏆");
        }
    });
}

if (closeLeaderboardBtn && leaderboardModal) {
    closeLeaderboardBtn.addEventListener('click', () => leaderboardModal.classList.add('hidden'));
}

// --- COPY CODE BUTTONS ---
if (copyLinkBtn) copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomCode);
    showToast("Room code copied!", "success", "📋");
});

if (copyGameLink) copyGameLink.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomCode);
    showToast("Room code copied!", "success", "📋");
});
