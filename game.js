// Game Constants
const GAME_CONSTANTS = {
    POWERUP_LIFETIME: 300, // frames
    POWERUP_SPAWN_CHANCE: 0.2,
    POWERUP_MAX_COUNT: 1,
    TOUCH_SENSITIVITY: 0.5,
    ONLINE_CONNECTION_DELAY: 1000 // ms
};

// Game State
const game = {
    canvas: null,
    ctx: null,
    width: 800,
    height: 600,
    running: false,
    paused: false,
    mode: 'single', // single, local, online
    gameMode: 'classic', // classic, speed, powerup, reverse
    difficulty: 'medium',
    soundEnabled: true,
    musicEnabled: true,
    
    // Game objects
    ball: null,
    paddle1: null,
    paddle2: null,
    powerUps: [],
    activePowerUp: null,
    
    // Scores
    score1: 0,
    score2: 0,
    winScore: 7,
    
    // Online
    socket: null,
    roomCode: null,
    isHost: false,
    
    // Touch controls
    touches: {
        player1: { active: false, startY: 0, currentY: 0 },
        player2: { active: false, startY: 0, currentY: 0 }
    }
};

// Audio Context (for retro sound effects)
class SoundEngine {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.init();
    }
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playBeep(frequency = 440, duration = 0.1, volume = 0.3) {
        if (!this.enabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    paddleHit() {
        this.playBeep(220, 0.1, 0.3);
    }
    
    wallHit() {
        this.playBeep(330, 0.05, 0.2);
    }
    
    score() {
        this.playBeep(440, 0.2, 0.3);
        setTimeout(() => this.playBeep(554, 0.2, 0.3), 100);
    }
    
    powerUp() {
        this.playBeep(660, 0.15, 0.25);
        setTimeout(() => this.playBeep(880, 0.15, 0.25), 80);
        setTimeout(() => this.playBeep(1100, 0.15, 0.25), 160);
    }
    
    gameOver() {
        const notes = [440, 392, 349, 330];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playBeep(freq, 0.3, 0.3), i * 200);
        });
    }
}

const soundEngine = new SoundEngine();

// Game Objects
class Ball {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = game.width / 2;
        this.y = game.height / 2;
        this.radius = 8;
        this.speedX = 5 * (Math.random() > 0.5 ? 1 : -1);
        this.speedY = 5 * (Math.random() * 2 - 1);
        this.maxSpeed = game.gameMode === 'speed' ? 15 : 10;
        this.color = '#ff006e';
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Wall collision
        if (this.y - this.radius <= 0 || this.y + this.radius >= game.height) {
            this.speedY = -this.speedY;
            soundEngine.wallHit();
        }
        
        // Paddle collision
        if (this.checkPaddleCollision(game.paddle1)) {
            this.handlePaddleHit(game.paddle1);
        }
        if (this.checkPaddleCollision(game.paddle2)) {
            this.handlePaddleHit(game.paddle2);
        }
        
        // Score
        if (this.x - this.radius < 0) {
            game.score2++;
            soundEngine.score();
            this.reset();
            updateScore();
            checkWin();
        }
        if (this.x + this.radius > game.width) {
            game.score1++;
            soundEngine.score();
            this.reset();
            updateScore();
            checkWin();
        }
    }
    
    checkPaddleCollision(paddle) {
        return this.x - this.radius < paddle.x + paddle.width &&
               this.x + this.radius > paddle.x &&
               this.y - this.radius < paddle.y + paddle.height &&
               this.y + this.radius > paddle.y;
    }
    
    handlePaddleHit(paddle) {
        const hitPos = (this.y - paddle.y) / paddle.height - 0.5;
        this.speedY = hitPos * 10;
        this.speedX = -this.speedX * 1.05;
        
        // Speed cap
        if (Math.abs(this.speedX) > this.maxSpeed) {
            this.speedX = this.maxSpeed * Math.sign(this.speedX);
        }
        
        soundEngine.paddleHit();
        
        // Spawn power-up occasionally in powerup mode
        if (game.gameMode === 'powerup' && Math.random() < GAME_CONSTANTS.POWERUP_SPAWN_CHANCE && game.powerUps.length < GAME_CONSTANTS.POWERUP_MAX_COUNT) {
            game.powerUps.push(new PowerUp());
        }
    }
    
    draw() {
        game.ctx.fillStyle = this.color;
        game.ctx.shadowBlur = 15;
        game.ctx.shadowColor = this.color;
        game.ctx.beginPath();
        game.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        game.ctx.fill();
        game.ctx.shadowBlur = 0;
    }
}

