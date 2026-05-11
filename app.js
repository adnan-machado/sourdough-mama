const STATES = {
    'ACTION_1': {
        title: 'ACTION 1',
        text: "Preheat the oven to 450F with the empty dutch oven inside, and the pizza stone on the bottom rack",
        buttonImg: "temperature.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_1'
    },
    'WAIT_1': {
        title: 'WAITING...',
        text: "Preheating... (30 min)",
        buttonImg: "temperature.png",
        timerSeconds: 1800,
        characterImg: "eyes_star.png",
        nextState: 'ACTION_2',
        isWait: true
    },
    'ACTION_2': {
        title: 'ACTION 2',
        text: "Score the bread, spray it, put it in, close the lid!",
        buttonImg: "dutch.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_2'
    },
    'WAIT_2': {
        title: 'WAITING...',
        text: "Great, now we wait a bit before scoring the ears",
        buttonImg: "dutch.png",
        timerSeconds: 420,
        characterImg: "eyes_star.png",
        nextState: 'ACTION_3',
        isWait: true
    },
    'ACTION_3': {
        title: 'ACTION 3',
        text: "Score those ears at a 45 degree angle! Lid back on and continue baking",
        buttonImg: "knife.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_3'
    },
    'WAIT_3': {
        title: 'WAITING...',
        text: "Baking with lid on... (13 min)",
        buttonImg: "knife.png",
        timerSeconds: 13*60,
        characterImg: "eyes_star.png",
        nextState: 'ACTION_4',
        isWait: true
    },
    'ACTION_4': {
        title: 'ACTION 4',
        text: "Time to lower the temperature to 400F and open bake",
        buttonImg: "oven.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_4'
    },
    'WAIT_4': {
        title: 'WAITING...',
        text: "Open baking... (20 min)",
        buttonImg: "oven.png",
        timerSeconds: 20*60,
        characterImg: "eyes_star.png",
        nextState: 'ACTION_5',
        isWait: true
    },
    'ACTION_5': {
        title: 'ACTION 5',
        text: "Final check. Knock the bottom, is it ready?",
        buttonImg: "boule.png",
        characterImg: "eyes_open.png",
        nextState: 'CELEBRATION'
    }
};

let currentState = 'START';
let timeLeft = null;
let timerEnd = null;
let timerInterval = null;
let typewriterInterval = null;
let typewriterSessionId = 0;

const MILESTONES = {
    'ACTION_1': { id: 'preheat', label: 'Preheat', target: 0 },
    'ACTION_2': { id: 'dough', label: 'Dough in the oven', target: 10 },
    'ACTION_3': { id: 'score', label: '7-minute score', target: 20 },
    'ACTION_4': { id: 'open', label: 'Open bake', target: 13 },
    'ACTION_5': { id: 'remove', label: 'Remove loaf', target: 20 }
};

