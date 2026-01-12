// Brick Breaker Game - Client-side implementation
// Bricks = opposite character image

(function() {
    'use strict';
    
    // Game configuration
    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 600;
    const FPS = 60;
    const FRAME_TIME = 1000 / FPS;
    
    // Ball properties
    const BALL_RADIUS = 10;
    const BALL_SPEED = 5;
    const MIN_BALL_SPEED = 4; // Prevent too slow
    const MAX_BALL_SPEED = 8; // Prevent tunneling
    
    // Paddle properties
    const PADDLE_WIDTH = 80;
    const PADDLE_HEIGHT = 15;
    const PADDLE_SPEED = 7;
    const PADDLE_Y = CANVAS_HEIGHT - 40;
    
    // Brick properties
    const BRICK_ROWS = 4;
    const BRICKS_PER_ROW = 8;
    const BRICK_WIDTH = (CANVAS_WIDTH - 20) / BRICKS_PER_ROW - 4;
    const BRICK_HEIGHT = 40;
    const BRICK_START_Y = 60;
    const BRICK_SPACING = 4;
    
    // Row outline colors (bright, matching site palette)
    const ROW_COLORS = [
        '#ff6b9d', // Row 1: Pink (matches --accent-pink)
        '#ffe66d', // Row 2: Yellow (matches --accent-yellow)
        '#4ecdc4', // Row 3: Cyan (matches --accent-cyan)
        '#c77dff'  // Row 4: Purple (matches --accent-purple)
    ];
    
    // Row background colors (pastel versions for brick fill)
    const ROW_BG_COLORS = [
        'rgba(255, 107, 157, 0.3)', // Row 1: Light pink
        'rgba(255, 230, 109, 0.3)', // Row 2: Light yellow
        'rgba(78, 205, 196, 0.3)',  // Row 3: Light cyan
        'rgba(199, 125, 255, 0.3)'  // Row 4: Light purple
    ];
    
    // Get character from sessionStorage
    const selectedCharacter = sessionStorage.getItem('selectedCharacter') || 'Armando';
    const oppositeCharacter = selectedCharacter === 'Armando' ? 'Ananya' : 'Armando';
    
    // Canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const brickCountDisplay = document.getElementById('brickCount');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const winOverlay = document.getElementById('winOverlay');
    const gameOverText = document.getElementById('gameOverText');
    const launchHint = document.getElementById('launchHint');
    
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
    let ball = {
        x: CANVAS_WIDTH / 2,
        y: PADDLE_Y - BALL_RADIUS - 5,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        launched: false
    };
    
    let paddle = {
        x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        y: PADDLE_Y,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT
    };
    
    let bricks = [];
    let gameRunning = false;
    let gameLoop = null;
    let lastFrameTime = 0;
    let keysPressed = new Set();
    
    // Image loading
    let brickImage = new Image();
    let imageLoaded = false;
    
    brickImage.onload = () => {
        imageLoaded = true;
        startGame();
    };
    
    brickImage.onerror = () => {
        console.warn('Brick image failed to load, using fallback');
        imageLoaded = true;
        startGame();
    };
    
    // Load brick image (opposite character)
    brickImage.src = `/static/graphics/${oppositeCharacter}_head.png`;
    
    // If image is already cached
    if (brickImage.complete) {
        imageLoaded = true;
        startGame();
    }
    
    // Initialize bricks
    function initializeBricks() {
        bricks = [];
        for (let row = 0; row < BRICK_ROWS; row++) {
            for (let col = 0; col < BRICKS_PER_ROW; col++) {
                bricks.push({
                    x: 10 + col * (BRICK_WIDTH + BRICK_SPACING),
                    y: BRICK_START_Y + row * (BRICK_HEIGHT + BRICK_SPACING),
                    width: BRICK_WIDTH,
                    height: BRICK_HEIGHT,
                    row: row,
                    destroyed: false
                });
            }
        }
        updateBrickCount();
    }
    
    // Update brick count display
    function updateBrickCount() {
        const remaining = bricks.filter(b => !b.destroyed).length;
        brickCountDisplay.textContent = remaining;
    }
    
    // Launch ball from paddle
    function launchBall() {
        if (ball.launched) return;
        
        // Launch at upward angle
        const angle = Math.PI / 4 + (Math.random() - 0.5) * Math.PI / 6; // 45° ± 15°
        ball.vx = Math.cos(angle) * BALL_SPEED;
        ball.vy = -Math.sin(angle) * BALL_SPEED;
        ball.launched = true;
        launchHint.style.display = 'none';
    }
    
    // Update paddle
    function updatePaddle() {
        let direction = 0;
        if (keysPressed.has('ArrowLeft') || keysPressed.has('a') || keysPressed.has('A')) {
            direction = -1;
        } else if (keysPressed.has('ArrowRight') || keysPressed.has('d') || keysPressed.has('D')) {
            direction = 1;
        }
        
        paddle.x += direction * PADDLE_SPEED;
        paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - paddle.width, paddle.x));
        
        // If ball not launched, keep it on paddle
        if (!ball.launched) {
            ball.x = paddle.x + paddle.width / 2;
        }
    }
    
    // Update ball
    function updateBall() {
        if (!ball.launched) return;
        
        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // Clamp speed
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed < MIN_BALL_SPEED) {
            ball.vx = (ball.vx / speed) * MIN_BALL_SPEED;
            ball.vy = (ball.vy / speed) * MIN_BALL_SPEED;
        } else if (speed > MAX_BALL_SPEED) {
            ball.vx = (ball.vx / speed) * MAX_BALL_SPEED;
            ball.vy = (ball.vy / speed) * MAX_BALL_SPEED;
        }
        
        // Wall collisions (left and right)
        if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= CANVAS_WIDTH) {
            ball.vx = -ball.vx;
            ball.x = Math.max(ball.radius, Math.min(CANVAS_WIDTH - ball.radius, ball.x));
        }
        
        // Top wall collision
        if (ball.y - ball.radius <= 0) {
            ball.vy = -ball.vy;
            ball.y = ball.radius;
        }
        
        // Bottom wall (game over)
        if (ball.y + ball.radius >= CANVAS_HEIGHT) {
            gameOver();
            return;
        }
    }
    
    // Check collision between ball and rectangle
    function checkBallRectCollision(ball, rect) {
        // Find closest point on rectangle to ball center
        const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
        
        // Calculate distance from ball center to closest point
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < ball.radius;
    }
    
    // Resolve ball-rectangle collision
    function resolveBallRectCollision(ball, rect) {
        // Determine which side was hit
        const ballCenterX = ball.x;
        const ballCenterY = ball.y;
        const rectCenterX = rect.x + rect.width / 2;
        const rectCenterY = rect.y + rect.height / 2;
        
        const dx = ballCenterX - rectCenterX;
        const dy = ballCenterY - rectCenterY;
        
        // Calculate overlap
        const overlapX = ball.radius - Math.abs(dx) + rect.width / 2;
        const overlapY = ball.radius - Math.abs(dy) + rect.height / 2;
        
        // Determine collision side and reflect accordingly
        if (overlapX < overlapY) {
            // Horizontal collision (left or right)
            ball.vx = -ball.vx;
            ball.x += dx > 0 ? overlapX : -overlapX;
        } else {
            // Vertical collision (top or bottom)
            ball.vy = -ball.vy;
            ball.y += dy > 0 ? overlapY : -overlapY;
        }
    }
    
    // Check paddle collision
    function checkPaddleCollision() {
        if (checkBallRectCollision(ball, paddle)) {
            // Calculate hit position on paddle (0 = left edge, 1 = right edge)
            const hitPos = (ball.x - paddle.x) / paddle.width;
            
            // Reflect ball with angle based on hit position
            // Hit near edges = steeper angle, hit center = shallower angle
            const angle = Math.PI / 3 + (hitPos - 0.5) * Math.PI / 3; // 60° ± 30°
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = Math.cos(angle) * speed;
            ball.vy = -Math.abs(Math.sin(angle) * speed); // Always bounce upward
            
            // Push ball above paddle
            ball.y = paddle.y - ball.radius;
        }
    }
    
    // Check brick collisions
    function checkBrickCollisions() {
        bricks.forEach(brick => {
            if (brick.destroyed) return;
            
            if (checkBallRectCollision(ball, brick)) {
                resolveBallRectCollision(ball, brick);
                brick.destroyed = true;
                updateBrickCount();
                
                // Check win condition
                const remaining = bricks.filter(b => !b.destroyed).length;
                if (remaining === 0) {
                    win();
                }
            }
        });
    }
    
    // Draw ball
    function drawBall() {
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#4ecdc4';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    // Draw paddle
    function drawPaddle() {
        ctx.fillStyle = '#ffe66d';
        ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
        
        // Outline
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(paddle.x, paddle.y, paddle.width, paddle.height);
    }
    
    // Draw bricks
    function drawBricks() {
        bricks.forEach(brick => {
            if (brick.destroyed) return;
            
            // Draw pastel background
            ctx.fillStyle = ROW_BG_COLORS[brick.row];
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            
            // Draw brick with character image (overlay on pastel background)
            if (brickImage.complete && brickImage.naturalWidth > 0) {
                // Draw image with some transparency to blend with background
                ctx.globalAlpha = 0.8;
                ctx.drawImage(brickImage, brick.x, brick.y, brick.width, brick.height);
                ctx.globalAlpha = 1.0;
            }
            
            // Draw row-colored outline
            ctx.strokeStyle = ROW_COLORS[brick.row];
            ctx.lineWidth = 3;
            ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
            
            // Glow effect on outline
            ctx.shadowBlur = 8;
            ctx.shadowColor = ROW_COLORS[brick.row];
            ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
            ctx.shadowBlur = 0;
        });
    }
    
    // Render game
    function render() {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw bricks
        drawBricks();
        
        // Draw paddle
        drawPaddle();
        
        // Draw ball
        drawBall();
    }
    
    // Game loop
    function gameLoopFunction(currentTime) {
        if (!gameRunning) return;
        
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        // Update game state
        updatePaddle();
        updateBall();
        checkPaddleCollision();
        checkBrickCollisions();
        
        // Render
        render();
        
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Start game
    function startGame() {
        // Reset game state
        paddle.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
        ball.x = CANVAS_WIDTH / 2;
        ball.y = PADDLE_Y - BALL_RADIUS - 5;
        ball.vx = 0;
        ball.vy = 0;
        ball.launched = false;
        
        initializeBricks();
        
        gameRunning = true;
        gameOverOverlay.classList.remove('active');
        winOverlay.classList.remove('active');
        launchHint.style.display = 'block';
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
        gameOverText.textContent = 'Game Over!';
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
        if (key === ' ') {
            e.preventDefault();
            launchBall();
        } else if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(key)) {
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
    
    // Launch ball on screen tap/click
    canvas.addEventListener('click', (e) => {
        if (gameRunning && !ball.launched) {
            launchBall();
        }
    });
    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning && !ball.launched) {
            launchBall();
        }
    });
    
    // Restart buttons
    document.getElementById('restartButton').addEventListener('click', restartGame);
    document.getElementById('winRestartButton').addEventListener('click', restartGame);
    
    // Start game when page loads (after image is loaded)
    // startGame() is called in onImageLoad()
    
})();