class Paddle {
    constructor(x, isLeft = true) {
        this.x = x;
        this.y = game.height / 2 - 50;
        this.width = 12;
        this.height = 100;
        this.speed = 8;
        this.isLeft = isLeft;
        this.color = isLeft ? '#00f5ff' : '#8b00ff';
        this.targetY = this.y;
        this.isAI = false;
    }
    
    update() {
        if (this.isAI) {
            this.updateAI();
        } else {
            this.y = this.targetY;
        }
        
        // Keep paddle in bounds
        if (this.y < 0) this.y = 0;
        if (this.y + this.height > game.height) this.y = game.height - this.height;
    }
    
    updateAI() {
        const difficulty = {
            easy: 0.03,
            medium: 0.05,
            hard: 0.08
        };
        const speed = difficulty[game.difficulty] || 0.05;
        
        // Predict ball position
        const targetY = game.ball.y - this.height / 2;
        
        // Add some randomness for lower difficulties
        const randomFactor = game.difficulty === 'easy' ? 40 : (game.difficulty === 'medium' ? 20 : 5);
        const adjustedTarget = targetY + (Math.random() - 0.5) * randomFactor;
        
        // Move towards target
        const diff = adjustedTarget - this.y;
        this.y += diff * speed;
    }
    
    moveUp() {
        const reverse = game.gameMode === 'reverse';
        this.targetY += reverse ? this.speed : -this.speed;
        if (this.targetY < 0) this.targetY = 0;
        if (this.targetY + this.height > game.height) this.targetY = game.height - this.height;
    }
    
    moveDown() {
        const reverse = game.gameMode === 'reverse';
        this.targetY += reverse ? -this.speed : this.speed;
        if (this.targetY < 0) this.targetY = 0;
        if (this.targetY + this.height > game.height) this.targetY = game.height - this.height;
    }
    
    draw() {
        game.ctx.fillStyle = this.color;
        game.ctx.shadowBlur = 10;
        game.ctx.shadowColor = this.color;
        game.ctx.fillRect(this.x, this.y, this.width, this.height);
        game.ctx.shadowBlur = 0;
    }
}

class PowerUp {
    constructor() {
        this.x = game.width / 2 + (Math.random() - 0.5) * 200;
        this.y = Math.random() * (game.height - 40) + 20;
        this.radius = 12;
        this.type = ['speed', 'size', 'slow'][Math.floor(Math.random() * 3)];
        this.color = '#ff9500';
        this.lifetime = GAME_CONSTANTS.POWERUP_LIFETIME;
    }
    
    update() {
        this.lifetime--;
        
        // Check collision with ball
        const dx = this.x - game.ball.x;
        const dy = this.y - game.ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.radius + game.ball.radius) {
            this.activate();
            return true; // Remove this power-up
        }
        
        return this.lifetime <= 0; // Remove if expired
    }
    
    activate() {
        game.activePowerUp = {
            type: this.type,
            duration: 180 // frames
        };
        
        soundEngine.powerUp();
        showPowerUpIndicator(this.type);
        
        if (this.type === 'speed') {
            game.ball.speedX *= 1.5;
            game.ball.speedY *= 1.5;
        } else if (this.type === 'size') {
            game.paddle1.height *= 1.5;
            game.paddle2.height *= 1.5;
        } else if (this.type === 'slow') {
            game.ball.speedX *= 0.5;
            game.ball.speedY *= 0.5;
        }
    }
    
    draw() {
        game.ctx.fillStyle = this.color;
        game.ctx.shadowBlur = 15;
        game.ctx.shadowColor = this.color;
        game.ctx.beginPath();
        game.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        game.ctx.fill();
        
        // Draw symbol
        game.ctx.fillStyle = '#000';
        game.ctx.font = '12px monospace';
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        const symbol = this.type === 'speed' ? '⚡' : this.type === 'size' ? '↕' : '⏱';
        game.ctx.fillText(symbol, this.x, this.y);
        game.ctx.shadowBlur = 0;
    }
}

