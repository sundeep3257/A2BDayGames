// Pinball Game - Client-side implementation with physics
// Ball = selected character, Bumpers = opposite character

(function() {
    'use strict';
    
    // Game configuration
    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 600;
    const FPS = 60;
    const FRAME_TIME = 1000 / FPS;
    
    // Physics constants
    const GRAVITY = 0.3;
    const FRICTION = 0.98;
    const RESTITUTION = 0.7; // Bounce energy retention
    const MAX_VELOCITY = 15; // Prevent tunneling
    
    // Ball properties
    const BALL_RADIUS = 15;
    
    // Flipper properties
    const FLIPPER_LENGTH = CANVAS_WIDTH * 0.45; // 45% of board width
    const FLIPPER_BASE_WIDTH = 20; // Width at pivot
    const FLIPPER_TIP_WIDTH = 8; // Width at tip
    // Left flipper angles (pivot at left edge, pointing right/inwards)
    // When activated: rotates counterclockwise (angle decreases) to point up-right
    // When resting: points down-right
    const LEFT_FLIPPER_ANGLE_MAX = Math.PI / 4; // 45 degrees (resting, pointing down-right)
    const LEFT_FLIPPER_ANGLE_MIN = -Math.PI / 6; // -30 degrees (activated, pointing up-right, counterclockwise from rest)
    
    // Right flipper angles (pivot at right edge, pointing left/inwards) - perfectly mirrored
    // When activated: rotates clockwise (angle increases) to point up-left
    // When resting: points down-left
    // Mirror: if left is at angle θ, right is at angle π - θ
    const RIGHT_FLIPPER_ANGLE_MAX = Math.PI - LEFT_FLIPPER_ANGLE_MAX; // ~135 degrees (resting)
    const RIGHT_FLIPPER_ANGLE_MIN = Math.PI - LEFT_FLIPPER_ANGLE_MIN; // ~210 degrees (activated, clockwise from rest)
    
    const TILE_SIZE = 20; // Size of one tile for positioning
    const FLIPPER_SPEED = 0.3;
    const FLIPPER_RETURN_SPEED = 0.15;
    const TROUGH_HEIGHT = 25; // 1/4th of original 100
    
    // Bumper properties
    const BUMPER_RADIUS = 25;
    const BUMPER_GLOW_DURATION = 300; // milliseconds
    
    // Star properties
    const STAR_SIZE = 30;
    const STAR_SPAWN_DELAY = 10000; // 10 seconds
    const STAR_LIFETIME = 30000; // 30 seconds
    const STAR_RESPAWN_DELAY = 10000; // 10 seconds after disappearing
    
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
    
    // Scale factor for drawing
    function getScale() {
        return canvas.width / CANVAS_WIDTH;
    }
    
    // Game state
    let ball = {
        x: CANVAS_WIDTH / 2,
        y: 100,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        image: new Image()
    };
    
    let leftFlipper = {
        x: 0, // Pivot at left edge
        y: CANVAS_HEIGHT - TROUGH_HEIGHT - 10 - (4 * TILE_SIZE), // Raised by 4 tiles
        angle: LEFT_FLIPPER_ANGLE_MAX, // Start at resting position
        targetAngle: LEFT_FLIPPER_ANGLE_MAX,
        length: FLIPPER_LENGTH,
        baseWidth: FLIPPER_BASE_WIDTH,
        tipWidth: FLIPPER_TIP_WIDTH
    };
    
    let rightFlipper = {
        x: CANVAS_WIDTH, // Pivot at right edge
        y: CANVAS_HEIGHT - TROUGH_HEIGHT - 10 - (4 * TILE_SIZE), // Raised by 4 tiles
        angle: RIGHT_FLIPPER_ANGLE_MAX, // Start at resting position
        targetAngle: RIGHT_FLIPPER_ANGLE_MAX,
        length: FLIPPER_LENGTH,
        baseWidth: FLIPPER_BASE_WIDTH,
        tipWidth: FLIPPER_TIP_WIDTH
    };
    
    let bumpers = [];
    let obstacles = [];
    let walls = [];
    let star = null;
    let starSpawnTimer = 0;
    let starLifetime = 0;
    let isFirstStar = true;
    let score = 0;
    let gameRunning = false;
    let gameLoop = null;
    let lastFrameTime = 0;
    let flippersActive = false;
    
    // Bumper glow states
    let bumperGlows = new Map();
    
    // Image loading
    let bumperImage = new Image();
    let starImage = new Image();
    let imagesLoaded = 0;
    
    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === 3) {
            startGame();
        }
    }
    
    ball.image.onload = onImageLoad;
    bumperImage.onload = onImageLoad;
    starImage.onload = onImageLoad;
    
    ball.image.onerror = () => {
        console.warn('Ball image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 3) startGame();
    };
    bumperImage.onerror = () => {
        console.warn('Bumper image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 3) startGame();
    };
    starImage.onerror = () => {
        console.warn('Star image failed to load');
        imagesLoaded++;
        if (imagesLoaded === 3) startGame();
    };
    
    // Load images
    ball.image.src = `/static/graphics/${selectedCharacter}_head.png`;
    bumperImage.src = `/static/graphics/${oppositeCharacter}_head.png`;
    starImage.src = `/static/graphics/star.png`;
    
    // If images are already cached
    if (ball.image.complete && bumperImage.complete && starImage.complete) {
        imagesLoaded = 3;
        startGame();
    }
    
    // Initialize game board
    function initializeBoard() {
        const topThird = CANVAS_HEIGHT / 3; // 200
        const middleStart = CANVAS_WIDTH * 0.4; // 160
        const middleEnd = CANVAS_WIDTH * 0.6; // 240
        
        // Define walls (top, left, right, bottom trough)
        walls = [
            { x1: 0, y1: 0, x2: CANVAS_WIDTH, y2: 0 }, // Top
            { x1: 0, y1: 0, x2: 0, y2: CANVAS_HEIGHT - TROUGH_HEIGHT }, // Left
            { x1: CANVAS_WIDTH, y1: 0, x2: CANVAS_WIDTH, y2: CANVAS_HEIGHT - TROUGH_HEIGHT }, // Right
            // Bottom trough (game over zone)
            { x1: 0, y1: CANVAS_HEIGHT - TROUGH_HEIGHT, x2: CANVAS_WIDTH, y2: CANVAS_HEIGHT - TROUGH_HEIGHT }
        ];
        
        // Define obstacles (ramps, slingshots, and other pinball features)
        // Avoid middle 20% of board (x between middleStart and middleEnd)
        obstacles = [
            // Left side ramp (angled upward)
            { x1: 40, y1: 120, x2: 100, y2: 180, type: 'line' },
            // Right side ramp (angled upward)
            { x1: CANVAS_WIDTH - 40, y1: 120, x2: CANVAS_WIDTH - 100, y2: 180, type: 'line' },
            // Left slingshot (angled deflector)
            { x1: 30, y1: 250, x2: 80, y2: 280, type: 'line' },
            { x1: 30, y1: 280, x2: 80, y2: 250, type: 'line' },
            // Right slingshot (angled deflector)
            { x1: CANVAS_WIDTH - 30, y1: 250, x2: CANVAS_WIDTH - 80, y2: 280, type: 'line' },
            { x1: CANVAS_WIDTH - 30, y1: 280, x2: CANVAS_WIDTH - 80, y2: 250, type: 'line' },
            // Left side post (vertical obstacle)
            { x1: 60, y1: 320, x2: 60, y2: 380, type: 'line' },
            // Right side post (vertical obstacle)
            { x1: CANVAS_WIDTH - 60, y1: 320, x2: CANVAS_WIDTH - 60, y2: 380, type: 'line' },
            // Left upper deflector
            { x1: 50, y1: 400, x2: 90, y2: 420, type: 'line' },
            // Right upper deflector
            { x1: CANVAS_WIDTH - 50, y1: 400, x2: CANVAS_WIDTH - 90, y2: 420, type: 'line' }
        ];
        
        // Define bumpers (only 3, all in top third)
        bumpers = [
            { x: CANVAS_WIDTH * 0.25, y: topThird * 0.5, radius: BUMPER_RADIUS }, // Left top
            { x: CANVAS_WIDTH * 0.75, y: topThird * 0.5, radius: BUMPER_RADIUS }, // Right top
            { x: CANVAS_WIDTH * 0.5, y: topThird * 0.8, radius: BUMPER_RADIUS }  // Center top
        ];
        
        // Initialize bumper glows
        bumpers.forEach((bumper, index) => {
            bumperGlows.set(index, 0);
        });
    }
    
    // Distance between two points
    function distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    
    // Check collision between ball and circle
    function checkCircleCollision(ball, circle) {
        const dist = distance(ball.x, ball.y, circle.x, circle.y);
        return dist < (ball.radius + circle.radius);
    }
    
    // Check collision between ball and line segment
    function checkLineCollision(ball, line) {
        const { x1, y1, x2, y2 } = line;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Project ball center onto line
        const t = Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / (length * length)));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        const dist = distance(ball.x, ball.y, projX, projY);
        return dist < ball.radius;
    }
    
    // Get normal vector for line collision
    function getLineNormal(line) {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        // Normal pointing "up" (toward ball)
        return { x: -dy / length, y: dx / length };
    }
    
    // Resolve collision with line
    function resolveLineCollision(ball, line) {
        const normal = getLineNormal(line);
        const dotProduct = ball.vx * normal.x + ball.vy * normal.y;
        ball.vx -= 2 * dotProduct * normal.x * RESTITUTION;
        ball.vy -= 2 * dotProduct * normal.y * RESTITUTION;
        
        // Push ball away from line
        const dist = distance(ball.x, ball.y, (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2);
        const overlap = ball.radius - dist;
        if (overlap > 0) {
            ball.x += normal.x * overlap;
            ball.y += normal.y * overlap;
        }
    }
    
    // Resolve collision with circle (bumper)
    function resolveCircleCollision(ball, circle) {
        const dx = ball.x - circle.x;
        const dy = ball.y - circle.y;
        const dist = distance(ball.x, ball.y, circle.x, circle.y);
        const overlap = (ball.radius + circle.radius) - dist;
        
        if (overlap > 0) {
            // Normalize direction
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Separate objects
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            
            // Calculate relative velocity
            const relativeVel = ball.vx * nx + ball.vy * ny;
            
            // Bounce with restitution
            const impulse = relativeVel * (1 + RESTITUTION);
            ball.vx -= impulse * nx;
            ball.vy -= impulse * ny;
            
            // Add extra bounce force for bumpers
            ball.vx += nx * 2;
            ball.vy += ny * 2;
        }
    }
    
    // Check collision with flipper (shaped like actual flipper - solid object)
    function checkFlipperCollision(ball, flipper) {
        const pivotX = flipper.x;
        const pivotY = flipper.y;
        
        // Calculate flipper direction
        const flipperDirX = Math.cos(flipper.angle);
        const flipperDirY = Math.sin(flipper.angle);
        
        const perpX = -flipperDirY; // Perpendicular to flipper
        const perpY = flipperDirX;
        
        // Project ball center onto flipper line
        const ballToPivotX = ball.x - pivotX;
        const ballToPivotY = ball.y - pivotY;
        const projection = ballToPivotX * flipperDirX + ballToPivotY * flipperDirY;
        
        // Clamp projection to flipper length
        const t = Math.max(0, Math.min(1, projection / flipper.length));
        
        // Get closest point on flipper centerline
        const closestX = pivotX + flipperDirX * flipper.length * t;
        const closestY = pivotY + flipperDirY * flipper.length * t;
        
        // Calculate width at this point (tapered)
        const width = flipper.baseWidth * (1 - t) + flipper.tipWidth * t;
        
        // Calculate distance from ball to flipper centerline
        const distToCenterline = Math.abs(ballToPivotX * perpX + ballToPivotY * perpY);
        
        // Check if ball is within flipper bounds
        const distToFlipper = Math.sqrt((ball.x - closestX) ** 2 + (ball.y - closestY) ** 2);
        const minDist = ball.radius + width / 2;
        
        if (distToFlipper < minDist) {
            // Calculate overlap
            const overlap = minDist - distToFlipper;
            
            // Calculate normal from flipper to ball
            let normalX = ball.x - closestX;
            let normalY = ball.y - closestY;
            const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);
            
            if (normalLen > 0) {
                normalX /= normalLen;
                normalY /= normalLen;
            } else {
                // If ball is exactly on centerline, use perpendicular
                normalX = perpX;
                normalY = perpY;
            }
            
            // Push ball away from flipper (prevent overlap)
            ball.x += normalX * overlap;
            ball.y += normalY * overlap;
            
            // Calculate collision response
            // Get flipper surface normal (perpendicular to flipper direction, pointing toward ball)
            const surfaceNormalX = normalX;
            const surfaceNormalY = normalY;
            
            // Calculate relative velocity along surface normal
            const relativeVel = ball.vx * surfaceNormalX + ball.vy * surfaceNormalY;
            
            // Bounce with high restitution
            const bounceFactor = 1.8; // Higher bounce
            ball.vx -= 2 * relativeVel * surfaceNormalX * bounceFactor;
            ball.vy -= 2 * relativeVel * surfaceNormalY * bounceFactor;
            
            // Add significant flipper force (much stronger)
            const flipperForce = 20; // Increased significantly
            const flipperVelocityX = flipperDirX;
            const flipperVelocityY = flipperDirY;
            
            // Add velocity in flipper direction (when activated)
            const isActivated = Math.abs(flipper.angle - flipper.targetAngle) < 0.15;
            if (isActivated) {
                ball.vx += flipperVelocityX * flipperForce;
                ball.vy += flipperVelocityY * flipperForce;
            }
            
            return true;
        }
        return false;
    }
    
    // Update ball physics
    function updateBall(deltaTime) {
        // Apply gravity
        ball.vy += GRAVITY;
        
        // Apply friction
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;
        
        // Clamp velocity
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > MAX_VELOCITY) {
            ball.vx = (ball.vx / speed) * MAX_VELOCITY;
            ball.vy = (ball.vy / speed) * MAX_VELOCITY;
        }
        
        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // Check wall collisions
        walls.forEach(wall => {
            if (checkLineCollision(ball, wall)) {
                resolveLineCollision(ball, wall);
            }
        });
        
        // Check obstacle collisions
        obstacles.forEach(obstacle => {
            if (checkLineCollision(ball, obstacle)) {
                resolveLineCollision(ball, obstacle);
            }
        });
        
        // Check bumper collisions
        bumpers.forEach((bumper, index) => {
            if (checkCircleCollision(ball, bumper)) {
                resolveCircleCollision(ball, bumper);
                // Activate glow
                bumperGlows.set(index, BUMPER_GLOW_DURATION);
                // Add score
                score += 10;
                scoreDisplay.textContent = score;
            }
        });
        
        // Check flipper collisions
        checkFlipperCollision(ball, leftFlipper);
        checkFlipperCollision(ball, rightFlipper);
        
        // Check star collision
        if (star) {
            if (checkCircleCollision(ball, star)) {
                score += 100;
                scoreDisplay.textContent = score;
                star = null;
                starLifetime = 0;
                starSpawnTimer = 0; // Reset timer, will wait STAR_RESPAWN_DELAY before next spawn
                isFirstStar = false;
            }
        }
        
        // Check game over (ball in trough)
        if (ball.y > CANVAS_HEIGHT - TROUGH_HEIGHT) {
            gameOver();
        }
    }
    
    // Update flippers
    function updateFlippers(deltaTime) {
        // Left flipper (pivot at left edge, points inwards/right)
        // When activated: rotates counterclockwise (angle decreases)
        if (flippersActive) {
            leftFlipper.targetAngle = LEFT_FLIPPER_ANGLE_MIN; // Point up and inwards
        } else {
            leftFlipper.targetAngle = LEFT_FLIPPER_ANGLE_MAX; // Resting position
        }
        
        if (leftFlipper.angle > leftFlipper.targetAngle) {
            leftFlipper.angle = Math.max(leftFlipper.targetAngle, leftFlipper.angle - FLIPPER_SPEED);
        } else {
            leftFlipper.angle = Math.min(leftFlipper.targetAngle, leftFlipper.angle + FLIPPER_RETURN_SPEED);
        }
        
        // Right flipper (pivot at right edge, points inwards/left)
        // When activated: rotates clockwise (angle increases) - perfectly mirrored
        if (flippersActive) {
            rightFlipper.targetAngle = RIGHT_FLIPPER_ANGLE_MIN; // Point up and inwards
        } else {
            rightFlipper.targetAngle = RIGHT_FLIPPER_ANGLE_MAX; // Resting position
        }
        
        // Right flipper: when activated, angle increases (clockwise)
        // When resting, angle decreases back
        if (rightFlipper.angle < rightFlipper.targetAngle) {
            rightFlipper.angle = Math.min(rightFlipper.targetAngle, rightFlipper.angle + FLIPPER_SPEED);
        } else {
            rightFlipper.angle = Math.max(rightFlipper.targetAngle, rightFlipper.angle - FLIPPER_RETURN_SPEED);
        }
    }
    
    // Update star spawning
    function updateStar(deltaTime) {
        if (star) {
            // Update star lifetime
            starLifetime += deltaTime;
            
            // Remove star after lifetime expires
            if (starLifetime >= STAR_LIFETIME) {
                star = null;
                starLifetime = 0;
                starSpawnTimer = 0; // Reset timer for next spawn
                isFirstStar = false;
            }
        } else {
            // No star active, increment spawn timer
            starSpawnTimer += deltaTime;
            
            // Spawn star after appropriate delay
            const delay = isFirstStar ? STAR_SPAWN_DELAY : STAR_RESPAWN_DELAY;
            if (starSpawnTimer >= delay) {
                star = {
                    x: CANVAS_WIDTH / 2,
                    y: 220,
                    radius: STAR_SIZE / 2
                };
                starLifetime = 0;
                starSpawnTimer = 0;
                isFirstStar = false;
            }
        }
    }
    
    // Update bumper glows
    function updateBumperGlows(deltaTime) {
        bumpers.forEach((bumper, index) => {
            let glow = bumperGlows.get(index) || 0;
            if (glow > 0) {
                glow -= deltaTime;
                bumperGlows.set(index, Math.max(0, glow));
            }
        });
    }
    
    // Draw ball
    function drawBall() {
        if (ball.image.complete && ball.image.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(ball.image, ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);
            ctx.restore();
        } else {
            // Fallback circle
            ctx.fillStyle = '#ffe66d';
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw flipper (shaped like actual pinball flipper)
    function drawFlipper(flipper) {
        ctx.save();
        ctx.translate(flipper.x, flipper.y);
        ctx.rotate(flipper.angle);
        
        // Draw flipper shape (tapered from base to tip)
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        
        // Create a tapered rectangle (wider at base, narrower at tip)
        const segments = 10;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = t * flipper.length;
            const width = flipper.baseWidth * (1 - t) + flipper.tipWidth * t;
            
            if (i === 0) {
                ctx.moveTo(x, -width / 2);
            } else {
                ctx.lineTo(x, -width / 2);
            }
        }
        for (let i = segments; i >= 0; i--) {
            const t = i / segments;
            const x = t * flipper.length;
            const width = flipper.baseWidth * (1 - t) + flipper.tipWidth * t;
            ctx.lineTo(x, width / 2);
        }
        ctx.closePath();
        ctx.fill();
        
        // Outline
        ctx.strokeStyle = '#ffe66d';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Pivot point
        ctx.fillStyle = '#ffe66d';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    // Draw bumper
    function drawBumper(bumper, index) {
        const glow = bumperGlows.get(index) || 0;
        const glowIntensity = glow / BUMPER_GLOW_DURATION;
        
        // Glow effect
        if (glowIntensity > 0) {
            ctx.shadowBlur = 20 * glowIntensity;
            ctx.shadowColor = '#ff6b9d';
        } else {
            ctx.shadowBlur = 0;
        }
        
        // Draw mushroom shape (circle with character image)
        if (bumperImage.complete && bumperImage.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(bumperImage, bumper.x - bumper.radius, bumper.y - bumper.radius, bumper.radius * 2, bumper.radius * 2);
            ctx.restore();
        } else {
            // Fallback circle
            ctx.fillStyle = '#ff6b9d';
            ctx.beginPath();
            ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Outline
        ctx.strokeStyle = '#c77dff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    }
    
    // Draw star
    function drawStar() {
        if (!star) return;
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffe66d';
        
        if (starImage.complete && starImage.naturalWidth > 0) {
            ctx.drawImage(starImage, star.x - star.radius, star.y - star.radius, star.radius * 2, star.radius * 2);
        } else {
            // Fallback star shape
            ctx.fillStyle = '#ffe66d';
            ctx.save();
            ctx.translate(star.x, star.y);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
                const x = Math.cos(angle) * star.radius;
                const y = Math.sin(angle) * star.radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        
        ctx.shadowBlur = 0;
    }
    
    // Draw walls and obstacles
    function drawWalls() {
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 3;
        
        walls.forEach(wall => {
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.stroke();
        });
        
        obstacles.forEach(obstacle => {
            ctx.beginPath();
            ctx.moveTo(obstacle.x1, obstacle.y1);
            ctx.lineTo(obstacle.x2, obstacle.y2);
            ctx.stroke();
        });
    }
    
    // Render game
    function render() {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid background (subtle)
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw walls and obstacles
        drawWalls();
        
        // Draw bumpers
        bumpers.forEach((bumper, index) => {
            drawBumper(bumper, index);
        });
        
        // Draw star
        drawStar();
        
        // Draw flippers
        drawFlipper(leftFlipper);
        drawFlipper(rightFlipper);
        
        // Draw ball (on top)
        drawBall();
        
        // Draw trough warning
        ctx.fillStyle = 'rgba(255, 107, 157, 0.3)';
        ctx.fillRect(0, CANVAS_HEIGHT - TROUGH_HEIGHT, CANVAS_WIDTH, TROUGH_HEIGHT);
    }
    
    // Game loop
    function gameLoopFunction(currentTime) {
        if (!gameRunning) return;
        
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        // Update game state
        updateBall(deltaTime);
        updateFlippers(deltaTime);
        updateStar(deltaTime);
        updateBumperGlows(deltaTime);
        
        // Render
        render();
        
        gameLoop = requestAnimationFrame(gameLoopFunction);
    }
    
    // Start game
    function startGame() {
        // Reset game state
        ball.x = CANVAS_WIDTH / 2;
        ball.y = 100;
        ball.vx = (Math.random() - 0.5) * 2;
        ball.vy = 0;
        
        leftFlipper.angle = LEFT_FLIPPER_ANGLE_MAX;
        rightFlipper.angle = RIGHT_FLIPPER_ANGLE_MAX;
        leftFlipper.targetAngle = LEFT_FLIPPER_ANGLE_MAX;
        rightFlipper.targetAngle = RIGHT_FLIPPER_ANGLE_MAX;
        
        score = 0;
        scoreDisplay.textContent = score;
        
        star = null;
        starSpawnTimer = 0;
        starLifetime = 0;
        isFirstStar = true;
        
        gameRunning = true;
        gameOverOverlay.classList.remove('active');
        flippersActive = false;
        
        initializeBoard();
        
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
    
    // Input handling
    function activateFlippers() {
        if (gameRunning) {
            flippersActive = true;
        }
    }
    
    function deactivateFlippers() {
        flippersActive = false;
    }
    
    // Mouse/touch controls
    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        activateFlippers();
    });
    
    canvas.addEventListener('mouseup', (e) => {
        e.preventDefault();
        deactivateFlippers();
    });
    
    canvas.addEventListener('mouseleave', () => {
        deactivateFlippers();
    });
    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        activateFlippers();
    });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        deactivateFlippers();
    });
    
    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        deactivateFlippers();
    });
    
    // Keyboard controls (optional)
    document.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            activateFlippers();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            deactivateFlippers();
        }
    });
    
    // Restart button
    document.getElementById('restartButton').addEventListener('click', restartGame);
    
    // Start game when page loads (after images are loaded)
    // startGame() is called in onImageLoad()
    
})();