let bakeHistory = {}; // state -> { timestamp, durationPrev }
let stepScores = []; // Array of scores from WAIT steps
let lastWaitEndTime = null; 

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const celebrationScreen = document.getElementById('celebration-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const restartModal = document.getElementById('restart-modal');
const historyModal = document.getElementById('history-modal');

const stateTitle = document.getElementById('state-title');
const timerDisplay = document.getElementById('timer-display');
const characterImg = document.getElementById('character-img');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const actionLabel = document.getElementById('action-label');
const speechText = document.getElementById('speech-text');
const historyList = document.getElementById('history-list');

const leaderboardList = document.getElementById('leaderboard-list');
const finalScoreVal = document.getElementById('final-score-val');
const finalMessage = document.getElementById('final-message');
const celebrationScoreText = document.getElementById('celebration-score-text');
const celebrationMessageText = document.getElementById('celebration-message');
const playAgainBtn = document.getElementById('play-again-btn');

const startSound = document.getElementById('start-sound');
const timerSound = document.getElementById('timer-sound');
const celebrationSound = document.getElementById('celebration-sound');
const refreshSound = document.getElementById('refresh-sound');
// Optional click sound if added later
const clickSound = document.getElementById('click-sound') || { play: () => Promise.resolve(), pause: () => {}, currentTime: 0, volume: 1 };

let clearBuffer = "";

// Initialization
function init() {
    console.log("Initializing app...");
    const savedState = localStorage.getItem('sourdough_game_state');
    const savedHistory = localStorage.getItem('sourdough_history');
    const savedScores = localStorage.getItem('sourdough_step_scores');
    if (savedHistory) {
         try { bakeHistory = JSON.parse(savedHistory); } catch(e) { bakeHistory = {}; }
    }
    if (savedScores) {
         try { stepScores = JSON.parse(savedScores); } catch(e) { stepScores = []; }
    }

    if (savedState && savedState !== 'START' && STATES[savedState]) {
        currentState = savedState;
        showScreen('game-screen');
        resumeTimer();
    } else {
        showScreen('start-screen');
        // We still try to play, though it might be blocked on first attempt
        playSound(startSound);
    }

    // Event Listeners with Safe access
    const startScr = document.getElementById('start-screen');
    if (startScr) startScr.addEventListener('click', startBake);

    const celebScr = document.getElementById('celebration-screen');
    if (celebScr) celebScr.addEventListener('click', showLeaderboard);

    if (playAgainBtn) playAgainBtn.addEventListener('click', restartGame);

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            playSound(clickSound);
            if (restartModal) restartModal.classList.remove('hidden');
        });
    }

    const historyBtn = document.getElementById('history-btn');
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            playSound(clickSound);
            openHistory();
        });
    }

    const closeHistory = document.getElementById('close-history');
    if (closeHistory) {
        closeHistory.addEventListener('click', () => {
            playSound(clickSound);
            if (historyModal) historyModal.classList.add('hidden');
        });
    }

    const confirmYes = document.getElementById('confirm-yes');
    if (confirmYes) confirmYes.addEventListener('click', restartGame);

    const confirmNo = document.getElementById('confirm-no');
    if (confirmNo) {
        confirmNo.addEventListener('click', () => {
            playSound(clickSound);
            if (restartModal) restartModal.classList.add('hidden');
        });
    }

    if (actionBtn) actionBtn.addEventListener('click', handleAction);

    // Leaderboard "CLEAR" listener
    window.addEventListener('keydown', (e) => {
        if (currentState !== 'LEADERBOARD') return;
        
        clearBuffer += e.key.toUpperCase();
        if (clearBuffer.endsWith("CLEAR")) {
            clearLeaderboardEntries();
            clearBuffer = "";
        }
        
        // Reset buffer if it gets too long to avoid leaks
        if (clearBuffer.length > 10) clearBuffer = clearBuffer.slice(-5);
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(registration => {
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // New content is available; please refresh.
                                console.log('New content is available; please refresh.');
                                // Pre-emptively update cache to avoid the "eyes_start.png" stale issue
                            } else {
                                // Content is cached for offline use.
                                console.log('Content is cached for offline use.');
                            }
                        }
                    };
                }
            };
        }).catch(err => console.log('SW failed', err));
    }
}

function showScreen(id) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    } else {
        console.warn("showScreen: Element not found:", id);
    }
}

function startBake() {
    // Ensuring title music starts on first interaction if it was blocked
    playSound(startSound);
    
    // Clear any previous session data if we are starting fresh from start screen
    localStorage.removeItem('sourdough_game_state');
    localStorage.removeItem('sourdough_timer_end');
    localStorage.removeItem('sourdough_history');
    localStorage.removeItem('sourdough_step_scores');
    bakeHistory = {};
    stepScores = [];
    lastWaitEndTime = null;
    if (timerInterval) clearInterval(timerInterval);

    // Unlock audio for iOS
    [startSound, timerSound, celebrationSound, clickSound].filter(s => s).forEach(s => {
        s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(() => {});
    });

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    currentState = 'ACTION_1';
    localStorage.setItem('sourdough_game_state', currentState);
    showScreen('game-screen');
    updateUI();
}

function updateUI() {
    const config = STATES[currentState];
    if (!config) {
        console.error("No config found for state:", currentState);
        return;
    }

    console.log("Updating UI for state:", currentState, "isWait:", config.isWait);

    stateTitle.textContent = config.title;
    characterImg.src = config.characterImg;
    
    // Check if waiting, show next action icon
    const nextStateConfig = STATES[config.nextState];
    if (config.isWait && nextStateConfig) {
        actionIcon.src = nextStateConfig.buttonImg;
    } else {
        actionIcon.src = config.buttonImg;
    }
    
    // Fallback for missing images
    characterImg.onerror = () => characterImg.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentState}`;
    actionIcon.onerror = () => actionIcon.src = `https://picsum.photos/seed/${currentState}/200/200`;

    if (config.isWait) {
        actionBtn.disabled = true;
        actionLabel.textContent = 'WAITING...';
        timerDisplay.style.color = '#00ff00'; // Green while waiting
    } else {
        actionBtn.disabled = false;
        actionLabel.textContent = 'TAP TO ACTION';
        timerDisplay.style.color = 'var(--color-timer)'; // Red when active
        timerDisplay.textContent = '00:00';
    }

    typewriter(speechText, config.text);
}

