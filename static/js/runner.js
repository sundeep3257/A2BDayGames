// Runner Game - Client-side implementation (Chrome Dino-style)
// Player = stick figure with selected character head, Obstacles = trees, birds, opponent character

(function() {
    'use strict';
    
    // Game configuration
    const CANVAS_WIDTH = 600;
    const CANVAS_HEIGHT = 200;
    const FPS = 60;
    const FRAME_TIME = 1000 / FPS;
    
    // Player properties
    const PLAYER_X = 100; // Fixed x position (like Dino)
    const PLAYER_HEAD_SIZE = 30;
    const PLAYER_BODY_HEIGHT = 50;
    const GROUND_Y = CANVAS_HEIGHT - 40;
    const PLAYER_Y_ON_GROUND = GROUND_Y; // Feet touch the ground
    
    // Physics
    const GRAVITY = 0.8;
    const JUMP_VELOCITY = -15;
    const MAX_JUMP_HEIGHT = 120;
    
    // Speed ramping
    const INITIAL_SPEED = 3;
    const MAX_SPEED = 12;
    const SPEED_RAMP_TIME = 60000; // 60 seconds to reach max speed
    const SPEED_INCREASE_RATE = (MAX_SPEED - INITIAL_SPEED) / SPEED_RAMP_TIME;
    
    // Obstacle properties
    const OPPONENT_SIZE = 35; // Size of each block
    const BLOCK_SPACING = 2; // Small gap between stacked blocks
    
    // Spawning
    const INITIAL_SPAWN_INTERVAL = 2000; // 2 seconds
    const MIN_SPAWN_INTERVAL = 800; // 0.8 seconds minimum
    const SPAWN_INTERVAL_DECREASE = (INITIAL_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) / SPEED_RAMP_TIME;
    
    // Get character from sessionStorage
    const selectedCharacter = sessionStorage.getItem('selectedCharacter') || 'Armando';
    const oppositeCharacter = selectedCharacter === 'Armando' ? 'Ananya' : 'Armando';
    
    // Canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const finalScoreDisplay = document.getElementById('finalScore');
    const bestScoreDisplay = document.getElementById('bestScore');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const readyOverlay = document.getElementById('readyOverlay');
    
    // Calculate canvas size (responsive, maintain aspect ratio)
    function resizeCanvas() {
        const maxWidth = Math.min(window.innerWidth - 40, CANVAS_WIDTH);
        const aspectRatio = CANVAS_HEIGHT / CANVAS_WIDTH;
        const width = maxWidth;
        const height = width * aspectRatio;
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Game state
    let player = {
        x: PLAYER_X,
        y: PLAYER_Y_ON_GROUND,
        vy: 0,
        onGround: true,
        isDucking: false,
        headImage: new Image(),
        legFrame: 0 // For running animation
    };
    
    let obstacles = [];
    let gameState = 'READY'; // READY, RUNNING, GAME_OVER
    let gameLoop = null;
    let lastFrameTime = 0;
    let gameStartTime = 0;
    let lastSpawnTime = 0;
    let score = 0;
    let currentSpeed = INITIAL_SPEED;
    let groundOffset = 0; // For scrolling ground
    
    // Image loading
    let opponentImage = new Image();
    let imagesLoaded = 0;
    
    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === 2) {
            // Images loaded, ready to start
        }
    }
    
    player.headImage.onload = onImageLoad;
    opponentImage.onload = onImageLoad;
    
    player.headImage.onerror = () => {
        console.warn('Player head image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 2) {}
    };
    opponentImage.onerror = () => {
        console.warn('Opponent image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 2) {}
    };
    
    // Load images
    player.headImage.src = `/static/graphics/${selectedCharacter}_head.png`;
    opponentImage.src = `/static/graphics/${oppositeCharacter}_head.png`;
    
    // If images are already cached
    if (player.headImage.complete && opponentImage.complete) {
        imagesLoaded = 2;
    }
    
    // Get best score from localStorage
    function getBestScore() {
        return parseInt(localStorage.getItem('runnerBestScore') || '0', 10);
    }
    
    // Save best score to localStorage
    function saveBestScore(score) {
        const best = getBestScore();
        if (score > best) {
            localStorage.setItem('runnerBestScore', score.toString());
            return score;
        }
        return best;
    }
    
    // Jump
    function jump() {
        if (gameState !== 'RUNNING') {
            if (gameState === 'READY') {
                startGame();
            }
            return;
        }
        
        if (player.onGround && !player.isDucking) {
            player.vy = JUMP_VELOCITY;
            player.onGround = false;
            player.isDucking = false; // Stop ducking when jumping
        }
    }
    
    // Duck
    function duck() {
        if (gameState !== 'RUNNING') return;
        
        if (player.onGround) {
            player.isDucking = true;
        }
    }
    
    // Stop ducking
    function stopDuck() {
        player.isDucking = false;
    }
    
    // Update player
    function updatePlayer() {
        if (gameState !== 'RUNNING') return;
        
        // Apply gravity
        player.vy += GRAVITY;
        player.y += player.vy;
        
        // Ground collision
        if (player.y >= PLAYER_Y_ON_GROUND) {
            player.y = PLAYER_Y_ON_GROUND;
            player.vy = 0;
            player.onGround = true;
        }
        
        // Running animation (alternate leg positions) - only when not ducking
        if (!player.isDucking) {
            player.legFrame = (player.legFrame + 0.2) % (Math.PI * 2);
        }
    }
    
    // Calculate current speed based on elapsed time
    function updateSpeed() {
        const elapsed = Date.now() - gameStartTime;
        currentSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + elapsed * SPEED_INCREASE_RATE);
    }
    
    // Calculate current spawn interval (with randomness for unpredictability)
    function getSpawnInterval() {
        const elapsed = Date.now() - gameStartTime;
        const baseInterval = Math.max(MIN_SPAWN_INTERVAL, INITIAL_SPAWN_INTERVAL - elapsed * SPAWN_INTERVAL_DECREASE);
        // Add randomness: ±40% variation
        const randomFactor = 0.6 + Math.random() * 0.8; // Range: 0.6 to 1.4
        return baseInterval * randomFactor;
    }
    
    // Spawn obstacle (only opponent character blocks)
    function spawnObstacle() {
        // Obstacle configurations:
        // 1. 1 block on ground
        // 2. 2 blocks stacked on ground
        // 3. 3 blocks stacked on ground
        // 4. 1 block floating
        // 5. 2 blocks floating
        
        const rand = Math.random();
        let obstacle;
        
        if (rand < 0.2) {
            // 1 block on ground (y is top of block)
            obstacle = {
                x: CANVAS_WIDTH,
                blocks: [{ y: GROUND_Y - OPPONENT_SIZE }],
                width: OPPONENT_SIZE,
                height: OPPONENT_SIZE,
                type: 'opponent'
            };
        } else if (rand < 0.4) {
            // 2 blocks stacked on ground
            obstacle = {
                x: CANVAS_WIDTH,
                blocks: [
                    { y: GROUND_Y - OPPONENT_SIZE },
                    { y: GROUND_Y - OPPONENT_SIZE * 2 - BLOCK_SPACING }
                ],
                width: OPPONENT_SIZE,
                height: OPPONENT_SIZE * 2 + BLOCK_SPACING,
                type: 'opponent'
            };
        } else if (rand < 0.6) {
            // 3 blocks stacked on ground
            obstacle = {
                x: CANVAS_WIDTH,
                blocks: [
                    { y: GROUND_Y - OPPONENT_SIZE },
                    { y: GROUND_Y - OPPONENT_SIZE * 2 - BLOCK_SPACING },
                    { y: GROUND_Y - OPPONENT_SIZE * 3 - BLOCK_SPACING * 2 }
                ],
                width: OPPONENT_SIZE,
                height: OPPONENT_SIZE * 3 + BLOCK_SPACING * 2,
                type: 'opponent'
            };
        } else if (rand < 0.8) {
            // 1 block floating
            const floatHeight = GROUND_Y - 60 - Math.random() * 20; // Float 40-60px above ground
            obstacle = {
                x: CANVAS_WIDTH,
                blocks: [{ y: floatHeight - OPPONENT_SIZE }],
                width: OPPONENT_SIZE,
                height: OPPONENT_SIZE,
                type: 'opponent',
                floating: true
            };
        } else {
            // 2 blocks floating
            const floatHeight = GROUND_Y - 60 - Math.random() * 20; // Float 40-60px above ground
            obstacle = {
                x: CANVAS_WIDTH,
                blocks: [
                    { y: floatHeight - OPPONENT_SIZE },
                    { y: floatHeight - OPPONENT_SIZE * 2 - BLOCK_SPACING }
                ],
                width: OPPONENT_SIZE,
                height: OPPONENT_SIZE * 2 + BLOCK_SPACING,
                type: 'opponent',
                floating: true
            };
        }
        
        obstacles.push(obstacle);
    }
    
    // Update obstacles
    function updateObstacles() {
        obstacles.forEach(obstacle => {
            obstacle.x -= currentSpeed;
        });
        
        // Remove off-screen obstacles
        obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > 0);
        
        // Spawn new obstacles
        const currentTime = Date.now();
        if (currentTime - lastSpawnTime >= getSpawnInterval()) {
            spawnObstacle();
            lastSpawnTime = currentTime;
        }
    }
    
    // Check collision between player and obstacle
    function checkCollision(player, obstacle) {
        // Player hitbox (adjust based on ducking state)
        let playerTop, playerBottom, playerLeft, playerRight;
        
        if (player.isDucking && player.onGround) {
            // When ducking, player is shorter
            playerTop = player.y - PLAYER_HEAD_SIZE / 2 - 20 + 5; // Reduced height when ducking
            playerBottom = player.y - 5;
            playerLeft = player.x - PLAYER_HEAD_SIZE / 2 + 5;
            playerRight = player.x + PLAYER_HEAD_SIZE / 2 - 5;
        } else {
            // Normal standing/jumping
            playerTop = player.y - PLAYER_BODY_HEIGHT - PLAYER_HEAD_SIZE / 2 + 5;
            playerBottom = player.y - 5;
            playerLeft = player.x - PLAYER_HEAD_SIZE / 2 + 5;
            playerRight = player.x + PLAYER_HEAD_SIZE / 2 - 5;
        }
        
        // Check collision with each block in the obstacle
        for (let block of obstacle.blocks) {
            const blockLeft = obstacle.x;
            const blockRight = obstacle.x + obstacle.width;
            const blockTop = block.y; // block.y is top of block
            const blockBottom = block.y + obstacle.width;
            
            if (!(playerRight < blockLeft || 
                  playerLeft > blockRight || 
                  playerBottom < blockTop || 
                  playerTop > blockBottom)) {
                return true; // Collision detected
            }
        }
        
        return false; // No collision
    }
    
    // Check collisions
    function checkCollisions() {
        obstacles.forEach(obstacle => {
            if (checkCollision(player, obstacle)) {
                gameOver();
            }
        });
    }
    
    // Update score
    function updateScore() {
        if (gameState !== 'RUNNING') return;
        
        const elapsed = Date.now() - gameStartTime;
        score = Math.floor(elapsed / 100); // Score increases with time
        scoreDisplay.textContent = score;
    }
    
    // Draw ground
    function drawGround() {
        // Ground line
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
        ctx.stroke();
        
        // Ground texture (subtle grid)
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.2)';
        ctx.lineWidth = 1;
        for (let x = (groundOffset % 20); x < CANVAS_WIDTH; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, GROUND_Y);
            ctx.lineTo(x, CANVAS_HEIGHT);
            ctx.stroke();
        }
        
        groundOffset += currentSpeed;
    }
    
    // Draw player (stick figure with character head)
    function drawPlayer() {
        const headX = player.x;
        let headY, bodyTop, bodyBottom;
        
        if (player.isDucking && player.onGround) {
            // Ducking position - lower head and shorter body
            headY = player.y - 20 - PLAYER_HEAD_SIZE / 2;
            bodyTop = headY + PLAYER_HEAD_SIZE / 2;
            bodyBottom = player.y - 5;
        } else {
            // Normal standing/jumping position
            headY = player.y - PLAYER_BODY_HEIGHT - PLAYER_HEAD_SIZE / 2;
            bodyTop = headY + PLAYER_HEAD_SIZE / 2;
            bodyBottom = player.y - 10;
        }
        
        // Draw body (stick figure)
        ctx.strokeStyle = '#ffe66d';
        ctx.lineWidth = 3;
        
        // Body line
        ctx.beginPath();
        ctx.moveTo(headX, bodyTop);
        ctx.lineTo(headX, bodyBottom);
        ctx.stroke();
        
        if (!player.isDucking || !player.onGround) {
            // Arms (only when not ducking)
            const armAngle = Math.sin(player.legFrame) * 0.3;
            ctx.beginPath();
            ctx.moveTo(headX, headY + 10);
            ctx.lineTo(headX - 15 - armAngle * 10, headY + 25);
            ctx.moveTo(headX, headY + 10);
            ctx.lineTo(headX + 15 + armAngle * 10, headY + 25);
            ctx.stroke();
        }
        
        // Legs (running animation when on ground, not ducking)
        if (player.onGround && !player.isDucking) {
            const legOffset = Math.sin(player.legFrame) * 8;
            ctx.beginPath();
            ctx.moveTo(headX, bodyBottom);
            ctx.lineTo(headX - 10 - legOffset, player.y);
            ctx.moveTo(headX, bodyBottom);
            ctx.lineTo(headX + 10 + legOffset, player.y);
            ctx.stroke();
        } else if (player.onGround && player.isDucking) {
            // Ducking legs (crouched position)
            ctx.beginPath();
            ctx.moveTo(headX, bodyBottom);
            ctx.lineTo(headX - 8, player.y);
            ctx.moveTo(headX, bodyBottom);
            ctx.lineTo(headX + 8, player.y);
            ctx.stroke();
        }
        
        // Draw head with character image
        if (player.headImage.complete && player.headImage.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(headX, headY, PLAYER_HEAD_SIZE / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
                player.headImage,
                headX - PLAYER_HEAD_SIZE / 2,
                headY - PLAYER_HEAD_SIZE / 2,
                PLAYER_HEAD_SIZE,
                PLAYER_HEAD_SIZE
            );
            ctx.restore();
        } else {
            // Fallback: circle
            ctx.fillStyle = '#ffe66d';
            ctx.beginPath();
            ctx.arc(headX, headY, PLAYER_HEAD_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw opponent character obstacle (multi-block)
    function drawOpponent(obstacle) {
        // Draw each block in the obstacle
        obstacle.blocks.forEach(block => {
            const blockY = block.y; // block.y is top of block
            
            if (opponentImage.complete && opponentImage.naturalWidth > 0) {
                ctx.drawImage(
                    opponentImage,
                    obstacle.x,
                    blockY,
                    obstacle.width,
                    obstacle.width
                );
            } else {
                // Fallback: circle
                ctx.fillStyle = '#ff6b9d';
                ctx.beginPath();
                ctx.arc(
                    obstacle.x + obstacle.width / 2,
                    blockY + obstacle.width / 2,
                    obstacle.width / 2,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
            
            // Outline
            ctx.strokeStyle = '#ff6b9d';
            ctx.lineWidth = 2;
            ctx.strokeRect(obstacle.x, blockY, obstacle.width, obstacle.width);
        });
    }
    
    // Draw obstacles
    function drawObstacles() {
        obstacles.forEach(obstacle => {
            if (obstacle.type === 'opponent') {
                drawOpponent(obstacle);
            }
        });
    }
    
    // Render game
    function render() {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw ground
        drawGround();
        
        // Draw obstacles
        drawObstacles();
        
        // Draw player
        drawPlayer();
    }
    
    // Game loop
    function gameLoopFunction(currentTime) {
        if (gameState !== 'RUNNING') return;
        
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        // Update game state
        updateSpeed();
        updatePlayer();
        updateObstacles();
        updateScore();
        checkCollisions();
        
        // Render
        render();
        
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Start game
    function startGame() {
        // Reset game state
        player.x = PLAYER_X;
        player.y = PLAYER_Y_ON_GROUND;
        player.vy = 0;
        player.onGround = true;
        player.isDucking = false;
        player.legFrame = 0;
        
        obstacles = [];
        score = 0;
        currentSpeed = INITIAL_SPEED;
        groundOffset = 0;
        
        gameStartTime = Date.now();
        lastSpawnTime = Date.now();
        
        gameState = 'RUNNING';
        readyOverlay.classList.add('hidden');
        gameOverOverlay.classList.remove('active');
        
        scoreDisplay.textContent = score;
        
        render();
        
        lastFrameTime = performance.now();
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Game over
    function gameOver() {
        gameState = 'GAME_OVER';
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
        }
        
        const best = saveBestScore(score);
        finalScoreDisplay.textContent = score;
        bestScoreDisplay.textContent = best;
        
        gameOverOverlay.classList.add('active');
    }
    
    // Restart game
    function restartGame() {
        gameState = 'READY';
        readyOverlay.classList.remove('hidden');
        gameOverOverlay.classList.remove('active');
        
        // Reset game state
        player.x = PLAYER_X;
        player.y = PLAYER_Y_ON_GROUND;
        player.vy = 0;
        player.onGround = true;
        player.isDucking = false;
        player.legFrame = 0;
        
        obstacles = [];
        score = 0;
        currentSpeed = INITIAL_SPEED;
        groundOffset = 0;
        
        scoreDisplay.textContent = score;
        
        render();
    }
    
    // Input handling
    function handleJump() {
        if (gameState === 'READY') {
            startGame();
        } else if (gameState === 'RUNNING') {
            jump();
        }
    }
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'ArrowUp') {
            e.preventDefault();
            handleJump();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            duck();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            stopDuck();
        }
    });
    
    // Mouse/touch controls
    let touchStartY = 0;
    let isTouching = false;
    
    canvas.addEventListener('click', (e) => {
        e.preventDefault();
        handleJump();
    });
    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isTouching = true;
        touchStartY = e.touches[0].clientY;
        handleJump(); // Default to jump on tap
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isTouching && e.touches[0].clientY > touchStartY + 20) {
            // Swipe down = duck
            duck();
        }
    });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        isTouching = false;
        stopDuck();
    });
    
    // Prevent scrolling on canvas
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    // Ready overlay touch/click handlers (for mobile start screen)
    readyOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (gameState === 'READY') {
            startGame();
        }
    });
    
    readyOverlay.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (gameState === 'READY') {
            startGame();
        }
    });
    
    readyOverlay.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    // Restart button
    document.getElementById('restartButton').addEventListener('click', restartGame);
    
    // Mobile control buttons
    const jumpButton = document.getElementById('jumpButton');
    const duckButton = document.getElementById('duckButton');
    
    // Jump button handlers
    jumpButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleJump();
    });
    
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleJump();
    });
    
    // Duck button handlers
    duckButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (gameState === 'READY') {
            startGame();
        } else if (gameState === 'RUNNING') {
            duck();
        }
    });
    
    duckButton.addEventListener('mouseup', (e) => {
        e.preventDefault();
        stopDuck();
    });
    
    duckButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'READY') {
            startGame();
        } else if (gameState === 'RUNNING') {
            duck();
        }
    });
    
    duckButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopDuck();
    });
    
    duckButton.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        stopDuck();
    });
    
    // Prevent button text selection
    jumpButton.addEventListener('selectstart', (e) => {
        e.preventDefault();
    });
    
    duckButton.addEventListener('selectstart', (e) => {
        e.preventDefault();
    });
    
    // Initialize
    const best = getBestScore();
    bestScoreDisplay.textContent = best;
    render();
    
})();