// UI Functions
function showMenu(menuId) {
    document.querySelectorAll('.menu').forEach(m => m.classList.remove('active'));
    document.getElementById(menuId).classList.add('active');
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('touch-controls').classList.remove('active');
}

function showGame() {
    document.querySelectorAll('.menu').forEach(m => m.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    // Ensure canvas is properly sized after becoming visible
    resizeCanvas();
    
    // Show touch controls on mobile
    if ('ontouchstart' in window) {
        document.getElementById('touch-controls').classList.add('active');
    }
}

function updateScore() {
    document.getElementById('player1-score').textContent = game.score1;
    document.getElementById('player2-score').textContent = game.score2;
}

function showPowerUpIndicator(type) {
    const indicator = document.getElementById('power-up-indicator');
    const text = type === 'speed' ? 'SPEED BOOST!' : type === 'size' ? 'PADDLE GROW!' : 'SLOW MOTION!';
    indicator.textContent = text;
    indicator.style.display = 'block';
    
    setTimeout(() => {
        indicator.style.display = 'none';
    }, 2000);
}

function checkWin() {
    if (game.score1 >= game.winScore || game.score2 >= game.winScore) {
        endGame();
    }
}

function endGame() {
    game.running = false;
    const winner = game.score1 > game.score2 ? 'Player 1' : 'Player 2';
    
    document.getElementById('game-over-title').textContent = `${winner} Wins!`;
    document.getElementById('game-over-stats').innerHTML = `
        <p style="font-size: 1.5rem; color: var(--neon-pink);">Final Score</p>
        <p style="font-size: 2rem; margin: 1rem 0;">
            <span style="color: var(--neon-blue);">${game.score1}</span>
            <span style="color: var(--neon-purple);"> - </span>
            <span style="color: var(--neon-purple);">${game.score2}</span>
        </p>
    `;
    
    // Show name entry if it's a high score (single player only)
    if (game.mode === 'single' && game.score1 >= game.winScore) {
        const highScores = getHighScores();
        if (highScores.length < 10 || game.score1 > highScores[highScores.length - 1].score) {
            document.getElementById('name-entry').style.display = 'block';
        }
    }
    
    soundEngine.gameOver();
    showMenu('game-over');
}

// Game Loop
function gameLoop() {
    if (!game.running || game.paused) return;
    
    // Clear canvas
    game.ctx.fillStyle = '#0a0015';
    game.ctx.fillRect(0, 0, game.width, game.height);
    
    // Draw center line
    game.ctx.strokeStyle = '#2d1b4e';
    game.ctx.lineWidth = 2;
    game.ctx.setLineDash([10, 10]);
    game.ctx.beginPath();
    game.ctx.moveTo(game.width / 2, 0);
    game.ctx.lineTo(game.width / 2, game.height);
    game.ctx.stroke();
    game.ctx.setLineDash([]);
    
    // Update and draw game objects
    if (game.mode === 'online' && !game.isHost) {
        // Guest: do not simulate locally; state comes from host
    } else {
        game.ball.update();
        game.paddle1.update();
        game.paddle2.update();
    }

    // Draw current state
    game.ball.draw();
    game.paddle1.draw();
    game.paddle2.draw();

    // Host: broadcast state to guest
    if (game.mode === 'online' && game.isHost && game.socket && game.socket.readyState === 1) {
        try {
            game.socket.send(JSON.stringify({
                type: 'state',
                roomCode: game.roomCode,
                state: {
                    ball: { x: game.ball.x, y: game.ball.y },
                    paddles: { p1: { y: game.paddle1.y }, p2: { y: game.paddle2.y } },
                    scores: { s1: game.score1, s2: game.score2 }
                }
            }));
        } catch (e) { /* ignore send errors */ }
    }
    
    // Update power-ups
    if (game.gameMode === 'powerup') {
        game.powerUps = game.powerUps.filter(powerUp => {
            const shouldRemove = powerUp.update();
            if (!shouldRemove) powerUp.draw();
            return !shouldRemove;
        });
        
        // Update active power-up duration
        if (game.activePowerUp) {
            game.activePowerUp.duration--;
            if (game.activePowerUp.duration <= 0) {
                // Reset power-up effects
                if (game.activePowerUp.type === 'size') {
                    game.paddle1.height = 100;
                    game.paddle2.height = 100;
                }
                game.activePowerUp = null;
            }
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Initialize game
function initGame() {
    game.canvas = document.getElementById('game-canvas');
    game.ctx = game.canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    game.ball = new Ball();
    game.paddle1 = new Paddle(20, true);
    game.paddle2 = new Paddle(game.width - 32, false);
    
    setupControls();
    setupMenus();
}

function resizeCanvas() {
    const container = game.canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Maintain aspect ratio
    const aspectRatio = 4 / 3;
    let canvasWidth = containerWidth;
    let canvasHeight = containerHeight;
    
    if (canvasWidth / canvasHeight > aspectRatio) {
        canvasWidth = canvasHeight * aspectRatio;
    } else {
        canvasHeight = canvasWidth / aspectRatio;
    }
    
    // Set internal canvas resolution
    game.canvas.width = game.width;
    game.canvas.height = game.height;
    
    // Scale canvas display size via CSS
    game.canvas.style.width = canvasWidth + 'px';
    game.canvas.style.height = canvasHeight + 'px';
}

function startGame(mode, gameMode) {
    game.mode = mode;
    game.gameMode = gameMode || 'classic';
    game.score1 = 0;
    game.score2 = 0;
    game.running = true;
    game.paused = false;
    game.powerUps = [];
    game.activePowerUp = null;
    
    // Reset game objects
    game.ball = new Ball();
    game.paddle1 = new Paddle(20, true);
    game.paddle2 = new Paddle(game.width - 32, false);
    
    // Set AI for single player
    if (mode === 'single') {
        game.paddle2.isAI = true;
    } else {
        game.paddle2.isAI = false;
    }
    
    updateScore();
    showGame();
    gameLoop();
}

// Controls
function setupControls() {
    // Keyboard controls
    const keys = {};
    
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        
        if (e.key === 'Escape' && game.running) {
            togglePause();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    
    // Update paddle positions based on keys
    function updateKeyboardControls() {
        if (!game.running || game.paused) return;

        // Online guest: send inputs to host instead of local movement
        if (game.mode === 'online' && !game.isHost && game.socket && game.socket.readyState === 1) {
            if (keys['ArrowUp'] || keys['w'] || keys['W']) {
                try { game.socket.send(JSON.stringify({ type: 'input', roomCode: game.roomCode, input: 'up' })); } catch (e) {}
            }
            if (keys['ArrowDown'] || keys['s'] || keys['S']) {
                try { game.socket.send(JSON.stringify({ type: 'input', roomCode: game.roomCode, input: 'down' })); } catch (e) {}
            }
        } else {
            // Player 1 controls (W/S and Arrow keys when not in local)
            if (keys['w'] || keys['W'] || (game.mode !== 'local' && keys['ArrowUp'])) game.paddle1.moveUp();
            if (keys['s'] || keys['S'] || (game.mode !== 'local' && keys['ArrowDown'])) game.paddle1.moveDown();

            // Player 2 controls (Arrow keys) - only in local multiplayer
            if (game.mode === 'local') {
                if (keys['ArrowUp']) game.paddle2.moveUp();
                if (keys['ArrowDown']) game.paddle2.moveDown();
            }
        }
        
        requestAnimationFrame(updateKeyboardControls);
    }
    updateKeyboardControls();
    
    // Touch controls
    const leftTouch = document.getElementById('left-touch');
    const rightTouch = document.getElementById('right-touch');
    
    function handleTouchStart(e, player) {
        e.preventDefault();
        const touch = e.touches[0];
        game.touches[player].active = true;
        game.touches[player].startY = touch.clientY;
        game.touches[player].currentY = touch.clientY;
    }
    
    function handleTouchMove(e, player) {
        e.preventDefault();
        if (!game.touches[player].active) return;
        const touch = e.touches[0];
        game.touches[player].currentY = touch.clientY;
        
        // Update paddle position
        const paddle = player === 'player1' ? game.paddle1 : game.paddle2;
        const deltaY = touch.clientY - game.touches[player].startY;
        paddle.targetY += deltaY * GAME_CONSTANTS.TOUCH_SENSITIVITY;
        game.touches[player].startY = touch.clientY;
    }
    
    function handleTouchEnd(e, player) {
        e.preventDefault();
        game.touches[player].active = false;
    }
    
    leftTouch.addEventListener('touchstart', (e) => handleTouchStart(e, 'player1'));
    leftTouch.addEventListener('touchmove', (e) => handleTouchMove(e, 'player1'));
    leftTouch.addEventListener('touchend', (e) => handleTouchEnd(e, 'player1'));
    
    rightTouch.addEventListener('touchstart', (e) => handleTouchStart(e, 'player2'));
    rightTouch.addEventListener('touchmove', (e) => handleTouchMove(e, 'player2'));
    rightTouch.addEventListener('touchend', (e) => handleTouchEnd(e, 'player2'));
}

function togglePause() {
    game.paused = !game.paused;
    if (game.paused) {
        showMenu('pause-menu');
    } else {
        showGame();
        gameLoop();
    }
}

// Menu handlers
function setupMenus() {
    // Main menu buttons
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            game.mode = mode;
            
            if (mode === 'online') {
                showMenu('online-menu');
            } else {
                showMenu('mode-menu');
            }
        });
    });
    
    // Game mode buttons
    document.querySelectorAll('[data-gamemode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const gameMode = btn.dataset.gamemode;
            startGame(game.mode, gameMode);
        });
    });
    
    // Leaderboard button
    document.getElementById('leaderboard-btn').addEventListener('click', () => {
        showMenu('leaderboard-menu');
        loadLeaderboard();
    });
    
    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
        showMenu('settings-menu');
        loadSettings();
    });
    
    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showMenu('main-menu');
        });
    });
    
    // Pause menu buttons
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    document.getElementById('restart-btn').addEventListener('click', () => {
        startGame(game.mode, game.gameMode);
    });
    document.getElementById('quit-btn').addEventListener('click', () => {
        game.running = false;
        showMenu('main-menu');
    });
    
    // Game over buttons
    document.getElementById('play-again-btn').addEventListener('click', () => {
        startGame(game.mode, game.gameMode);
    });
    document.getElementById('menu-btn').addEventListener('click', () => {
        showMenu('main-menu');
    });
    
    // Submit score button
    document.getElementById('submit-score-btn').addEventListener('click', submitScore);
    
    // Settings
    document.getElementById('sound-toggle').addEventListener('change', (e) => {
        game.soundEnabled = e.target.checked;
        soundEngine.enabled = e.target.checked;
        localStorage.setItem('soundEnabled', e.target.checked);
    });
    
    document.getElementById('music-toggle').addEventListener('change', (e) => {
        game.musicEnabled = e.target.checked;
        localStorage.setItem('musicEnabled', e.target.checked);
    });
    
    document.getElementById('difficulty-select').addEventListener('change', (e) => {
        game.difficulty = e.target.value;
        localStorage.setItem('difficulty', e.target.value);
    });
    
    // Leaderboard tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.leaderboard-list').forEach(list => list.classList.remove('active'));
            document.getElementById(`${btn.dataset.tab}-leaderboard`).classList.add('active');
            
            if (btn.dataset.tab === 'global') {
                loadGlobalLeaderboard();
            }
        });
    });
    
    // Online multiplayer
    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    document.getElementById('join-room-btn').addEventListener('click', joinRoom);
}

