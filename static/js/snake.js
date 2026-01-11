// Snake Game - Client-side implementation
// Character-based sprites: head = selected character, food = opposite character

(function() {
    'use strict';
    
    // Game configuration
    const GRID_SIZE = 10; // 10x10 grid (squares are twice as big)
    const CELL_SIZE = 20; // pixels per cell (will be scaled)
    const FPS = 5; // frames per second (movement tick rate - half speed)
    const FRAME_TIME = 1000 / FPS;
    
    // Get character from sessionStorage
    const selectedCharacter = sessionStorage.getItem('selectedCharacter') || 'Armando';
    const oppositeCharacter = selectedCharacter === 'Armando' ? 'Ananya' : 'Armando';
    
    // Canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    
    // Calculate canvas size (square, responsive)
    function resizeCanvas() {
        const maxWidth = Math.min(window.innerWidth - 40, 500);
        const size = Math.floor(maxWidth / GRID_SIZE) * GRID_SIZE;
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Game state
    let snake = [{ x: 5, y: 5 }];
    let direction = { x: 1, y: 0 };
    let nextDirection = { x: 1, y: 0 };
    let food = { x: 7, y: 7 };
    let score = 0;
    let gameRunning = false;
    let gameLoop = null;
    let lastFrameTime = 0;
    
    // Image loading
    let headImage = new Image();
    let foodImage = new Image();
    let imagesLoaded = 0;
    
    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === 2) {
            startGame();
        }
    }
    
    headImage.onload = onImageLoad;
    foodImage.onload = onImageLoad;
    headImage.onerror = () => {
        console.warn('Head image failed to load, using fallback');
        imagesLoaded++;
        if (imagesLoaded === 2) startGame();
    };
    foodImage.onerror = () => {
        console.warn('Food image failed to load, using fallback');
        imagesLoaded++;
        if (imagesLoaded === 2) startGame();
    };
    
    // Load images
    headImage.src = `/static/graphics/${selectedCharacter}_head.png`;
    foodImage.src = `/static/graphics/${oppositeCharacter}_head.png`;
    
    // If images are already cached, trigger load manually
    if (headImage.complete && foodImage.complete) {
        imagesLoaded = 2;
        startGame();
    }
    
    // Calculate cell size based on canvas
    function getCellSize() {
        return canvas.width / GRID_SIZE;
    }
    
    // Generate random food position
    function generateFood() {
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };
        } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
        food = newFood;
    }
    
    // Check collision with self
    function checkSelfCollision(head) {
        return snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y);
    }
    
    // Wrap position around grid edges
    function wrapPosition(pos) {
        return {
            x: ((pos.x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE,
            y: ((pos.y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE
        };
    }
    
    // Update game state
    function update() {
        // Update direction (prevent reversing into itself)
        const canChangeDirection = 
            (nextDirection.x !== 0 && direction.x === 0) ||
            (nextDirection.y !== 0 && direction.y === 0);
        
        if (canChangeDirection) {
            direction = { ...nextDirection };
        }
        
        // Calculate new head position
        let newHead = {
            x: snake[0].x + direction.x,
            y: snake[0].y + direction.y
        };
        
        // Wrap around edges
        newHead = wrapPosition(newHead);
        
        // Check self-collision only (no wall collision)
        if (checkSelfCollision(newHead)) {
            gameOver();
            return;
        }
        
        // Add new head
        snake.unshift(newHead);
        
        // Check if food eaten
        if (newHead.x === food.x && newHead.y === food.y) {
            score++;
            scoreDisplay.textContent = score;
            generateFood();
        } else {
            // Remove tail if no food eaten
            snake.pop();
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
    
    // Draw snake
    function drawSnake() {
        const cellSize = getCellSize();
        
        // Draw body segments
        ctx.fillStyle = '#4ecdc4';
        for (let i = 1; i < snake.length; i++) {
            const segment = snake[i];
            ctx.fillRect(
                segment.x * cellSize + 2,
                segment.y * cellSize + 2,
                cellSize - 4,
                cellSize - 4
            );
        }
        
        // Draw head with character image
        const head = snake[0];
        const headX = head.x * cellSize + 2;
        const headY = head.y * cellSize + 2;
        const headSize = cellSize - 4;
        
        if (headImage.complete && headImage.naturalWidth > 0) {
            ctx.drawImage(
                headImage,
                headX,
                headY,
                headSize,
                headSize
            );
            // Draw blue outline around head
            ctx.strokeStyle = '#0000ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(headX, headY, headSize, headSize);
        } else {
            // Fallback: draw head as rounded rectangle
            ctx.fillStyle = '#ffe66d';
            const x = headX;
            const y = headY;
            const w = headSize;
            const h = headSize;
            const r = 4;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
            // Draw blue outline around head
            ctx.strokeStyle = '#0000ff';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
    
    // Draw food
    function drawFood() {
        const cellSize = getCellSize();
        const foodX = food.x * cellSize + 2;
        const foodY = food.y * cellSize + 2;
        const foodSize = cellSize - 4;
        
        if (foodImage.complete && foodImage.naturalWidth > 0) {
            ctx.drawImage(
                foodImage,
                foodX,
                foodY,
                foodSize,
                foodSize
            );
        } else {
            // Fallback: draw food as circle
            ctx.fillStyle = '#ff6b9d';
            ctx.beginPath();
            ctx.arc(
                food.x * cellSize + cellSize / 2,
                food.y * cellSize + cellSize / 2,
                (cellSize - 4) / 2,
                0,
                Math.PI * 2
            );
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
        
        // Draw snake
        drawSnake();
    }
    
    // Game loop
    function gameLoopFunction(currentTime) {
        if (!gameRunning) return;
        
        if (currentTime - lastFrameTime >= FRAME_TIME) {
            update();
            render();
            lastFrameTime = currentTime;
        }
        
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Start game
    function startGame() {
        // Reset game state
        snake = [{ x: 5, y: 5 }]; // Adjusted for 10x10 grid
        direction = { x: 1, y: 0 };
        nextDirection = { x: 1, y: 0 };
        score = 0;
        scoreDisplay.textContent = score;
        gameRunning = true;
        gameOverOverlay.classList.remove('active');
        
        generateFood();
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
    
    // Restart game
    function restartGame() {
        startGame();
    }
    
    // Direction control
    function setDirection(newDir) {
        // Prevent reversing into itself
        if (newDir.x === -direction.x && newDir.y === -direction.y) {
            return;
        }
        nextDirection = newDir;
    }
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!gameRunning && e.key !== ' ') return;
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                e.preventDefault();
                setDirection({ x: 0, y: -1 });
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                e.preventDefault();
                setDirection({ x: 0, y: 1 });
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                setDirection({ x: -1, y: 0 });
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                setDirection({ x: 1, y: 0 });
                break;
        }
    });
    
    // D-pad button controls
    document.getElementById('btnUp').addEventListener('click', () => {
        setDirection({ x: 0, y: -1 });
    });
    
    document.getElementById('btnDown').addEventListener('click', () => {
        setDirection({ x: 0, y: 1 });
    });
    
    document.getElementById('btnLeft').addEventListener('click', () => {
        setDirection({ x: -1, y: 0 });
    });
    
    document.getElementById('btnRight').addEventListener('click', () => {
        setDirection({ x: 1, y: 0 });
    });
    
    // Touch events for D-pad (prevent default to avoid scrolling)
    document.getElementById('btnUp').addEventListener('touchstart', (e) => {
        e.preventDefault();
        setDirection({ x: 0, y: -1 });
    });
    document.getElementById('btnDown').addEventListener('touchstart', (e) => {
        e.preventDefault();
        setDirection({ x: 0, y: 1 });
    });
    document.getElementById('btnLeft').addEventListener('touchstart', (e) => {
        e.preventDefault();
        setDirection({ x: -1, y: 0 });
    });
    document.getElementById('btnRight').addEventListener('touchstart', (e) => {
        e.preventDefault();
        setDirection({ x: 1, y: 0 });
    });
    
    // Game over overlay click/tap to restart
    gameOverOverlay.addEventListener('click', restartGame);
    gameOverOverlay.addEventListener('touchend', (e) => {
        e.preventDefault();
        restartGame();
    });
    
    // Start game when page loads (after images are loaded)
    // startGame() is called in onImageLoad()
    
})();