function handleAction() {
    stopMusic(); // Stop any playing music when transitioning
    playSound(clickSound);
    const config = STATES[currentState];
    const isTimerExpired = !timerEnd || Date.now() >= timerEnd;
    if (config && (!config.isWait || isTimerExpired)) {
        const now = Date.now();

        // Record score based on how late the user was to press the button after a WAIT ended
        if (MILESTONES[currentState] && currentState !== 'ACTION_1' && currentState !== 'ACTION_5' && lastWaitEndTime) {
            const overtimeMs = Math.max(0, now - lastWaitEndTime);
            const overtimeSec = overtimeMs / 1000;
            
            // Find the WAIT that just ended to get its target duration
            const prevStates = Object.keys(STATES);
            const currIdx = prevStates.indexOf(currentState);
            const prevWaitState = prevStates[currIdx - 1]; // Sequence: ... -> WAIT_X -> ACTION_Y
            const targetSec = STATES[prevWaitState] ? STATES[prevWaitState].timerSeconds : 1;
            
            const score = Math.max(0, 1 - (overtimeSec / targetSec));
            stepScores.push(score);
            localStorage.setItem('sourdough_step_scores', JSON.stringify(stepScores));
            console.log(`Score for ${currentState}: ${Math.round(score * 100)}% (Lateness: ${overtimeSec.toFixed(1)}s beyond target ${targetSec}s)`);
        }

        // Record timestamp for history
        if (MILESTONES[currentState]) {
            let durationPrevStr = "";
            let prevStateKey = "";
            
            // Find the previous performed milestone to calculate duration
            const milestones = Object.keys(MILESTONES);
            const currIdx = milestones.indexOf(currentState);
            if (currIdx > 0) {
                prevStateKey = milestones[currIdx - 1];
            }

            if (prevStateKey && bakeHistory[prevStateKey]) {
                const diffMs = now - bakeHistory[prevStateKey].timestamp;
                const totalSec = Math.floor(diffMs / 1000);
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                durationPrevStr = `${m}:${s.toString().padStart(2, '0')}`;
            }

            bakeHistory[currentState] = {
                timestamp: now,
                durationStr: durationPrevStr
            };
            localStorage.setItem('sourdough_history', JSON.stringify(bakeHistory));
        }

        transitionTo(config.nextState);
    }
}

function transitionTo(next) {
    currentState = next;
    localStorage.setItem('sourdough_game_state', currentState);

    if (currentState === 'CELEBRATION') {
        startCelebration();
    } else {
        updateUI();
        if (STATES[currentState].isWait) {
            startTimer(STATES[currentState].timerSeconds);
        }
    }
}

function startTimer(seconds) {
    const now = Date.now();
    timerEnd = now + (seconds * 1000);
    localStorage.setItem('sourdough_timer_end', timerEnd);
    console.log("Timer started for", seconds, "seconds. Ends at", timerEnd);
    
    // Send message to Service Worker for background notification
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'START_TIMER',
            endTime: timerEnd,
            message: "Timer finished! Time for the next step."
        });
    }

    runTimer();
}

function resumeTimer() {
    const savedEnd = localStorage.getItem('sourdough_timer_end');
    const config = STATES[currentState];
    
    if (savedEnd && config && config.isWait) {
        timerEnd = parseInt(savedEnd, 10);
        const now = Date.now();
        console.log("Resuming timer. Current time:", now, "End time:", timerEnd);
        
        if (timerEnd > now) {
            updateUI(); // Ensure UI is updated for the resumed state
            runTimer();
        } else {
            console.log("Saved timer already expired, completing now.");
            handleTimerComplete();
        }
    } else {
        // If we are not in a wait state, clear any lingering timer data
        localStorage.removeItem('sourdough_timer_end');
        timerEnd = null;
        if (timerInterval) clearInterval(timerInterval);
        console.log("No active wait state or timer to resume.");
        updateUI();
    }
}

function runTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    const update = () => {
        const now = Date.now();
        const diffInSeconds = Math.max(0, Math.ceil((timerEnd - now) / 1000));
        
        const m = Math.floor(diffInSeconds / 60).toString().padStart(2, '0');
        const s = (diffInSeconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${m}:${s}`;

        if (diffInSeconds <= 0) {
            if (timerInterval) clearInterval(timerInterval);
            timerDisplay.style.color = 'var(--color-timer)'; // Switch to red at 0
            handleTimerComplete();
        }
    };

    update(); 
    timerInterval = setInterval(update, 1000);
}

function handleTimerComplete() {
    lastWaitEndTime = Date.now();
    localStorage.removeItem('sourdough_timer_end');
    timerEnd = null;
    
    // Attempt to play sound and notify
    try {
        const audio = timerSound;
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    } catch (e) {
        console.warn("Sound play failed", e);
    }

    try {
        notify("Timer finished! Time for the next step.");
    } catch (e) {
        console.warn("Notification failed", e);
    }
    
    const config = STATES[currentState];
    if (config && config.isWait) {
        console.log("Timer complete, transitioning from", currentState, "to", config.nextState);
        transitionTo(config.nextState);
    }
}

function startCelebration() {
    stopMusic();
    showScreen('celebration-screen');
    
    // Calculate final score
    let total = 0;
    stepScores.forEach(s => total += s);
    const avg = stepScores.length > 0 ? (total / stepScores.length) : 1;
    const finalPct = (avg * 100).toFixed(1);
    
    if (celebrationScoreText) {
        celebrationScoreText.textContent = `${finalPct}%`;
    }
    if (celebrationMessageText) {
        celebrationMessageText.textContent = getScoreMessage(parseFloat(finalPct));
    }

    // Save to leaderboard
    saveToLeaderboard(parseFloat(finalPct));

    const audio = celebrationSound;
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
    
    // Auto transition to leaderboard after 6 seconds
    setTimeout(() => {
        if (currentState === 'CELEBRATION') showLeaderboard();
    }, 6000);
}

function showLeaderboard() {
    currentState = 'LEADERBOARD';
    showScreen('leaderboard-screen');
    
    // Update leaderboard UI
    if (finalScoreVal && stepScores.length > 0) {
        let total = 0;
        stepScores.forEach(s => total += s);
        const avg = total / stepScores.length;
        const finalPct = (avg * 100).toFixed(1);
        finalScoreVal.textContent = `${finalPct}%`;
        
        finalMessage.textContent = getScoreMessage(parseFloat(finalPct));
    }

    renderLeaderboard();
}

function getScoreMessage(p) {
    if (p >= 95) return "Perfect Bake! You are the cooking Mama!";
    else if (p >= 85) return "Great bake, smells delicious!";
    else if (p >= 80) return "Not bad!";
    else return "Better luck next time — it's okay, Adnan will eat it anyways";
}

function saveToLeaderboard(score) {
    let leaderboard = [];
    const saved = localStorage.getItem('sourdough_leaderboard');
    if (saved) {
        try { leaderboard = JSON.parse(saved); } catch(e) { leaderboard = []; }
    }

    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const year24 = d.getFullYear().toString().slice(-2);
    const dateStr = `${months[d.getMonth()]} ${d.getDate()} '${year24}`;
    
    let entryName = dateStr;
    let count = 1;
    while (leaderboard.some(e => e.name === entryName)) {
        count++;
        entryName = `${dateStr} (${count})`;
    }

    leaderboard.push({ name: entryName, score: score });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    
    localStorage.setItem('sourdough_leaderboard', JSON.stringify(leaderboard));
}

function renderLeaderboard() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    
    // Add reset message back if it was removed by innerHTML = ''
    const msg = document.createElement('div');
    msg.id = "reset-msg";
    msg.className = "reset-message hidden";
    msg.textContent = "LEADERBOARD RESET";
    leaderboardList.appendChild(msg);
    
    let leaderboard = [];
    const saved = localStorage.getItem('sourdough_leaderboard');
    if (saved) {
        try { leaderboard = JSON.parse(saved); } catch(e) { leaderboard = []; }
    }

    leaderboard.forEach((entry, idx) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <span>${idx + 1}. <span class="entry-name">${entry.name}</span></span>
            <span class="entry-score">${entry.score.toFixed(1)}%</span>
        `;
        leaderboardList.appendChild(item);
    });
}

function clearLeaderboardEntries() {
    const items = document.querySelectorAll('.leaderboard-item');
    const resetMsg = document.getElementById('reset-msg');
    
    // Stop celebration music and play reset sound
    if (celebrationSound) celebrationSound.pause();
    if (refreshSound) {
        refreshSound.currentTime = 0;
        refreshSound.play().catch(() => {});
    }
    
    // Visual effects
    items.forEach(item => {
        item.classList.add('pixely-fade-out');
    });
    
    if (resetMsg) resetMsg.classList.remove('hidden');
    
    setTimeout(() => {
        // Calculate current bake score to keep as only entry
        let currentScore = 0;
        if (stepScores.length > 0) {
            let total = 0;
            stepScores.forEach(s => total += s);
            currentScore = parseFloat((total * 100 / stepScores.length).toFixed(1));
        }

        const d = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const year24 = d.getFullYear().toString().slice(-2);
        const dateStr = `${months[d.getMonth()]} ${d.getDate()} '${year24}`;

        const newLeaderboard = [{ name: dateStr, score: currentScore }];
        localStorage.setItem('sourdough_leaderboard', JSON.stringify(newLeaderboard));
        
        renderLeaderboard();
        if (resetMsg) resetMsg.classList.add('hidden');
    }, 3000);
}