// Leaderboard functions
function getHighScores() {
    const scores = localStorage.getItem('highScores');
    return scores ? JSON.parse(scores) : [];
}

function saveHighScore(name, score) {
    const highScores = getHighScores();
    highScores.push({ name, score, date: new Date().toISOString() });
    highScores.sort((a, b) => b.score - a.score);
    highScores.splice(10); // Keep top 10
    localStorage.setItem('highScores', JSON.stringify(highScores));
}

function loadLeaderboard() {
    const highScores = getHighScores();
    const localLeaderboard = document.getElementById('local-leaderboard');
    
    if (highScores.length === 0) {
        localLeaderboard.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--neon-purple);">No scores yet!</p>';
        return;
    }
    
    localLeaderboard.innerHTML = highScores.map((score, index) => `
        <div class="leaderboard-item">
            <span class="leaderboard-rank">#${index + 1}</span>
            <span class="leaderboard-name">${score.name}</span>
            <span class="leaderboard-score">${score.score}</span>
        </div>
    `).join('');
}

function loadGlobalLeaderboard() {
    const globalLeaderboard = document.getElementById('global-leaderboard');
    globalLeaderboard.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--neon-purple);">Online leaderboard coming soon!</p>';
}

function submitScore() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) return;
    
    saveHighScore(name, game.score1);
    document.getElementById('name-entry').style.display = 'none';
}

