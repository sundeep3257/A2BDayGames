// Pac-Man Game - Client-side implementation
// Character-based: player = selected character, ghosts = opposite character

(function() {
    'use strict';
    
    // Game configuration
    const GRID_SIZE = 15; // 15x15 grid
    const CELL_SIZE = 20; // pixels per cell (will be scaled)
    const BASE_SPEED = 0.075; // base movement speed (cells per frame) - half speed
    const FPS = 60; // render FPS
    const FRAME_TIME = 1000 / FPS;
    
    // Item spawn interval (10 seconds)
    const ITEM_SPAWN_INTERVAL = 10000;
    const ITEM_EFFECT_DURATION = 5000; // 5 seconds
    
    // Get character from sessionStorage
    const selectedCharacter = sessionStorage.getItem('selectedCharacter') || 'Armando';
    const oppositeCharacter = selectedCharacter === 'Armando' ? 'Ananya' : 'Armando';
    
    // Canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const foodProgressDisplay = document.getElementById('foodProgress');
    const powerUpDisplay = document.getElementById('powerUpDisplay');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const winOverlay = document.getElementById('winOverlay');
    
    // Calculate canvas size (square, responsive) - doubled for 2x size
    function resizeCanvas() {
        const maxWidth = Math.min(window.innerWidth - 40, 1000); // Doubled from 500
        const size = Math.floor(maxWidth / GRID_SIZE) * GRID_SIZE;
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Calculate cell size based on canvas
    function getCellSize() {
        return canvas.width / GRID_SIZE;
    }
    
    // Game state
    let player = {
        x: 7.5, // center of grid (in grid coordinates)
        y: 7.5,
        direction: { x: 0, y: 0 },
        speed: BASE_SPEED,
        image: new Image()
    };
    
    let ghosts = [];
    let food = [];
    let totalFood = 0;
    let foodEaten = 0;
    let activeItem = null;
    let itemSpawnTimer = 0;
    let gameRunning = false;
    let gameLoop = null;
    let lastFrameTime = 0;
    let keysPressed = new Set();
    
    // Ghost image
    let ghostImage = new Image();
    
    // Item images
    let cherryImage = new Image();
    let snowflakeImage = new Image();
    let imagesLoaded = 0;
    
    // Power-up states
    let speedBoostActive = false;
    let speedBoostTimer = 0;
    let freezeActive = false;
    let freezeTimer = 0;
    
    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === 4) {
            startGame();
        }
    }
    
    player.image.onload = onImageLoad;
    ghostImage.onload = onImageLoad;
    cherryImage.onload = onImageLoad;
    snowflakeImage.onload = onImageLoad;
    
    player.image.onerror = () => {
        console.warn('Player image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 4) startGame();
    };
    ghostImage.onerror = () => {
        console.warn('Ghost image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 4) startGame();
    };
    cherryImage.onerror = () => {
        console.warn('Cherry image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 4) startGame();
    };
    snowflakeImage.onerror = () => {
        console.warn('Snowflake image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 4) startGame();
    };
    
    // Load images
    player.image.src = `/static/graphics/${selectedCharacter}_head.png`;
    ghostImage.src = `/static/graphics/${oppositeCharacter}_head.png`;
    cherryImage.src = `/static/graphics/cherry.png`;
    snowflakeImage.src = `/static/graphics/snowflake.png`;
    
    // If images are already cached
    if (player.image.complete && ghostImage.complete && cherryImage.complete && snowflakeImage.complete) {
        imagesLoaded = 4;
        startGame();
    }
    
    // Initialize food pellets
    function initializeFood() {
        food = [];
        // Place food on most cells (avoid player start and some edge cells)
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                // Skip center area where player starts
                if (x >= 6 && x <= 9 && y >= 6 && y <= 9) {
                    continue;
                }
                food.push({ x, y });
            }
        }
        totalFood = food.length;
        foodEaten = 0;
        updateFoodProgress();
    }
    
    // Update food progress display
    function updateFoodProgress() {
        const percentage = totalFood > 0 ? Math.round((foodEaten / totalFood) * 100) : 0;
        foodProgressDisplay.textContent = percentage + '%';
    }
    
    // Generate random valid position (not overlapping player or food)
    function getRandomPosition() {
        let pos;
        let attempts = 0;
        do {
            pos = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };
            attempts++;
        } while (
            attempts < 100 &&
            (Math.floor(player.x) === pos.x && Math.floor(player.y) === pos.y ||
             food.some(f => f.x === pos.x && f.y === pos.y))
        );
        return pos;
    }
    
    // Spawn initial ghost
    function spawnGhost() {
        const pos = getRandomPosition();
        const directions = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
        const direction = directions[Math.floor(Math.random() * directions.length)];
        
        ghosts.push({
            x: pos.x + 0.5,
            y: pos.y + 0.5,
            direction: direction,
            speed: 0.05, // Half speed (was 0.1)
            directionChangeTimer: 0,
            directionChangeInterval: 500 + Math.random() * 500 // 0.5-1 seconds (maximum 1 second)
        });
    }
    
    // Spawn item at random position
    function spawnItem() {
        if (activeItem) return; // Only one item at a time
        
        const pos = getRandomPosition();
        const itemTypes = ['cherry', 'snowflake'];
        const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        
        activeItem = {
            x: pos.x + 0.5,
            y: pos.y + 0.5,
            type: itemType,
            spawnTime: Date.now()
        };
    }
    
    // Check collision between two positions (with tolerance)
    function checkCollision(pos1, pos2, tolerance = 0.5) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy) < tolerance;
    }
    
    // Wrap position around grid edges
    function wrapPosition(pos) {
        return {
            x: ((pos.x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE,
            y: ((pos.y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE
        };
    }
    
    // Update player movement
    function updatePlayer(deltaTime) {
        // Player only moves when key is actively pressed
        if (keysPressed.size === 0) {
            player.direction = { x: 0, y: 0 };
            return;
        }
        
        // Get current direction from keys (prioritize first key pressed)
        let newDirection = { x: 0, y: 0 };
        for (let key of keysPressed) {
            switch(key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    newDirection = { x: 0, y: -1 };
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    newDirection = { x: 0, y: 1 };
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    newDirection = { x: -1, y: 0 };
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    newDirection = { x: 1, y: 0 };
                    break;
            }
            if (newDirection.x !== 0 || newDirection.y !== 0) break;
        }
        
        // Prevent diagonal movement
        if (newDirection.x !== 0 && newDirection.y !== 0) {
            newDirection = { x: newDirection.x, y: 0 }; // Prefer horizontal
        }
        
        player.direction = newDirection;
        
        // Move player
        const currentSpeed = speedBoostActive ? player.speed * 1.5 : player.speed;
        player.x += player.direction.x * currentSpeed;
        player.y += player.direction.y * currentSpeed;
        
        // Wrap around edges
        const wrapped = wrapPosition({ x: player.x, y: player.y });
        player.x = wrapped.x;
        player.y = wrapped.y;
    }
    
    // Update ghost movement
    function updateGhosts(deltaTime) {
        if (freezeActive) return; // Don't move ghosts when frozen
        
        ghosts.forEach(ghost => {
            // Update direction change timer
            ghost.directionChangeTimer += deltaTime;
            
            // Randomly change direction periodically
            if (ghost.directionChangeTimer >= ghost.directionChangeInterval) {
                const directions = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
                // Sometimes keep same direction, sometimes change
                if (Math.random() < 0.7) {
                    ghost.direction = directions[Math.floor(Math.random() * directions.length)];
                }
                ghost.directionChangeTimer = 0;
                ghost.directionChangeInterval = 500 + Math.random() * 500; // 0.5-1 seconds (maximum 1 second)
            }
            
            // Move ghost
            ghost.x += ghost.direction.x * ghost.speed;
            ghost.y += ghost.direction.y * ghost.speed;
            
            // Wrap around edges
            const wrapped = wrapPosition({ x: ghost.x, y: ghost.y });
            ghost.x = wrapped.x;
            ghost.y = wrapped.y;
        });
    }
    
    // Check collisions
    function checkCollisions() {
        // Player vs Ghosts
        ghosts.forEach(ghost => {
            if (checkCollision(player, ghost, 0.6)) {
                gameOver();
                return;
            }
        });
        
        // Player vs Food
        food = food.filter(f => {
            const foodPos = { x: f.x + 0.5, y: f.y + 0.5 };
            if (checkCollision(player, foodPos, 0.6)) {
                foodEaten++;
                updateFoodProgress();
                
                // Check for ghost spawning
                const foodPercentage = (foodEaten / totalFood) * 100;
                if (ghosts.length === 1 && foodPercentage >= 33) {
                    spawnGhost();
                } else if (ghosts.length === 2 && foodPercentage >= 66) {
                    spawnGhost();
                }
                
                // Check win condition
                if (foodEaten >= totalFood) {
                    win();
                    return false; // Remove food
                }
                
                return false; // Remove food
            }
            return true; // Keep food
        });
        
        // Don't process further if game ended
        if (!gameRunning) return;
        
        // Player vs Item
        if (activeItem) {
            if (checkCollision(player, activeItem, 0.6)) {
                applyItemEffect(activeItem.type);
                activeItem = null;
            }
        }
    }
    
    // Apply item effect
    function applyItemEffect(itemType) {
        if (itemType === 'cherry') {
            speedBoostActive = true;
            speedBoostTimer = ITEM_EFFECT_DURATION;
            powerUpDisplay.textContent = 'Speed Boost Active!';
        } else if (itemType === 'snowflake') {
            freezeActive = true;
            freezeTimer = ITEM_EFFECT_DURATION;
            powerUpDisplay.textContent = 'Ghosts Frozen!';
        }
    }
    
    // Update power-up timers
    function updatePowerUps(deltaTime) {
        if (speedBoostActive) {
            speedBoostTimer -= deltaTime;
            if (speedBoostTimer <= 0) {
                speedBoostActive = false;
                if (!freezeActive) {
                    powerUpDisplay.textContent = '';
                }
            }
        }
        
        if (freezeActive) {
            freezeTimer -= deltaTime;
            if (freezeTimer <= 0) {
                freezeActive = false;
                if (!speedBoostActive) {
                    powerUpDisplay.textContent = '';
                } else {
                    powerUpDisplay.textContent = 'Speed Boost Active!';
                }
            }
        }
    }
    
    // Update item spawning
    function updateItemSpawning(deltaTime) {
        if (activeItem) return; // Don't spawn if item exists
        
        itemSpawnTimer += deltaTime;
        if (itemSpawnTimer >= ITEM_SPAWN_INTERVAL) {
            spawnItem();
            itemSpawnTimer = 0;
        }
    }
    
    // Draw grid background
    function drawGrid() {
        const cellSize = getCellSize();
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= GRID_SIZE; i++) {
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, canvas.height);
            ctx.stroke();
            
            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(canvas.width, i * cellSize);
            ctx.stroke();
        }
    }
    
    // Draw food pellets
    function drawFood() {
        const cellSize = getCellSize();
        ctx.fillStyle = '#ffe66d';
        
        food.forEach(f => {
            const x = f.x * cellSize + cellSize / 2;
            const y = f.y * cellSize + cellSize / 2;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2); // Doubled from 3 to 6
            ctx.fill();
        });
    }
    
    // Draw player
    function drawPlayer() {
        const cellSize = getCellSize();
        const x = player.x * cellSize;
        const y = player.y * cellSize;
        const size = cellSize * 0.8;
        const offset = (cellSize - size) / 2;
        
        // Draw player image
        if (player.image.complete && player.image.naturalWidth > 0) {
            ctx.drawImage(player.image, x + offset, y + offset, size, size);
        } else {
            // Fallback: draw circle
            ctx.fillStyle = '#ffe66d';
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw yellow outline
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 6; // Doubled from 3 to 6
        ctx.strokeRect(x + offset, y + offset, size, size);
    }
    
    // Draw ghosts
    function drawGhosts() {
        const cellSize = getCellSize();
        
        ghosts.forEach(ghost => {
            const x = ghost.x * cellSize;
            const y = ghost.y * cellSize;
            const size = cellSize * 0.8;
            const offset = (cellSize - size) / 2;
            
            // Draw ghost image
            if (ghostImage.complete && ghostImage.naturalWidth > 0) {
                ctx.drawImage(ghostImage, x + offset, y + offset, size, size);
            } else {
                // Fallback: draw circle
                ctx.fillStyle = '#ff6b9d';
                ctx.beginPath();
                ctx.arc(x + cellSize / 2, y + cellSize / 2, size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw frozen effect if active
            if (freezeActive) {
                ctx.strokeStyle = '#4ecdc4';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + offset, y + offset, size, size);
            }
        });
    }
    
    // Draw active item
    function drawItem() {
        if (!activeItem) return;
        
        const cellSize = getCellSize();
        const x = activeItem.x * cellSize;
        const y = activeItem.y * cellSize;
        const size = cellSize * 0.6;
        const offset = (cellSize - size) / 2;
        
        let image = activeItem.type === 'cherry' ? cherryImage : snowflakeImage;
        
        if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, x + offset, y + offset, size, size);
        } else {
            // Fallback
            ctx.fillStyle = activeItem.type === 'cherry' ? '#ff0000' : '#ffffff';
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Render game
    function render() {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        drawGrid();
        
        // Draw food
        drawFood();
        
        // Draw item
        drawItem();
        
        // Draw ghosts
        drawGhosts();
        
        // Draw player (on top)
        drawPlayer();
    }
    
    // Game loop
    function gameLoopFunction(currentTime) {
        if (!gameRunning) return;
        
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        // Update game state
        updatePlayer(deltaTime);
        updateGhosts(deltaTime);
        updatePowerUps(deltaTime);
        updateItemSpawning(deltaTime);
        checkCollisions();
        
        // Render
        render();
        
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Start game
    function startGame() {
        // Reset game state
        player.x = 7.5;
        player.y = 7.5;
        player.direction = { x: 0, y: 0 };
        player.speed = BASE_SPEED;
        
        ghosts = [];
        spawnGhost(); // Start with 1 ghost
        
        initializeFood();
        
        activeItem = null;
        itemSpawnTimer = 0;
        
        speedBoostActive = false;
        speedBoostTimer = 0;
        freezeActive = false;
        freezeTimer = 0;
        
        powerUpDisplay.textContent = '';
        
        gameRunning = true;
        gameOverOverlay.classList.remove('active');
        winOverlay.classList.remove('active');
        
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
        gameOverOverlay.classList.add('active');
    }
    
    // Win
    function win() {
        gameRunning = false;
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
        }
        winOverlay.classList.add('active');
    }
    
    // Restart game
    function restartGame() {
        startGame();
    }
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        
        const key = e.key;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(key)) {
            e.preventDefault();
            keysPressed.add(key);
        }
    });
    
    document.addEventListener('keyup', (e) => {
        const key = e.key;
        keysPressed.delete(key);
    });
    
    // D-pad button controls
    const btnUp = document.getElementById('btnUp');
    const btnDown = document.getElementById('btnDown');
    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    
    // Button press handlers
    btnUp.addEventListener('mousedown', () => {
        if (gameRunning) keysPressed.add('ArrowUp');
    });
    btnDown.addEventListener('mousedown', () => {
        if (gameRunning) keysPressed.add('ArrowDown');
    });
    btnLeft.addEventListener('mousedown', () => {
        if (gameRunning) keysPressed.add('ArrowLeft');
    });
    btnRight.addEventListener('mousedown', () => {
        if (gameRunning) keysPressed.add('ArrowRight');
    });
    
    btnUp.addEventListener('mouseup', () => keysPressed.delete('ArrowUp'));
    btnDown.addEventListener('mouseup', () => keysPressed.delete('ArrowDown'));
    btnLeft.addEventListener('mouseup', () => keysPressed.delete('ArrowLeft'));
    btnRight.addEventListener('mouseup', () => keysPressed.delete('ArrowRight'));
    
    btnUp.addEventListener('mouseleave', () => keysPressed.delete('ArrowUp'));
    btnDown.addEventListener('mouseleave', () => keysPressed.delete('ArrowDown'));
    btnLeft.addEventListener('mouseleave', () => keysPressed.delete('ArrowLeft'));
    btnRight.addEventListener('mouseleave', () => keysPressed.delete('ArrowRight'));
    
    // Touch events for D-pad
    btnUp.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) keysPressed.add('ArrowUp');
    });
    btnDown.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) keysPressed.add('ArrowDown');
    });
    btnLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) keysPressed.add('ArrowLeft');
    });
    btnRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) keysPressed.add('ArrowRight');
    });
    
    btnUp.addEventListener('touchend', (e) => {
        e.preventDefault();
        keysPressed.delete('ArrowUp');
    });
    btnDown.addEventListener('touchend', (e) => {
        e.preventDefault();
        keysPressed.delete('ArrowDown');
    });
    btnLeft.addEventListener('touchend', (e) => {
        e.preventDefault();
        keysPressed.delete('ArrowLeft');
    });
    btnRight.addEventListener('touchend', (e) => {
        e.preventDefault();
        keysPressed.delete('ArrowRight');
    });
    
    // Restart buttons
    document.getElementById('restartButton').addEventListener('click', restartGame);
    document.getElementById('winRestartButton').addEventListener('click', restartGame);
    
    // Start game when page loads (after images are loaded)
    // startGame() is called in onImageLoad()
    
})();
