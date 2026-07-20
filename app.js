import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    onValue, 
    update, 
    push, 
    remove, 
    serverTimestamp, 
    query, 
    orderByChild, 
    limitToLast 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// --- DOM ELEMENTS ---
const joinOverlay = document.getElementById('join-overlay');
const gameContainer = document.getElementById('game-container');
const usernameInput = document.getElementById('username-input');
const googleLoginBtn = document.getElementById('google-login-btn');
const signedInBadge = document.getElementById('signed-in-badge');
const createRoomBtn = document.getElementById('create-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinCodeBtn = document.getElementById('join-code-btn');
const roomWaitBox = document.getElementById('room-wait-box');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');

const userProfileBar = document.getElementById('user-profile-bar');
const userAvatar = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');
const userStatsDisplay = document.getElementById('user-stats-display');
const logoutBtn = document.getElementById('logout-btn');

const gameRoomCode = document.getElementById('game-room-code');
const activeRoomBadge = document.getElementById('active-room-badge');
const copyGameLinkBtn = document.getElementById('copy-game-link');

const statusText = document.getElementById('status-text');
const p1Name = document.getElementById('p1-name');
const p2Name = document.getElementById('p2-name');
const p1Score = document.getElementById('p1-score');
const p2Score = document.getElementById('p2-score');
const p1Box = document.getElementById('p1-box');
const p2Box = document.getElementById('p2-box');

const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const rematchBtn = document.getElementById('rematch-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const musicToggleBtn = document.getElementById('music-toggle-btn');
const bgMusic = document.getElementById('bg-music');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');

const manageProfileModal = document.getElementById('manage-profile-modal');
const profileModalAvatar = document.getElementById('profile-modal-avatar');
const profileNameInput = document.getElementById('profile-name-input');
const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');

const chatBox = document.getElementById('chat-box');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');

// --- GAME STATE ---
let currentUser = null;
let currentRoomCode = null;
let playerSymbol = null;
let isHost = false;
let roomUnsubscribe = null;

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        usernameInput.value = user.displayName || "Player";
        usernameInput.readOnly = true;
        googleLoginBtn.classList.add('hidden');
        signedInBadge.classList.remove('hidden');

        userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        userNameDisplay.textContent = user.displayName || "Player";
        userProfileBar.classList.remove('hidden');

        await syncUserData(user);
    } else {
        currentUser = null;
        usernameInput.value = "";
        usernameInput.readOnly = false;
        googleLoginBtn.classList.remove('hidden');
        signedInBadge.classList.add('hidden');
        userProfileBar.classList.add('hidden');
    }
});

googleLoginBtn.addEventListener('click', () => {
    signInWithPopup(auth, googleProvider).catch((err) => console.error("Login failed:", err));
});

logoutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    signOut(auth);
});

async function syncUserData(user) {
    const userRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
        await set(userRef, {
            name: user.displayName || "Player",
            email: user.email,
            wins: 0,
            avatar: user.photoURL || 'https://via.placeholder.com/32'
        });
        userStatsDisplay.textContent = "Wins: 0";
    } else {
        const data = snapshot.val();
        userStatsDisplay.textContent = `Wins: ${data.wins || 0}`;
    }
}

// --- ROOM CREATION & JOINING ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPlayerName() {
    return usernameInput.value.trim() || "Guest_" + Math.floor(1000 + Math.random() * 9000);
}

createRoomBtn.addEventListener('click', async () => {
    const name = getPlayerName();
    currentRoomCode = generateRoomCode();
    isHost = true;
    playerSymbol = 'X';

    const roomRef = ref(db, `rooms/${currentRoomCode}`);
    await set(roomRef, {
        hostName: name,
        hostScore: 0,
        guestName: "",
        guestScore: 0,
        board: Array(9).fill(""),
        turn: 'X',
        status: 'waiting',
        winner: "",
        createdAt: serverTimestamp()
    });

    roomWaitBox.classList.remove('hidden');
    roomCodeDisplay.textContent = currentRoomCode;
    listenToRoom(currentRoomCode);
});