function loadSettings() {
    const soundEnabled = localStorage.getItem('soundEnabled');
    const musicEnabled = localStorage.getItem('musicEnabled');
    const difficulty = localStorage.getItem('difficulty');
    
    if (soundEnabled !== null) {
        document.getElementById('sound-toggle').checked = soundEnabled === 'true';
        game.soundEnabled = soundEnabled === 'true';
        soundEngine.enabled = soundEnabled === 'true';
    }
    
    if (musicEnabled !== null) {
        document.getElementById('music-toggle').checked = musicEnabled === 'true';
        game.musicEnabled = musicEnabled === 'true';
    }
    
    if (difficulty) {
        document.getElementById('difficulty-select').value = difficulty;
        game.difficulty = difficulty;
    }
}

// Online multiplayer (WebSocket implementation)
function setupSocketHandlers() {
    if (!game.socket) return;
    game.socket.onmessage = (evt) => {
        try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'created') {
                document.getElementById('room-status').innerHTML = `
                    <p style="color: var(--neon-blue);">Room Created!</p>
                    <p style="font-size: 1.5rem; color: var(--neon-pink); margin: 1rem 0;">${msg.roomCode}</p>
                    <p style="color: var(--neon-orange);">Waiting for opponent...</p>
                `;
            } else if (msg.type === 'joined') {
                document.getElementById('room-status').innerHTML = `
                    <p style="color: var(--neon-blue);">Joined room ${msg.roomCode}</p>
                    <p style="color: var(--neon-orange);">Waiting for host to start...</p>
                `;
            } else if (msg.type === 'start') {
                document.getElementById('room-status').innerHTML = `
                    <p style="color: var(--neon-blue);">Connected!</p>
                    <p style="color: var(--neon-purple);">Game starting...</p>
                `;
                startGame('online', 'classic');
            } else if (msg.type === 'state' && game.mode === 'online' && !game.isHost) {
                const st = msg.state;
                if (st.ball) { game.ball.x = st.ball.x; game.ball.y = st.ball.y; }
                if (st.paddles) {
                    if (st.paddles.p1) game.paddle1.y = st.paddles.p1.y;
                    if (st.paddles.p2) game.paddle2.y = st.paddles.p2.y;
                }
                if (st.scores) {
                    game.score1 = st.scores.s1;
                    game.score2 = st.scores.s2;
                    updateScore();
                }
            } else if (msg.type === 'input' && game.mode === 'online' && game.isHost) {
                if (msg.input === 'up') game.paddle2.moveUp();
                else if (msg.input === 'down') game.paddle2.moveDown();
            } else if (msg.type === 'error') {
                document.getElementById('room-status').innerHTML = `
                    <p style="color: var(--neon-orange);">${msg.message}</p>
                `;
            }
        } catch (e) {
            // ignore malformed messages
        }
    };
}