function restartGame() {
    stopMusic();
    if (refreshSound) {
        refreshSound.pause();
        refreshSound.currentTime = 0;
    }
    localStorage.removeItem('sourdough_game_state');
    localStorage.removeItem('sourdough_timer_end');
    localStorage.removeItem('sourdough_history');
    localStorage.removeItem('sourdough_step_scores');
    bakeHistory = {};
    stepScores = [];
    if (timerInterval) clearInterval(timerInterval);
    if (typewriterInterval) clearInterval(typewriterInterval);
    
    currentState = 'START';
    if (restartModal) restartModal.classList.add('hidden');
    if (historyModal) historyModal.classList.add('hidden');
    showScreen('start-screen');
    playSound(startSound);
}

function openHistory() {
    if (!historyModal || !historyList) return;
    historyList.innerHTML = '';
    
    const milestoneStates = Object.keys(MILESTONES);
    
    milestoneStates.forEach((stateKey, idx) => {
        const milestone = MILESTONES[stateKey];
        const data = bakeHistory[stateKey];
        const item = document.createElement('div');
        item.className = 'history-item';
        if (!data) item.classList.add('inactive');
        
        let timeStr = "--:--";
        if (data) {
            const date = new Date(data.timestamp);
            timeStr = date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0');
        }

        let metricsStr = "";
        if (idx > 0) {
            const targetMin = Math.floor(milestone.target / 60);
            const targetSec = milestone.target % 60;
            const targetStr = `${targetMin}:${targetSec.toString().padStart(2, '0')}`;
            
            let actualStr = "0:00";
            if (data && data.durationStr) {
                actualStr = data.durationStr;
            } else if (!data) {
                actualStr = "--:--";
            }
            metricsStr = `${actualStr} / ${targetStr} target`;
        }

        item.innerHTML = `
            <div class="history-item-main">
                <span class="history-label">${milestone.label}</span>
                <span class="history-time">${timeStr}</span>
            </div>
            <div class="history-metrics">${metricsStr}</div>
        `;
        historyList.appendChild(item);
    });
    
    historyModal.classList.remove('hidden');
}

// Helpers
function typewriter(element, text) {
    const sessionId = ++typewriterSessionId;
    if (typewriterInterval) clearInterval(typewriterInterval);
    
    element.textContent = '';
    let i = 0;
    
    typewriterInterval = setInterval(() => {
        // If a new session started, stop this one immediately
        if (sessionId !== typewriterSessionId) {
            return; 
        }

        if (text[i]) {
            element.textContent += text[i];
        }
        i++;
        
        if (i >= text.length) {
            clearInterval(typewriterInterval);
            if (sessionId === typewriterSessionId) {
                typewriterInterval = null;
            }
        }
    }, 30);
}

function playSound(audio) {
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 1;
    audio.play().catch(() => {});
}

function stopMusic() {
    [startSound, timerSound, celebrationSound].filter(s => s).forEach(s => {
        s.pause();
        s.currentTime = 0;
        s.ontimeupdate = null;
    });
}

function notify(msg) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const title = "Sourdough Master";
    const options = {
        body: msg,
        icon: "eyes_star.png",
        tag: "sourdough-progress", // Consistent tag prevents stacking
        renotify: false, // Prevents repeated vibration/sound for the same tag
        vibrate: [200, 100, 200]
    };

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, options);
        });
    } else {
        // Fallback for non-SW environments
        new Notification(title, options);
    }
}

init();
