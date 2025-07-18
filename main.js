// ==================================================
// SETUP
// ==================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set initial camera position relative to player mesh (eye level)
camera.position.y = 0.8;

// ==================================================
// GAME STATE & OBJECTS
// ==================================================
let player, weapons, gameRunning, animationId;
let keyboard = {}, mouse = { down: false };
let bullets = [], enemies = [], healthPacks = [];

const bulletSpeed = 1.5;
const enemyBaseSpeed = 0.02;

const enemyTypes = [
    { name: 'Goblin', color: 0x8B4513, health: 20, speed: 0.03, attackDamage: 5, attackCooldown: 1000 },
    { name: 'Skeleton', color: 0xC0C0C0, health: 30, speed: 0.025, attackDamage: 10, attackCooldown: 1500 },
    { name: 'Zombie', color: 0x556B2F, health: 40, speed: 0.015, attackDamage: 15, attackCooldown: 2000 },
    { name: 'Imp', color: 0x800000, health: 25, speed: 0.04, attackDamage: 8, attackCooldown: 800 },
    { name: 'Dark Knight', color: 0x36454F, health: 80, speed: 0.02, attackDamage: 20, attackCooldown: 2500 },
    { name: 'Demon', color: 0xFF0000, health: 100, speed: 0.035, attackDamage: 25, attackCooldown: 1800 },
    { name: 'Ghost', color: 0xADD8E6, health: 15, speed: 0.05, attackDamage: 7, attackCooldown: 700 },
    { name: 'Ogre', color: 0x6B8E23, health: 120, speed: 0.01, attackDamage: 30, attackCooldown: 3000 },
    { name: 'Vampire', color: 0x4B0082, health: 70, speed: 0.03, attackDamage: 18, attackCooldown: 1200 },
    { name: 'Werewolf', color: 0x696969, health: 90, speed: 0.045, attackDamage: 22, attackCooldown: 1000 },
];

function initGameState() {
    scene.background = new THREE.Color(0x87CEEB); // Set a sky blue background for debugging

    player = {
        health: 100,
        ammo: 100,
        healthPacks: 0,
        score: 0,
        speed: 0.1,
        mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false })),
        currentWeapon: 'pistol',
        lastShotTime: 0,
    };
    player.mesh.position.set(0, 1, 0); // Set initial player position above ground
    player.mesh.add(camera); // Attach camera to player mesh
    scene.add(player.mesh);

    weapons = {
        pistol: { name: 'Pistol', ammoCost: 1, fireRate: 400, spread: 0.01, bulletCount: 1 },
        shotgun: { name: 'Shotgun', ammoCost: 5, fireRate: 1000, spread: 0.1, bulletCount: 8 },
        machinegun: { name: 'Machine Gun', ammoCost: 1, fireRate: 100, spread: 0.05, bulletCount: 1 },
    };

    gameRunning = true;
    animationId = null;

    keyboard = {};
    mouse = { down: false };
    bullets = [];
    enemies = [];
    healthPacks = [];
}

// ==================================================
// SCENE & WORLD
// ==================================================
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: 0x404040, side: THREE.DoubleSide })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const light = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
scene.add(light);

// ==================================================
// UI
// ==================================================
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const ammoEl = document.getElementById('ammo');
const healthPacksEl = document.getElementById('health-packs');
const weaponEl = document.getElementById('current-weapon');
const gameOverScreen = document.getElementById('game-over-screen');
const restartButton = document.getElementById('restart-button');

function updateUI() {
    scoreEl.innerText = player.score;
    healthEl.innerText = Math.max(0, player.health);
    ammoEl.innerText = player.ammo;
    healthPacksEl.innerText = player.healthPacks;
    weaponEl.innerText = weapons[player.currentWeapon].name;
}

// ==================================================
// CONTROLS
// ==================================================
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keyboard[key] = true;

    // Weapon Switching
    if (gameRunning) {
        if (key === '1') player.currentWeapon = 'pistol';
        if (key === '2') player.currentWeapon = 'shotgun';
        if (key === '3') player.currentWeapon = 'machinegun';
        updateUI();
    }

    // Melee
    if (key === 'f' && gameRunning) {
        const playerPosition = player.mesh.position.clone();
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.mesh.position.distanceTo(playerPosition) < 2.5) {
                killEnemy(i);
            }
        }
    }

    // Use Health Pack
    if (key === 'q' && gameRunning) {
        if (player.healthPacks > 0 && player.health < 100) {
            player.healthPacks--;
            player.health = Math.min(100, player.health + 25);
            updateUI();
        }
    }
});
window.addEventListener('keyup', (e) => { keyboard[e.key.toLowerCase()] = false; });

window.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });

document.body.addEventListener('click', () => { if(gameRunning && document.body) document.body.requestPointerLock(); });