joinCodeBtn.addEventListener('click', async () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 6) return alert("Please enter a valid 6-character Room Code.");

    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return alert("Room not found!");
    const room = snapshot.val();

    if (room.guestName && room.guestName !== "") {
        return alert("Room is already full!");
    }

    currentRoomCode = code;
    isHost = false;
    playerSymbol = 'O';

    await update(roomRef, {
        guestName: getPlayerName(),
        status: 'active'
    });

    listenToRoom(currentRoomCode);
});

function listenToRoom(code) {
    const roomRef = ref(db, `rooms/${code}`);
    
    if (roomUnsubscribe) roomUnsubscribe();

    roomUnsubscribe = onValue(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
            alert("Room closed by host.");
            leaveRoom();
            return;
        }

        const room = snapshot.val();
        updateGameUI(room);
    });

    listenToChat(code);
}

// --- GAME UI UPDATE ---
function updateGameUI(room) {
    // Hide the lobby overlay & display the main game board
    joinOverlay.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    gameRoomCode.textContent = `ROOM: ${currentRoomCode}`;
    activeRoomBadge.classList.remove('hidden');

    p1Name.textContent = room.hostName || "Host";
    p2Name.textContent = room.guestName || "Waiting...";
    p1Score.textContent = room.hostScore || 0;
    p2Score.textContent = room.guestScore || 0;

    // Board Render
    room.board.forEach((val, idx) => {
        cells[idx].textContent = val;
    });

    // Game state rules
    if (room.status === 'waiting') {
        statusText.textContent = "Waiting for an opponent to join...";
        board.classList.add('disabled');
    } else if (room.status === 'active') {
        board.classList.remove('disabled');
        rematchBtn.classList.add('hidden');
        leaveRoomBtn.classList.remove('hidden');
        toggleChatBtn.classList.remove('hidden');
        chatBox.classList.remove('hidden');

        if (room.turn === playerSymbol) {
            statusText.textContent = "Your Turn! (" + playerSymbol + ")";
        } else {
            statusText.textContent = (room.turn === 'X' ? room.hostName : room.guestName) + "'s Turn...";
        }

        if (room.turn === 'X') {
            p1Box.classList.add('active-turn');
            p2Box.classList.remove('active-turn');
        } else {
            p2Box.classList.add('active-turn');
            p1Box.classList.remove('active-turn');
        }
    } else if (room.status === 'finished') {
        board.classList.add('disabled');
        p1Box.classList.remove('active-turn');
        p2Box.classList.remove('active-turn');

        if (room.winner === 'draw') {
            statusText.textContent = "It's a Draw! 🤝";
        } else {
            const winnerName = room.winner === 'X' ? room.hostName : room.guestName;
            statusText.textContent = `${winnerName} Wins! 🎉`;
        }

        if (isHost) rematchBtn.classList.remove('hidden');
    }
}

// --- GAMEPLAY CLICKS ---
cells.forEach((cell) => {
    cell.addEventListener('click', async () => {
        const index = cell.dataset.index;
        const roomRef = ref(db, `rooms/${currentRoomCode}`);
        const snapshot = await get(roomRef);
        
        if (!snapshot.exists()) return;
        const room = snapshot.val();

        if (room.status !== 'active' || room.turn !== playerSymbol || room.board[index] !== "") {
            return;
        }

        const newBoard = [...room.board];
        newBoard[index] = playerSymbol;

        const winner = checkWinner(newBoard);
        let updates = { board: newBoard };

        if (winner) {
            updates.status = 'finished';
            updates.winner = winner;
            if (winner === 'X') {
                updates.hostScore = (room.hostScore || 0) + 1;
                if (isHost && currentUser) incrementWins(currentUser.uid);
            } else if (winner === 'O') {
                updates.guestScore = (room.guestScore || 0) + 1;
                if (!isHost && currentUser) incrementWins(currentUser.uid);
            }
        } else if (newBoard.every(cell => cell !== "")) {
            updates.status = 'finished';
            updates.winner = 'draw';
        } else {
            updates.turn = playerSymbol === 'X' ? 'O' : 'X';
        }

        await update(roomRef, updates);
    });
});

