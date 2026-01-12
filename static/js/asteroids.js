// Asteroids Game - Client-side implementation
// Player = selected character, Opponent asteroids = opposite character

(function() {
    'use strict';
    
    // Game configuration
    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 600;
    const FPS = 60;
    const FRAME_TIME = 1000 / FPS;
    
    // Player properties
    const PLAYER_SIZE = 40;
    const PLAYER_SPEED = 5;
    const PLAYER_MARGIN_BOTTOM = 30;
    
    // Laser properties
    const LASER_SPEED = 8;
    const LASER_WIDTH = 4;
    const LASER_HEIGHT = 15;
    const LASER_COOLDOWN = 250; // 0.25 seconds in milliseconds
    
    // Asteroid properties
    const ASTEROID_SIZE = 150; // 3x larger (was 50)
    const ASTEROID_SPEED = 0.5; // 4x slower (was 2) - constant speed for all asteroids
    const REGULAR_ASTEROID_HP = 10;
    const OPPONENT_ASTEROID_HP = 20;
    
    // Spawn configuration
    const SPAWN_INTERVAL = 5000; // Fixed spawn interval: 5 seconds
    
    // Asteroid type probabilities
    const REGULAR_ASTEROID_PROBABILITY = 0.7; // 70% regular, 30% opponent
    
    // Get character from sessionStorage
    const selectedCharacter = sessionStorage.getItem('selectedCharacter') || 'Armando';
    const oppositeCharacter = selectedCharacter === 'Armando' ? 'Ananya' : 'Armando';
    
    // Canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const finalScoreDisplay = document.getElementById('finalScore');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    
    // Calculate canvas size (responsive)
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
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - PLAYER_MARGIN_BOTTOM,
        size: PLAYER_SIZE,
        image: new Image(),
        direction: 0 // -1 = left, 1 = right, 0 = stationary
    };
    
    let lasers = [];
    let asteroids = [];
    let score = 0;
    let gameRunning = false;
    let gameLoop = null;
    let lastFrameTime = 0;
    let lastLaserTime = 0;
    let lastSpawnTime = 0;
    let gameStartTime = 0;
    let keysPressed = new Set();
    let nextSpawnIsPair = true; // Track if next spawn should be a pair
    
    // Image loading
    let regularAsteroidImage = new Image();
    let opponentAsteroidImage = new Image();
    let imagesLoaded = 0;
    
    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === 3) {
            startGame();
        }
    }
    
    player.image.onload = onImageLoad;
    regularAsteroidImage.onload = onImageLoad;
    opponentAsteroidImage.onload = onImageLoad;
    
    player.image.onerror = () => {
        console.warn('Player image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 3) startGame();
    };
    regularAsteroidImage.onerror = () => {
        console.warn('Regular asteroid image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 3) startGame();
    };
    opponentAsteroidImage.onerror = () => {
        console.warn('Opponent asteroid image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 3) startGame();
    };
    
    // Load images
    player.image.src = `/static/graphics/${selectedCharacter}_head.png`;
    regularAsteroidImage.src = `/static/graphics/asteroid.png`;
    opponentAsteroidImage.src = `/static/graphics/${oppositeCharacter}_head.png`;
    
    // If images are already cached
    if (player.image.complete && regularAsteroidImage.complete && opponentAsteroidImage.complete) {
        imagesLoaded = 3;
        startGame();
    }
    
    // Spawn asteroid
    function spawnAsteroid(startY = null) {
        const x = Math.random() * (CANVAS_WIDTH - ASTEROID_SIZE) + ASTEROID_SIZE / 2;
        const isOpponent = Math.random() > REGULAR_ASTEROID_PROBABILITY;
        const y = startY !== null ? startY : -ASTEROID_SIZE;
        
        asteroids.push({
            x: x,
            y: y,
            size: ASTEROID_SIZE,
            hp: isOpponent ? OPPONENT_ASTEROID_HP : REGULAR_ASTEROID_HP,
            maxHp: isOpponent ? OPPONENT_ASTEROID_HP : REGULAR_ASTEROID_HP,
            isOpponent: isOpponent,
            speed: ASTEROID_SPEED // Constant speed for all asteroids
        });
    }
    
    // Update player
    function updatePlayer() {
        // Determine direction from keys
        let direction = 0;
        if (keysPressed.has('ArrowLeft') || keysPressed.has('a') || keysPressed.has('A')) {
            direction = -1;
        } else if (keysPressed.has('ArrowRight') || keysPressed.has('d') || keysPressed.has('D')) {
            direction = 1;
        }
        
        player.direction = direction;
        
        // Move player
        player.x += direction * PLAYER_SPEED;
        
        // Keep player within bounds
        player.x = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_WIDTH - PLAYER_SIZE / 2, player.x));
    }
    
    // Fire laser
    function fireLaser() {
        const currentTime = Date.now();
        if (currentTime - lastLaserTime >= LASER_COOLDOWN) {
            lasers.push({
                x: player.x,
                y: player.y - PLAYER_SIZE / 2,
                width: LASER_WIDTH,
                height: LASER_HEIGHT
            });
            lastLaserTime = currentTime;
        }
    }
    
    // Update lasers
    function updateLasers() {
        // Auto-fire (continuous shooting)
        fireLaser();
        
        // Move lasers upward
        lasers = lasers.filter(laser => {
            laser.y -= LASER_SPEED;
            return laser.y + laser.height > 0; // Remove if off-screen
        });
    }
    
    // Update asteroids
    function updateAsteroids() {
        asteroids.forEach(asteroid => {
            asteroid.y += asteroid.speed;
        });
        
        // Remove asteroids that are off-screen
        asteroids = asteroids.filter(asteroid => asteroid.y < CANVAS_HEIGHT + ASTEROID_SIZE);
    }
    
    // Check collision between laser and asteroid
    function checkLaserAsteroidCollision(laser, asteroid) {
        return laser.x < asteroid.x + asteroid.size / 2 &&
               laser.x + laser.width > asteroid.x - asteroid.size / 2 &&
               laser.y < asteroid.y + asteroid.size / 2 &&
               laser.y + laser.height > asteroid.y - asteroid.size / 2;
    }
    
    // Check collision between player and asteroid
    function checkPlayerAsteroidCollision(player, asteroid) {
        const dx = player.x - asteroid.x;
        const dy = player.y - asteroid.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (player.size / 2 + asteroid.size / 2);
    }
    
    // Check collisions
    function checkCollisions() {
        // Laser vs Asteroid collisions
        lasers = lasers.filter(laser => {
            let hit = false;
            asteroids = asteroids.map(asteroid => {
                if (!hit && checkLaserAsteroidCollision(laser, asteroid)) {
                    asteroid.hp -= 1;
                    hit = true;
                    
                    // If asteroid destroyed, add score
                    if (asteroid.hp <= 0) {
                        score += 10;
                        scoreDisplay.textContent = score;
                        return null; // Mark for removal
                    }
                }
                return asteroid;
            }).filter(a => a !== null);
            
            return !hit; // Remove laser if it hit
        });
        
        // Check if any asteroid reached player level
        asteroids.forEach(asteroid => {
            // Game over if asteroid bottom edge reaches player y position
            if (asteroid.y + asteroid.size / 2 >= player.y) {
                gameOver();
                return;
            }
            
            // Optional: also check direct collision
            if (checkPlayerAsteroidCollision(player, asteroid)) {
                gameOver();
                return;
            }
        });
    }
    
    // Update asteroid spawning
    function updateSpawning() {
        const currentTime = Date.now();
        
        if (currentTime - lastSpawnTime >= SPAWN_INTERVAL) {
            if (nextSpawnIsPair) {
                // Spawn asteroids in pairs, offset vertically (both from top)
                spawnAsteroid(-ASTEROID_SIZE); // First asteroid starts at top
                spawnAsteroid(-ASTEROID_SIZE + 100); // Second asteroid starts slightly below first
            } else {
                // Spawn single asteroid
                spawnAsteroid();
            }
            // Toggle for next spawn
            nextSpawnIsPair = !nextSpawnIsPair;
            lastSpawnTime = currentTime;
        }
    }
    
    // Draw player
    function drawPlayer() {
        if (player.image.complete && player.image.naturalWidth > 0) {
            ctx.drawImage(
                player.image,
                player.x - player.size / 2,
                player.y - player.size / 2,
                player.size,
                player.size
            );
        } else {
            // Fallback triangle
            ctx.fillStyle = '#ffe66d';
            ctx.beginPath();
            ctx.moveTo(player.x, player.y - player.size / 2);
            ctx.lineTo(player.x - player.size / 2, player.y + player.size / 2);
            ctx.lineTo(player.x + player.size / 2, player.y + player.size / 2);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    // Draw laser
    function drawLaser(laser) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(laser.x - laser.width / 2, laser.y, laser.width, laser.height);
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#4ecdc4';
        ctx.fillRect(laser.x - laser.width / 2, laser.y, laser.width, laser.height);
        ctx.shadowBlur = 0;
    }
    
    // Draw asteroid
    function drawAsteroid(asteroid) {
        const image = asteroid.isOpponent ? opponentAsteroidImage : regularAsteroidImage;
        
        if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(
                image,
                asteroid.x - asteroid.size / 2,
                asteroid.y - asteroid.size / 2,
                asteroid.size,
                asteroid.size
            );
        } else {
            // Fallback circle
            ctx.fillStyle = asteroid.isOpponent ? '#ff6b9d' : '#c77dff';
            ctx.beginPath();
            ctx.arc(asteroid.x, asteroid.y, asteroid.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw HP bar above asteroid
        const barWidth = asteroid.size;
        const barHeight = 6;
        const barX = asteroid.x - barWidth / 2;
        const barY = asteroid.y - asteroid.size / 2 - barHeight - 4;
        
        // Background (red)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Health (green)
        const healthPercent = asteroid.hp / asteroid.maxHp;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        
        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // HP number text
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(asteroid.hp.toString(), asteroid.x, barY - 2);
    }
    
    // Render game
    function render() {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw stars background (subtle)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 50; i++) {
            const x = (i * 37) % CANVAS_WIDTH;
            const y = (i * 73) % CANVAS_HEIGHT;
            ctx.fillRect(x, y, 2, 2);
        }
        
        // Draw asteroids
        asteroids.forEach(asteroid => {
            drawAsteroid(asteroid);
        });
        
        // Draw lasers
        lasers.forEach(laser => {
            drawLaser(laser);
        });
        
        // Draw player (on top)
        drawPlayer();
    }
    
    // Game loop
    function gameLoopFunction(currentTime) {
        if (!gameRunning) return;
        
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        // Update game state
        updatePlayer();
        updateLasers();
        updateAsteroids();
        updateSpawning();
        checkCollisions();
        
        // Render
        render();
        
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Start game
    function startGame() {
        // Reset game state
        player.x = CANVAS_WIDTH / 2;
        player.y = CANVAS_HEIGHT - PLAYER_MARGIN_BOTTOM;
        player.direction = 0;
        
        lasers = [];
        asteroids = [];
        score = 0;
        scoreDisplay.textContent = score;
        
        lastLaserTime = 0;
        lastSpawnTime = Date.now();
        gameStartTime = Date.now();
        nextSpawnIsPair = false; // First regular spawn will be single (after initial pair)
        
        // Spawn 2 initial asteroids at different positions
        spawnAsteroid(50); // First asteroid starts partway down
        spawnAsteroid(150); // Second asteroid starts further down
        
        gameRunning = true;
        gameOverOverlay.classList.remove('active');
        keysPressed.clear();
        
        render();
        
        lastFrameTime = performance.now();
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Game over
    function gameOver() {
        gameRunning = false;
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
        }
        finalScoreDisplay.textContent = score;
        gameOverOverlay.classList.add('active');
    }
    
    // Restart game
    function restartGame() {
        startGame();
    }
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        
        const key = e.key;
        if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(key)) {
            e.preventDefault();
            keysPressed.add(key);
        }
    });
    
    document.addEventListener('keyup', (e) => {
        const key = e.key;
        keysPressed.delete(key);
    });
    
    // Mobile button controls
    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    
    btnLeft.addEventListener('mousedown', () => {
        if (gameRunning) keysPressed.add('ArrowLeft');
    });
    btnRight.addEventListener('mousedown', () => {
        if (gameRunning) keysPressed.add('ArrowRight');
    });
    
    btnLeft.addEventListener('mouseup', () => keysPressed.delete('ArrowLeft'));
    btnRight.addEventListener('mouseup', () => keysPressed.delete('ArrowRight'));
    
    btnLeft.addEventListener('mouseleave', () => keysPressed.delete('ArrowLeft'));
    btnRight.addEventListener('mouseleave', () => keysPressed.delete('ArrowRight'));
    
    // Touch events
    btnLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) keysPressed.add('ArrowLeft');
    });
    btnRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) keysPressed.add('ArrowRight');
    });
    
    btnLeft.addEventListener('touchend', (e) => {
        e.preventDefault();
        keysPressed.delete('ArrowLeft');
    });
    btnRight.addEventListener('touchend', (e) => {
        e.preventDefault();
        keysPressed.delete('ArrowRight');
    });
    
    // Restart button
    document.getElementById('restartButton').addEventListener('click', restartGame);
    
    // Start game when page loads (after images are loaded)
    // startGame() is called in onImageLoad()
    
})();
