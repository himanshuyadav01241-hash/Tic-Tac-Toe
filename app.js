const AVATARS = { host: '🧑‍🦱', guest: '👩‍🦰' };
let myRole = null;       
let currentTurn = 'host'; 
let boardState = Array(9).fill(null);
let scores = { host: 0, guest: 0 };
let peer, connection;

// UI Components
const statusText = document.getElementById('status-text');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const resetBtn = document.getElementById('reset-btn');
const p1Box = document.getElementById('p1-box');
const p2Box = document.getElementById('p2-box');
const p1NameEl = document.getElementById('p1-name');
const p2NameEl = document.getElementById('p2-name');

// Overlay Elements
const joinOverlay = document.getElementById('join-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const overlayBtn = document.getElementById('overlay-btn');
const usernameInput = document.getElementById('username-input');

const urlParams = new URLSearchParams(window.location.search);
const targetRoom = urlParams.get('room');

// Shared NAT/Firewall Bypass Configurations
const peerConfig = {
    config: {
        iceServers: [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:stun1.l.google.com:19302' }
        ]
    }
};

// Helper to get local player name entry
function getMyName() {
    return usernameInput.value.trim() || (myRole === 'host' ? 'Host' : 'Guest');
}

if (targetRoom) {
    myRole = 'guest';
    overlayTitle.innerText = "Entering the Garden...";
    overlaySubtitle.innerText = "Enter your name to connect to your partner.";
    overlayBtn.innerText = "🌸 Join Room";
    overlayBtn.classList.remove('hidden');
    
    overlayBtn.onclick = () => {
        overlayBtn.innerText = "Connecting...";
        overlayBtn.disabled = true;
        
        // Initializing Guest Client with Firewall Bypass Configuration
        peer = new Peer(peerConfig);
        peer.on('open', () => {
            connection = peer.connect(targetRoom);
            setupConnectionListeners();
        });
        
        peer.on('error', (err) => {
            console.error(err);
            overlayTitle.innerText = "Connection Failed 🌸";
            overlaySubtitle.innerText = "Could not link to the host. Please double-check your invite URL.";
            overlayBtn.disabled = false;
            overlayBtn.innerText = "🌸 Retry Join";
        });
    };
} else {
    myRole = 'host';
    // Initializing Host Server with Firewall Bypass Configuration
    peer = new Peer(peerConfig);
    peer.on('open', (id) => {
        overlayTitle.innerText = "Invite Your Partner";
        overlaySubtitle.innerText = "Enter your name and share the invite link.";
        overlayBtn.classList.remove('hidden');
        
        const inviteLink = `${window.location.origin}${window.location.pathname}?room=${id}`;
        overlayBtn.onclick = () => {
            navigator.clipboard.writeText(inviteLink);
            overlayBtn.innerText = "🌸 Link Copied!";
            overlayBtn.style.background = "#e0f2f1";
            setTimeout(() => {
                overlayBtn.innerText = "📋 Copy Invite Link";
                overlayBtn.style.background = "var(--sakura-pink)";
            }, 2000);
        };
    });

    peer.on('connection', (conn) => {
        connection = conn;
        setupConnectionListeners();
    });
}

function setupConnectionListeners() {
    connection.on('open', () => {
        // Exchange player identity data
        connection.send({ type: 'name-sync', name: getMyName(), role: myRole });
        
        if (myRole === 'host') p1NameEl.innerText = getMyName();
        if (myRole === 'guest') p2NameEl.innerText = getMyName();

        // Release overlay panel locks
        joinOverlay.classList.add('fade-out');
        boardEl.classList.remove('disabled');
        updateTurnIndicators();
    });

    connection.on('data', (data) => {
        if (data.type === 'name-sync') {
            if (data.role === 'host') p1NameEl.innerText = data.name;
            if (data.role === 'guest') p2NameEl.innerText = data.name;
            
            if (myRole === 'host') {
                connection.send({ type: 'name-sync', name: getMyName(), role: 'host' });
            }
        } else if (data.type === 'move') {
            executeMove(data.index, data.role);
        } else if (data.type === 'reset') {
            resetBoardState();
        }
    });

    connection.on('close', () => {
        joinOverlay.classList.remove('fade-out');
        overlayTitle.innerText = "Connection Lost 🌸";
        overlaySubtitle.innerText = "Your partner disconnected. Refresh to open a new room.";
        overlayBtn.classList.add('hidden');
        boardEl.classList.add('disabled');
    });
}

cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (boardState[index] || currentTurn !== myRole || !connection) return;

        executeMove(index, myRole);
        connection.send({ type: 'move', index: index, role: myRole });
    });
});

function executeMove(index, role) {
    boardState[index] = role;
    cells[index].innerText = AVATARS[role];
    cells[index].classList.add('taken');

    if (checkWin()) {
        highlightWin();
        scores[role]++;
        document.getElementById(`p${role === 'host' ? 1 : 2}-score`).innerText = scores[role];
        
        const winnerName = role === 'host' ? p1NameEl.innerText : p2NameEl.innerText;
        statusText.innerText = `${winnerName} Wins the Round! 🌟`;
        
        boardEl.classList.add('disabled');
        resetBtn.classList.remove('hidden');
        return;
    }

    if (boardState.every(cell => cell !== null)) {
        statusText.innerText = "A Peaceful Draw! 🥂";
        resetBtn.classList.remove('hidden');
        return;
    }

    currentTurn = currentTurn === 'host' ? 'guest' : 'host';
    updateTurnIndicators();
}

function updateTurnIndicators() {
    const currentName = currentTurn === 'host' ? p1NameEl.innerText : p2NameEl.innerText;
    
    if (currentTurn === myRole) {
        statusText.innerText = "Your Turn ✨";
    } else {
        statusText.innerText = `${currentName} is choosing a tile...`;
    }

    if (currentTurn === 'host') {
        p1Box.classList.add('active-turn');
        p2Box.classList.remove('active-turn');
    } else {
        p2Box.classList.add('active-turn');
        p1Box.classList.remove('active-turn');
    }
}

const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function checkWin() {
    return winPatterns.some(pattern => {
        return pattern.every(index => boardState[index] === currentTurn);
    });
}

function highlightWin() {
    winPatterns.forEach(pattern => {
        if (pattern.every(index => boardState[index] === currentTurn)) {
            pattern.forEach(index => cells[index].classList.add('winner'));
        }
    });
}

resetBtn.addEventListener('click', () => {
    resetBoardState();
    connection.send({ type: 'reset' });
});

function resetBoardState() {
    boardState = Array(9).fill(null);
    currentTurn = 'host';
    cells.forEach(cell => {
        cell.innerText = '';
        cell.classList.remove('taken', 'winner');
    });
    resetBtn.classList.add('hidden');
    boardEl.classList.remove('disabled');
    updateTurnIndicators();
}