const onMouseMove = (e) => {
    if (document.pointerLockElement === document.body && gameRunning) {
        player.mesh.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
};
document.addEventListener('mousemove', onMouseMove);

restartButton.addEventListener('click', restartGame);

// ==================================================
// GAME LOGIC
// ==================================================
function shoot() {
    const weapon = weapons[player.currentWeapon];
    const now = performance.now();

    if (gameRunning && player.ammo >= weapon.ammoCost && now - player.lastShotTime > weapon.fireRate) {
        player.lastShotTime = now;
        player.ammo -= weapon.ammoCost;
        updateUI();

        for (let i = 0; i < weapon.bulletCount; i++) {
            const bullet = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xffff00 })
            );

            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);

            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * weapon.spread,
                (Math.random() - 0.5) * weapon.spread,
                (Math.random() - 0.5) * weapon.spread
            );
            camDir.add(spread).normalize();

            bullet.velocity = camDir.multiplyScalar(bulletSpeed);

            const camPos = new THREE.Vector3();
            camera.getWorldPosition(camPos);
            bullet.position.copy(camPos);

            bullets.push(bullet);
            scene.add(bullet);
        }
    }
}

function killEnemy(index) {
    scene.remove(enemies[index].mesh);
    enemies.splice(index, 1);
    player.score += 10;
    updateUI();
    spawnEnemy();
}

function enemyTakeDamage(enemyIndex, damage) {
    enemies[enemyIndex].health -= damage;
    if (enemies[enemyIndex].health <= 0) {
        killEnemy(enemyIndex);
    }
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    gameOverScreen.style.display = 'flex';
    document.exitPointerLock();
}

function restartGame() {
    // Clear scene
    if (player && player.mesh) scene.remove(player.mesh);
    bullets.forEach(b => scene.remove(b));
    enemies.forEach(e => scene.remove(e.mesh));
    healthPacks.forEach(h => scene.remove(h));

    // Reset arrays
    bullets.length = 0;
    enemies.length = 0;
    healthPacks.length = 0;
    keyboard = {};

    // Reset state (this will also add player.mesh to scene)
    initGameState();

    // Initial spawn
    for (let i = 0; i < 10; i++) { spawnEnemy(); }
    for (let i = 0; i < 5; i++) { spawnHealthPack(); }

    // Hide game over screen and start game
    gameOverScreen.style.display = 'none';
    updateUI();
    animate();
    document.body.requestPointerLock();
}

// ==================================================
// SPAWNING
// ==================================================
function spawnEnemy() {
    const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const enemyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshBasicMaterial({ color: type.color })
    );
    enemyMesh.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
    const speed = type.speed + (player.score / 5000); // Difficulty scaling
    enemies.push({ mesh: enemyMesh, type: type, health: type.health, speed: speed, lastAttackTime: 0 });
    scene.add(enemyMesh);
}

function spawnHealthPack() {
    const healthPackMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16),
        new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    healthPackMesh.position.set((Math.random() - 0.5) * 90, 0.25, (Math.random() - 0.5) * 90);
    healthPacks.push(healthPackMesh);
    scene.add(healthPackMesh);
}

// ==================================================
// MAIN LOOP
// ==================================================
function animate() {
    if (!gameRunning) return;
    animationId = requestAnimationFrame(animate);

    // Continuous shooting (for machine gun)
    if (mouse.down && player.currentWeapon === 'machinegun') {
        shoot();
    } else if (mouse.down) {
        // For single-shot weapons, we handle this in the 'mousedown' event, but we'll add it here and prevent spam
        if (!window.shotFiredInFrame) {
            shoot();
            window.shotFiredInFrame = true;
        }
    } else {
        window.shotFiredInFrame = false;
    }

    // Player movement
    const forward = new THREE.Vector3();
    player.mesh.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(player.mesh.up, forward).normalize();

    if (keyboard['w']) { player.mesh.position.addScaledVector(forward, -player.speed); }
    if (keyboard['s']) { player.mesh.position.addScaledVector(forward, player.speed); }
    if (keyboard['a']) { player.mesh.position.addScaledVector(right, -player.speed); }
    if (keyboard['d']) { player.mesh.position.addScaledVector(right, player.speed); }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.position.add(bullet.velocity);
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullet.position.distanceTo(enemies[j].mesh.position) < 1.5) {
                enemyTakeDamage(j, 25); // Assuming 25 damage per bullet for now
                scene.remove(bullet);
                bullets.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;
        if (bullet.position.distanceTo(player.mesh.position) > 200) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }

    // Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.mesh.lookAt(player.mesh.position);
        enemy.mesh.translateZ(enemy.speed);

        // Enemy attack logic
        const now = performance.now();
        if (enemy.mesh.position.distanceTo(player.mesh.position) < 2 && now - enemy.lastAttackTime > enemy.type.attackCooldown) {
            player.health -= enemy.type.attackDamage;
            enemy.lastAttackTime = now;
            updateUI();
            if (player.health <= 0) {
                gameOver();
            }
        }
    }

    // Check for health pack collision
    for (let i = healthPacks.length - 1; i >= 0; i--) {
        const pack = healthPacks[i];
        if (pack.position.distanceTo(player.mesh.position) < 1.5) {
            player.healthPacks++;
            updateUI();
            scene.remove(pack);
            healthPacks.splice(i, 1);
            spawnHealthPack();
        }
    }

    renderer.render(scene, camera);
}

// ==================================================
// INITIALIZATION
// ==================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// A bit of a hack to handle single shots vs machine gun
window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && gameRunning) {
        if (player.currentWeapon !== 'machinegun') {
            shoot();
        }
    }
});


restartGame(); // Start the game for the first time
