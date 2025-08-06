window.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const cameraUi = document.getElementById('camera-ui');
    const pixiCanvasContainer = document.getElementById('pixi-canvas');

    // Temporarily skip camera UI and start game directly
    cameraUi.style.display = 'none';
    pixiCanvasContainer.style.display = 'block';
    const sessionId = `dummy_session_${Date.now()}`;
    startGame(sessionId);
});

// ======================================================================
// GAME LOGIC (runs after photo is confirmed)
// ======================================================================
async function startGame(sessionId) {
    const app = new PIXI.Application({
        width: 800,
        height: 600,
        backgroundColor: 0xFFFFFF, // White background
    });
    await app.init(); // Initialize the PixiJS application asynchronously
    document.getElementById('pixi-canvas').appendChild(app.canvas);

    let score = 0, level = 1, gameOver = false;

    const LANES = [-1, 0, 1], LANE_WIDTH = 150; // -1: left, 0: center, 1: right
    let currentLane = 0; // 0 for center lane

    const obstacles = [];
    let obstacleSpeed = 4, obstacleCreationInterval = 1500;
    let obstacleCreator; // Declare obstacleCreator once here

    const scoreText = new PIXI.Text(`Score: ${score}`, { fill: 'white', fontSize: 24 });
    scoreText.position.set(20, 20);
    app.stage.addChild(scoreText);

    const levelText = new PIXI.Text(`Level: ${level}`, { fill: 'white', fontSize: 24 });
    levelText.position.set(20, 50);
    app.stage.addChild(levelText);

    const character = new PIXI.Graphics().rect(0, 0, 50, 50).fill(0x00FF00); // Green square character
    character.pivot.set(character.width / 2, character.height / 2); // Set pivot to center for Graphics object
    character.x = app.screen.width / 2 + LANES[currentLane + 1] * LANE_WIDTH; // Initial position
    character.y = app.screen.height - 100;
    app.stage.addChild(character);

    function createObstacle() {
        if (gameOver) return;
        const obstacle = new PIXI.Graphics().rect(0, 0, 50, 50).fill(0xFF0000); // Simple red obstacle
        obstacle.pivot.set(25, 25);
        const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        obstacle.x = app.screen.width / 2 + lane * LANE_WIDTH;
        obstacle.y = -50;
        obstacle.lane = lane; // Store lane information
        app.stage.addChild(obstacle);
        obstacles.push(obstacle);
    }

    function levelUp() {
        level++;
        levelText.text = `Level: ${level}`;
        obstacleSpeed += 1.5;
        obstacleCreationInterval = Math.max(500, obstacleCreationInterval - 250);
        clearInterval(obstacleCreator);
        obstacleCreator = setInterval(createObstacle, obstacleCreationInterval);
    }

    app.ticker.add((ticker) => {
        if (gameOver) return;
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            obstacle.y += obstacleSpeed * ticker.deltaTime;

            // Collision detection
            const charBounds = character.getBounds();
            const obsBounds = obstacle.getBounds();

            // Check for overlap in the same lane
            const hit = obstacle.lane === currentLane &&
                        charBounds.x < obsBounds.x + obsBounds.width &&
                        charBounds.x + charBounds.width > obsBounds.x &&
                        charBounds.y < obsBounds.y + obsBounds.height &&
                        charBounds.y + charBounds.height > obsBounds.y;

            if (hit) {
                gameOver = true;
                app.ticker.stop();
                const gameOverText = new PIXI.Text('GAME OVER', { fill: 'red', fontSize: 64, fontWeight: 'bold' });
                gameOverText.anchor.set(0.5);
                gameOverText.x = app.screen.width / 2;
                gameOverText.y = app.screen.height / 2 - 50;
                app.stage.addChild(gameOverText);

                const restartButton = new PIXI.Text('RESTART', { fill: 'white', fontSize: 32, fontWeight: 'bold' });
                restartButton.anchor.set(0.5);
                restartButton.x = app.screen.width / 2;
                restartButton.y = app.screen.height / 2 + 50;
                restartButton.eventMode = 'static'; // Enable interactivity
                restartButton.buttonMode = true; // Show pointer cursor on hover
                restartButton.on('pointerdown', () => {
                    window.location.reload(); // Reload the page to restart the game
                });
                app.stage.addChild(restartButton);

                // Listen for Enter or Space key to restart
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        window.location.reload();
                    }
                }, { once: true }); // Use { once: true } to remove listener after first trigger
                return;
            }

            if (obstacle.y > app.screen.height + 50) {
                score += 10;
                scoreText.text = `Score: ${score}`;
                if (score > 0 && score % 100 === 0) levelUp();
                app.stage.removeChild(obstacle);
                obstacles.splice(i, 1);
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (gameOver) return;
        if (e.key === 'ArrowLeft' && currentLane > -1) {
            currentLane--;
            character.x = app.screen.width / 2 + LANES[currentLane + 1] * LANE_WIDTH;
        } else if (e.key === 'ArrowRight' && currentLane < 1) {
            currentLane++;
            character.x = app.screen.width / 2 + LANES[currentLane + 1] * LANE_WIDTH;
        }
    });

    // Start obstacle creation after all initializations
    obstacleCreator = setInterval(createObstacle, obstacleCreationInterval);
}