function connectSocket(roomCode, isHost) {
    try {
        game.socket = new WebSocket('ws://localhost:8080');
        game.socket.onopen = () => {
            const payload = isHost ? { type: 'create', roomCode } : { type: 'join', roomCode };
            try { game.socket.send(JSON.stringify(payload)); } catch (e) {}
            setupSocketHandlers();
        };
        game.socket.onerror = () => {
            document.getElementById('room-status').innerHTML = `
                <p style="color: var(--neon-orange);">Unable to connect to server.</p>
                <p style="color: var(--neon-purple);">Start the WebSocket server and retry.</p>
            `;
        };
        game.socket.onclose = () => {
            // Optionally inform user
        };
    } catch (e) {
        document.getElementById('room-status').innerHTML = `
            <p style="color: var(--neon-orange);">WebSocket not supported or blocked.</p>
        `;
    }
}

function createRoom() {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    game.roomCode = roomCode;
    game.isHost = true;
    document.getElementById('room-status').innerHTML = `
        <p style="color: var(--neon-blue);">Creating room...</p>
    `;
    connectSocket(roomCode, true);
}

function joinRoom() {
    const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
    if (!roomCode) return;
    game.roomCode = roomCode;
    game.isHost = false;
    document.getElementById('room-status').innerHTML = `
        <p style="color: var(--neon-blue);">Connecting to room ${roomCode}...</p>
    `;
    connectSocket(roomCode, false);
}

// Initialize on load
window.addEventListener('load', () => {
    initGame();
    loadSettings();
});