function checkWinner(b) {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];
    for (let [a, bIdx, c] of lines) {
        if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return b[a];
    }
    return null;
}

async function incrementWins(uid) {
    const userRef = ref(db, `users/${uid}/wins`);
    const snapshot = await get(userRef);
    const currentWins = snapshot.val() || 0;
    await set(userRef, currentWins + 1);
    userStatsDisplay.textContent = `Wins: ${currentWins + 1}`;
}

// --- REMATCH & LEAVE ---
rematchBtn.addEventListener('click', async () => {
    if (!isHost) return;
    const roomRef = ref(db, `rooms/${currentRoomCode}`);
    await update(roomRef, {
        board: Array(9).fill(""),
        turn: 'X',
        status: 'active',
        winner: ""
    });
});

function leaveRoom() {
    if (currentRoomCode && isHost) {
        remove(ref(db, `rooms/${currentRoomCode}`));
    }
    location.reload();
}

leaveRoomBtn.addEventListener('click', leaveRoom);

// --- CHAT SYSTEM ---
function listenToChat(code) {
    const chatRef = ref(db, `chats/${code}`);
    onValue(chatRef, (snapshot) => {
        chatMessages.innerHTML = "";
        if (!snapshot.exists()) return;

        snapshot.forEach((child) => {
            const msg = child.val();
            const msgDiv = document.createElement('div');
            const isMe = msg.sender === getPlayerName();
            msgDiv.className = `chat-msg ${isMe ? 'my-msg' : ''}`;
            msgDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
            chatMessages.appendChild(msgDiv);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !currentRoomCode) return;

    const chatRef = ref(db, `chats/${currentRoomCode}`);
    await push(chatRef, {
        sender: getPlayerName(),
        text: text,
        timestamp: serverTimestamp()
    });

    chatInput.value = "";
});

if (toggleChatBtn) {
    toggleChatBtn.addEventListener('click', () => {
        chatBox.classList.add('active');
    });
}

if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
        chatBox.classList.remove('active');
    });
}

// --- LEADERBOARD ---
leaderboardBtn.addEventListener('click', async () => {
    leaderboardModal.classList.remove('hidden');
    leaderboardList.innerHTML = "Loading...";

    const usersRef = query(ref(db, 'users'), orderByChild('wins'), limitToLast(10));
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
        leaderboardList.innerHTML = "No records found.";
        return;
    }

    let users = [];
    snapshot.forEach((child) => users.push(child.val()));
    users.reverse();

    leaderboardList.innerHTML = "";
    users.forEach((u, idx) => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        row.innerHTML = `
            <span class="lb-name">#${idx + 1} ${u.name || 'Player'}</span>
            <span class="lb-score">${u.wins || 0} Wins</span>
        `;
        leaderboardList.appendChild(row);
    });
});

closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardModal.classList.add('hidden');
});

// --- PROFILE MODAL ---
userProfileBar.addEventListener('click', () => {
    if (!currentUser) return;
    profileModalAvatar.src = currentUser.photoURL || 'https://via.placeholder.com/70';
    profileNameInput.value = currentUser.displayName || "";
    manageProfileModal.classList.remove('hidden');
});

closeProfileModalBtn.addEventListener('click', () => {
    manageProfileModal.classList.add('hidden');
});

// --- CONTROLS & UTILITIES ---
musicToggleBtn.addEventListener('click', () => {
    if (bgMusic.paused) {
        bgMusic.play();
        musicToggleBtn.textContent = "🔊";
    } else {
        bgMusic.pause();
        musicToggleBtn.textContent = "🎵";
    }
});

copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomCode);
    alert("Room code copied to clipboard!");
});

copyGameLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomCode);
    alert("Room code copied to clipboard!");
});
