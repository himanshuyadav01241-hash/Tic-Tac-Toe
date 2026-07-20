import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, onValue, update, push, remove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
// Replace with your Firebase config values
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
const bgMusic = document.getElementById('bg-music');

// --- GAME STATE VARIABLES ---
let currentUser = null;
let currentRoomCode = null;
let playerRole = null; // 'p1' (Host) or 'p2' (Guest)
let isMyTurn = false;
let gameBoard = Array(9).fill("");
let isMusicPlaying = false;

const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        usernameInput.value = user.displayName || 'Player';
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        userNameDisplay.textContent = user.displayName || 'Player';
        
        userProfileBar.classList.remove('hidden');
        googleLoginBtn.classList.add('signed-in');
        googleLoginBtn.innerHTML = `✓ Connected as ${user.displayName.split(' ')[0]}`;

        // Sync stats with Database
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        if (!snap.exists()) {
            await set(userRef, { name: user.displayName, wins: 0 });
            userStatsDisplay.textContent = "Wins: 0";
        } else {
            userStatsDisplay.textContent = `Wins: ${snap.val().wins || 0}`;
        }
    } else {
        currentUser = null;
        userProfileBar.classList.add('hidden');
        googleLoginBtn.classList.remove('signed-in');
        googleLoginBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="Google"> Link Account with Google`;
    }
});

googleLoginBtn.addEventListener('click', () => {
    if (!currentUser) signInWithPopup(auth, googleProvider).catch(console.error);
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- ROOM CREATION & JOINING ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

createRoomBtn.addEventListener('click', async () => {
    const playerName = usernameInput.value.trim() || 'Host';
    currentRoomCode = generateRoomCode();
    playerRole = 'p1';

    const roomRef = ref(db, `rooms/${currentRoomCode}`);
    await set(roomRef, {
        p1: { name: playerName, score: 0 },
        p2: { name: 'Waiting...', score: 0 },
        board: Array(9).fill(""),
        turn: 'p1',
        status: 'waiting'
    });

    lobbyInteractiveSection.classList.add('hidden');
    roomWaitBox.classList.remove('hidden');
    roomCodeDisplay.textContent = currentRoomCode;

    listenToRoomUpdates(currentRoomCode);
});

joinCodeBtn.addEventListener('click', async () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    const playerName = usernameInput.value.trim() || 'Guest';

    if (!code) return alert("Please enter a room code!");

    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
        return alert("Room code not found!");
    }

    const data = snapshot.val();
    if (data.status !== 'waiting' && data.p2.name !== 'Waiting...') {
        return alert("Room is already full!");
    }

    currentRoomCode = code;
    playerRole = 'p2';

    await update(ref(db, `rooms/${code}/p2`), { name: playerName });
    await update(ref(db, `rooms/${code}`), { status: 'playing' });

    joinOverlay.classList.add('hidden');
    listenToRoomUpdates(code);
});

// --- GAME LOGIC & SYNC ---
function listenToRoomUpdates(code) {
    const roomRef = ref(db, `rooms/${code}`);

    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // UI Updates
        p1Name.textContent = data.p1.name;
        p1Score.textContent = data.p1.score;
        p2Name.textContent = data.p2.name;
        p2Score.textContent = data.p2.score;

        gameBoard = data.board || Array(9).fill("");
        renderBoard();

        if (data.status === 'waiting') {
            statusText.textContent = "Waiting for opponent to join...";
            boardElement.classList.add('disabled');
        } else if (data.status === 'playing') {
            joinOverlay.classList.add('hidden');
            activeRoomBadge.classList.remove('hidden');
            gameRoomCode.textContent = `ROOM: ${currentRoomCode}`;
            chatBox.classList.remove('hidden');
            leaveRoomBtn.classList.remove('hidden');

            isMyTurn = (data.turn === playerRole);

            if (isMyTurn) {
                statusText.textContent = "Your Turn!";
                boardElement.classList.remove('disabled');
            } else {
                statusText.textContent = `${data[data.turn].name}'s Turn...`;
                boardElement.classList.add('disabled');
            }

            p1Box.classList.toggle('active-turn', data.turn === 'p1');
            p2Box.classList.toggle('active-turn', data.turn === 'p2');
        } else if (data.status === 'ended') {
            boardElement.classList.add('disabled');
            p1Box.classList.remove('active-turn');
            p2Box.classList.remove('active-turn');

            if (data.winner === 'draw') {
                statusText.textContent = "It's a Draw! 🤝";
            } else {
                const winnerName = data[data.winner].name;
                statusText.textContent = `${winnerName} Wins! 🎉`;
            }

            if (playerRole === 'p1') {
                rematchBtn.classList.remove('hidden');
            }
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
            await update(roomRef, {
                board: gameBoard,
                status: 'ended',
                winner: winnerKey
            });

            if (currentUser) {
                const userRef = ref(db, `users/${currentUser.uid}`);
                const snap = await get(userRef);
                const wins = (snap.val()?.wins || 0) + 1;
                await update(userRef, { wins });
                userStatsDisplay.textContent = `Wins: ${wins}`;
            }
        } else if (winState.isDraw) {
            await update(roomRef, {
                board: gameBoard,
                status: 'ended',
                winner: 'draw'
            });
        } else {
            const nextTurn = playerRole === 'p1' ? 'p2' : 'p1';
            await update(roomRef, {
                board: gameBoard,
                turn: nextTurn
            });
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
    const isDraw = gameBoard.every(cell => cell !== "");
    return { hasWinner: false, isDraw };
}

