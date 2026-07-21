import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged,
    updateProfile 
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
    onDisconnect,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCP43ySOR5fIvOUDnCiAoK-kJol-0rF0Iw",
  authDomain: "tictactoe-e747b.firebaseapp.com",
  databaseURL: "https://tictactoe-e747b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tictactoe-e747b",
  storageBucket: "tictactoe-e747b.firebasestorage.app",
  messagingSenderId: "864419563280",
  appId: "1:864419563280:web:ed84b02a67e0d8e29cc795",
  measurementId: "G-R8M0VCC2WC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// --- PERMANENT DEVELOPER IDENTIFIERS ---
const DEV_EMAIL = "himanshu.yadav01241@gmail.com";
const DEV_NAME = "Himanshu Yadav";

function isDeveloper(userObj) {
    if (!userObj) return false;
    return (userObj.email === DEV_EMAIL || userObj.name === DEV_NAME || userObj.displayName === DEV_NAME);
}

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
const saveProfileBtn = document.getElementById('save-profile-btn') || document.getElementById('save-name-btn');
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
let chatUnsubscribe = null;
let lastMessageCount = 0;

// Force clear backdrop blurs across overlays
function enforceClearBackgrounds() {
    const overlays = [joinOverlay, gameContainer, leaderboardModal, manageProfileModal, chatBox];
    overlays.forEach(el => {
        if (el) {
            el.style.backdropFilter = 'none';
            el.style.webkitBackdropFilter = 'none';
        }
    });
}
enforceClearBackgrounds();

// --- EXCLUSIVE DEV DESIGN BUILDER ---
function renderDevName(nameText) {
    return `<span style="
        background: linear-gradient(90deg, #ff0055, #ff5000);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 800;
        text-shadow: 0 0 10px rgba(255, 0, 85, 0.3);
    ">${nameText}</span>
    <span style="
        color: #ffffff;
        font-size: 0.65rem;
        font-weight: 900;
        background: linear-gradient(135deg, #ef4444, #991b1b);
        padding: 2px 7px;
        border-radius: 6px;
        border: 1px solid #f87171;
        margin-left: 6px;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
        letter-spacing: 0.5px;
    ">DEV</span>`;
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
    let toast = document.getElementById('system-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'system-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: rgba(15, 23, 42, 0.95);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 0.9rem;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
            text-align: center;
            max-width: 90%;
        `;
        document.body.appendChild(toast);
    }

    if (type === 'error') {
        toast.style.borderColor = '#ef4444';
        toast.style.color = '#fca5a5';
    } else {
        toast.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        toast.style.color = '#ffffff';
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0px)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
    }, 3000);
}

// --- MOBILE-FRIENDLY AUTHENTICATION FLOW ---
getRedirectResult(auth)
    .then((result) => {
        if (result && result.user) {
            showToast("Successfully signed in!", "info");
        }
    })
    .catch((error) => {
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            console.error("Redirect Result Error:", error);
            showToast(`Sign In Error (${error.code})`, 'error');
        }
    });

onAuthStateChanged(auth, async (user) => {
    enforceClearBackgrounds();
    if (user) {
        currentUser = user;
        if (usernameInput) {
            usernameInput.value = user.displayName || "Player";
            usernameInput.readOnly = true;
        }
        if (googleLoginBtn) googleLoginBtn.classList.add('hidden');
        if (signedInBadge) signedInBadge.classList.remove('hidden');

        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        if (userNameDisplay) {
            const isDev = isDeveloper(user);
            userNameDisplay.innerHTML = isDev ? renderDevName(user.displayName || "Himanshu Yadav") : (user.displayName || "Player");
        }
        if (userProfileBar) userProfileBar.classList.remove('hidden');

        await syncUserData(user);
    } else {
        currentUser = null;
        if (usernameInput) {
            usernameInput.value = "";
            usernameInput.readOnly = false;
        }
        if (googleLoginBtn) googleLoginBtn.classList.remove('hidden');
        if (signedInBadge) signedInBadge.classList.add('hidden');
        if (userProfileBar) userProfileBar.classList.add('hidden');
    }
});

// Robust Sign-In Click Event with Popup -> Redirect Fallback
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            // If popup was blocked or unavailable on mobile, fallback to redirect
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
                try {
                    await signInWithRedirect(auth, googleProvider);
                } catch (redirectErr) {
                    console.error("Redirect Error:", redirectErr);
                    showToast(`Login failed: ${redirectErr.message}`, 'error');
                }
            } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error("Popup Error:", error);
                showToast(`Login error: ${error.code}`, 'error');
            }
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        signOut(auth);
    });
}

async function syncUserData(user) {
    try {
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const isDev = isDeveloper(user);

        if (!snapshot.exists()) {
            await set(userRef, {
                name: user.displayName || "Himanshu Yadav",
                email: user.email,
                wins: 0,
                avatar: user.photoURL || 'https://via.placeholder.com/32',
                isDev: isDev,
                isBlurred: false
            });
            if (userStatsDisplay) userStatsDisplay.textContent = "Wins: 0";
        } else {
            const data = snapshot.val();
            if (isDev && !data.isDev) {
                await update(userRef, { isDev: true, email: user.email });
            }
            if (userStatsDisplay) userStatsDisplay.textContent = `Wins: ${data.wins || 0}`;
        }
    } catch (err) {
        console.error("Error syncing user data:", err);
    }
}

// --- ROOM MANAGEMENT ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPlayerName() {
    if (currentUser && currentUser.displayName) return currentUser.displayName;
    return (usernameInput && usernameInput.value.trim()) || "Guest_" + Math.floor(1000 + Math.random() * 9000);
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', async () => {
        const name = getPlayerName();
        currentRoomCode = generateRoomCode();
        isHost = true;
        playerSymbol = 'X';

        const roomRef = ref(db, `rooms/${currentRoomCode}`);
        const chatRef = ref(db, `chats/${currentRoomCode}`);

        onDisconnect(roomRef).remove();
        onDisconnect(chatRef).remove();

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

        if (roomWaitBox) roomWaitBox.classList.remove('hidden');
        if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;
        if (joinOverlay) joinOverlay.classList.remove('hidden'); 
        if (gameContainer) gameContainer.classList.add('hidden');

        listenToRoom(currentRoomCode);
    });
}

if (joinCodeBtn) {
    joinCodeBtn.addEventListener('click', async () => {
        const code = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : "";
        if (code.length !== 6) return showToast("Please enter a valid 6-character Room Code.", 'error');

        const roomRef = ref(db, `rooms/${code}`);
        const snapshot = await get(roomRef);

        if (!snapshot.exists()) return showToast("Room not found!", 'error');
        const room = snapshot.val();

        if (room.guestName && room.guestName !== "") {
            return showToast("Room is already full!", 'error');
        }

        currentRoomCode = code;
        isHost = false;
        playerSymbol = 'O';

        const startingTurn = Math.random() < 0.5 ? 'X' : 'O';

        await update(roomRef, {
            guestName: getPlayerName(),
            status: 'active',
            turn: startingTurn
        });

        listenToRoom(currentRoomCode);
    });
}

function listenToRoom(code) {
    const roomRef = ref(db, `rooms/${code}`);
    
    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }

    roomUnsubscribe = onValue(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
            showToast("Room closed by user.", 'info');
            setTimeout(() => cleanupAndLeave(), 1000);
            return;
        }

        const room = snapshot.val();
        updateGameUI(room);
    });

    listenToChat(code);
}

// --- GAME UI UPDATE ---
function updateGameUI(room) {
    enforceClearBackgrounds();

    if (room.status === 'waiting') {
        if (joinOverlay) joinOverlay.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (roomWaitBox) roomWaitBox.classList.remove('hidden');
        if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;
        return;
    }

    if (roomWaitBox) roomWaitBox.classList.add('hidden');
    
    if (joinOverlay) joinOverlay.classList.add('hidden');
    if (gameContainer) gameContainer.classList.remove('hidden');

    if (chatBox) {
        chatBox.classList.remove('hidden');
        if (window.innerWidth > 768) {
            chatBox.style.display = 'flex';
        }
    }

    if (toggleChatBtn) toggleChatBtn.classList.remove('hidden');

    if (gameRoomCode) gameRoomCode.textContent = `ROOM: ${currentRoomCode}`;
    if (activeRoomBadge) activeRoomBadge.classList.remove('hidden');

    if (p1Name) p1Name.textContent = room.hostName || "Host";
    if (p2Name) p2Name.textContent = room.guestName || "Guest";
    if (p1Score) p1Score.textContent = room.hostScore || 0;
    if (p2Score) p2Score.textContent = room.guestScore || 0;

    room.board.forEach((val, idx) => {
        if (cells[idx]) cells[idx].textContent = val;
    });

    if (room.status === 'active') {
        if (board) board.classList.remove('disabled');
        if (rematchBtn) rematchBtn.classList.add('hidden');
        if (leaveRoomBtn) leaveRoomBtn.classList.remove('hidden');

        if (statusText) {
            if (room.turn === playerSymbol) {
                statusText.textContent = "Your Turn! (" + playerSymbol + ")";
            } else {
                statusText.textContent = (room.turn === 'X' ? room.hostName : room.guestName) + "'s Turn...";
            }
        }

        if (room.turn === 'X') {
            if (p1Box) p1Box.classList.add('active-turn');
            if (p2Box) p2Box.classList.remove('active-turn');
        } else {
            if (p2Box) p2Box.classList.add('active-turn');
            if (p1Box) p1Box.classList.remove('active-turn');
        }
    } else if (room.status === 'finished') {
        if (board) board.classList.add('disabled');
        if (p1Box) p1Box.classList.remove('active-turn');
        if (p2Box) p2Box.classList.remove('active-turn');

        if (statusText) {
            if (room.winner === 'draw') {
                statusText.textContent = "It's a Draw! 🤝";
            } else {
                const winnerName = room.winner === 'X' ? room.hostName : room.guestName;
                statusText.textContent = `${winnerName} Wins! 🎉`;
            }
        }

        if (isHost && rematchBtn) rematchBtn.classList.remove('hidden');
    }
}

// --- BOARD CELL CLICKS ---
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
        } else if (newBoard.every(c => c !== "")) {
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
    const userWinsRef = ref(db, `users/${uid}/wins`);
    const result = await runTransaction(userWinsRef, (currentWins) => {
        return (currentWins || 0) + 1;
    });

    if (result.committed && userStatsDisplay) {
        userStatsDisplay.textContent = `Wins: ${result.snapshot.val()}`;
    }
}

// --- REMATCH & CLEANUP ---
if (rematchBtn) {
    rematchBtn.addEventListener('click', async () => {
        if (!isHost) return;
        const roomRef = ref(db, `rooms/${currentRoomCode}`);
        
        const startingTurn = Math.random() < 0.5 ? 'X' : 'O';

        await update(roomRef, {
            board: Array(9).fill(""),
            turn: startingTurn,
            status: 'active',
            winner: ""
        });
    });
}

function cleanupAndLeave() {
    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }

    if (currentRoomCode) {
        remove(ref(db, `rooms/${currentRoomCode}`));
        remove(ref(db, `chats/${currentRoomCode}`));
    }
    location.reload();
}

if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', cleanupAndLeave);

// --- CHAT SYSTEM ---
function listenToChat(code) {
    const chatRef = ref(db, `chats/${code}`);
    lastMessageCount = 0;

    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }

    chatUnsubscribe = onValue(chatRef, (snapshot) => {
        if (!chatMessages) return;
        chatMessages.innerHTML = "";
        if (!snapshot.exists()) return;

        let messages = [];
        snapshot.forEach((child) => {
            messages.push(child.val());
        });

        messages.forEach((msg) => {
            const msgDiv = document.createElement('div');
            const isMe = msg.sender === getPlayerName();
            msgDiv.className = `chat-msg ${isMe ? 'my-msg' : ''}`;
            msgDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
            chatMessages.appendChild(msgDiv);
        });

        if (messages.length > lastMessageCount && lastMessageCount > 0) {
            const latestMsg = messages[messages.length - 1];
            if (latestMsg.sender !== getPlayerName()) {
                showToast(`${latestMsg.sender}: ${latestMsg.text}`);
            }
        }
        lastMessageCount = messages.length;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput ? chatInput.value.trim() : "";
        if (!text || !currentRoomCode) return;

        const chatRef = ref(db, `chats/${currentRoomCode}`);
        await push(chatRef, {
            sender: getPlayerName(),
            text: text,
            timestamp: serverTimestamp()
        });

        if (chatInput) chatInput.value = "";
    });
}

if (toggleChatBtn) {
    toggleChatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (chatBox) {
            chatBox.classList.remove('hidden');
            chatBox.classList.toggle('active');
            chatBox.classList.toggle('open');
            if (chatBox.style.display === 'none' || chatBox.style.display === '') {
                chatBox.style.display = 'flex';
            }
        }
    });
}

if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
        if (chatBox) {
            chatBox.classList.remove('active');
            chatBox.classList.remove('open');
            if (window.innerWidth <= 768) {
                chatBox.style.display = 'none';
            }
        }
    });
}

// --- LEADERBOARD & TOGGLE NAME BLUR SYSTEM ---
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        if (leaderboardModal) {
            leaderboardModal.classList.remove('hidden');
            leaderboardModal.style.backdropFilter = 'none';
            leaderboardModal.style.webkitBackdropFilter = 'none';
        }
        if (leaderboardList) leaderboardList.innerHTML = "Loading records...";

        await renderLeaderboard();
    });
}

async function renderLeaderboard() {
    try {
        const snapshot = await get(ref(db, 'users'));

        if (!snapshot.exists()) {
            if (leaderboardList) leaderboardList.innerHTML = "<div class='lb-row'>No records found.</div>";
            return;
        }

        let users = [];
        snapshot.forEach((child) => {
            users.push({ uid: child.key, ...child.val() });
        });

        let devUser = users.find(u => isDeveloper(u) || u.isDev);
        let regularUsers = users.filter(u => !(isDeveloper(u) || u.isDev));

        regularUsers.sort((a, b) => (b.wins || 0) - (a.wins || 0));

        let finalLeaderboard = [];
        if (devUser) {
            finalLeaderboard.push(devUser);
        } else {
            finalLeaderboard.push({ uid: 'dev-id', name: DEV_NAME, email: DEV_EMAIL, wins: 1, isDev: true });
        }

        finalLeaderboard = finalLeaderboard.concat(regularUsers);

        const currentIsDev = isDeveloper(currentUser);

        if (leaderboardList) {
            leaderboardList.innerHTML = "";
            finalLeaderboard.forEach((u, idx) => {
                const row = document.createElement('div');
                row.className = 'lb-row';
                
                const isDev = isDeveloper(u) || u.isDev;
                const rawName = u.name || 'Player';
                const isNameBlurred = u.isBlurred === true;

                const nameMarkup = isDev 
                    ? renderDevName(rawName) 
                    : `<span class="lb-name-styled">${rawName}</span>`;

                const blurCss = isNameBlurred 
                    ? "filter: blur(5px); -webkit-filter: blur(5px); opacity: 0.8; user-select: none; transition: all 0.3s ease;" 
                    : "filter: none; opacity: 1;";

                const adminClass = currentIsDev ? 'admin-clickable' : '';

                row.innerHTML = `
                    <span class="lb-name">
                        #${idx + 1} 
                        <span class="lb-name-text ${adminClass}" style="${blurCss}" data-uid="${u.uid}" title="${currentIsDev ? 'Click to toggle blur state' : ''}">
                            ${nameMarkup}
                        </span>
                    </span>
                    <span class="lb-score" style="${isDev ? 'color: #ef4444; font-weight: 800;' : ''}">${u.wins || 0} Wins</span>
                `;

                leaderboardList.appendChild(row);
            });

            if (currentIsDev) {
                const nameSpans = leaderboardList.querySelectorAll('.admin-clickable');
                nameSpans.forEach(span => {
                    span.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const targetElement = e.target.closest('.admin-clickable');
                        const targetUid = targetElement ? targetElement.getAttribute('data-uid') : null;
                        
                        if (!targetUid || targetUid === 'dev-id') return;

                        const userBlurRef = ref(db, `users/${targetUid}/isBlurred`);
                        const currentValSnap = await get(userBlurRef);
                        const newBlurStatus = !(currentValSnap.val() === true);

                        await set(userBlurRef, newBlurStatus);
                        
                        showToast(newBlurStatus ? "Name blurred" : "Name visible");
                        renderLeaderboard();
                    });
                });
            }
        }
    } catch (err) {
        console.error("Leaderboard Error:", err);
        if (leaderboardList) leaderboardList.innerHTML = "<div class='lb-row'>Failed to load data.</div>";
    }
}

if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
        if (leaderboardModal) leaderboardModal.classList.add('hidden');
    });
}

// --- PROFILE & CHANGE NAME MODAL ---
if (userProfileBar) {
    userProfileBar.addEventListener('click', () => {
        if (!currentUser) return;
        if (profileModalAvatar) profileModalAvatar.src = currentUser.photoURL || 'https://via.placeholder.com/70';
        if (profileNameInput) profileNameInput.value = currentUser.displayName || "";
        if (manageProfileModal) {
            manageProfileModal.classList.remove('hidden');
            manageProfileModal.style.backdropFilter = 'none';
            manageProfileModal.style.webkitBackdropFilter = 'none';
        }
    });
}

// Change Name Functionality
async function handleNameChange() {
    if (!currentUser) {
        showToast("You must be logged in to change your name.", "error");
        return;
    }

    const newName = profileNameInput ? profileNameInput.value.trim() : "";
    if (!newName) {
        showToast("Name cannot be empty!", "error");
        return;
    }

    try {
        await updateProfile(currentUser, { displayName: newName });
        await update(ref(db, `users/${currentUser.uid}`), { name: newName });

        if (currentRoomCode) {
            const roomRef = ref(db, `rooms/${currentRoomCode}`);
            if (isHost) {
                await update(roomRef, { hostName: newName });
            } else {
                await update(roomRef, { guestName: newName });
            }
        }

        if (userNameDisplay) {
            const isDev = isDeveloper(currentUser);
            userNameDisplay.innerHTML = isDev ? renderDevName(newName) : newName;
        }
        if (usernameInput) usernameInput.value = newName;

        showToast("Name updated successfully!");
        if (manageProfileModal) manageProfileModal.classList.add('hidden');
    } catch (err) {
        console.error("Error changing name:", err);
        showToast("Failed to update name.", "error");
    }
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', handleNameChange);
}

if (profileNameInput) {
    profileNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNameChange();
        }
    });
}

if (closeProfileModalBtn) {
    closeProfileModalBtn.addEventListener('click', () => {
        if (manageProfileModal) manageProfileModal.classList.add('hidden');
    });
}

// --- AUDIO & COPY UTILITIES ---
if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', () => {
        if (bgMusic) {
            if (bgMusic.paused) {
                bgMusic.play();
                musicToggleBtn.textContent = "🔊";
            } else {
                bgMusic.pause();
                musicToggleBtn.textContent = "🎵";
            }
        }
    });
}

if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(currentRoomCode);
        showToast("Room code copied to clipboard!");
    });
}

if (copyGameLinkBtn) {
    copyGameLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(currentRoomCode);
        showToast("Room code copied to clipboard!");
    });
}