// Rematch (Host Only)
rematchBtn.addEventListener('click', async () => {
    rematchBtn.classList.add('hidden');
    await update(ref(db, `rooms/${currentRoomCode}`), {
        board: Array(9).fill(""),
        turn: 'p1',
        status: 'playing'
    });
});

// Leave Room
leaveRoomBtn.addEventListener('click', () => {
    location.reload();
});

// --- CHAT LOGIC ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg || !currentRoomCode) return;

    const senderName = usernameInput.value.trim() || 'Player';
    const chatRef = ref(db, `chats/${currentRoomCode}`);

    await push(chatRef, {
        sender: senderName,
        role: playerRole,
        text: msg,
        timestamp: Date.now()
    });

    chatInput.value = '';
});

function listenToChat(code) {
    const chatRef = ref(db, `chats/${code}`);
    onValue(chatRef, (snapshot) => {
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

toggleChatBtn.addEventListener('click', () => chatBox.classList.remove('hidden'));
closeChatBtn.addEventListener('click', () => chatBox.classList.add('hidden'));

// --- LEADERBOARD LOGIC (#1 OWNER DISPLAY) ---
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        if (leaderboardModal) leaderboardModal.classList.remove('hidden');
        if (leaderboardList) leaderboardList.innerHTML = 'Loading leaderboard...';

        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);

        let users = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const val = child.val();
                if (!currentUser || child.key !== currentUser.uid) {
                    users.push({
                        uid: child.key,
                        name: val.name || 'Anonymous',
                        wins: val.wins || 0
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

        html += users.slice(0, 9).map((u, i) => `
            <div class="lb-row">
                <span>#${i + 2} ${u.name}</span>
                <span class="lb-score">🏆 ${u.wins} Wins</span>
            </div>
        `).join('');

        if (leaderboardList) {
            leaderboardList.innerHTML = html;
        }
    });
}

if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => leaderboardModal.classList.add('hidden'));
}

// --- MUSIC TOGGLE ---
musicToggleBtn.addEventListener('click', () => {
    if (isMusicPlaying) {
        bgMusic.pause();
        musicToggleBtn.textContent = '🎵';
    } else {
        bgMusic.play().catch(console.error);
        musicToggleBtn.textContent = '🔊';
    }
    isMusicPlaying = !isMusicPlaying;
});

// Copy Code Buttons
copyLinkBtn.addEventListener('click', () => navigator.clipboard.writeText(currentRoomCode));
copyGameLink.addEventListener('click', () => navigator.clipboard.writeText(currentRoomCode));
