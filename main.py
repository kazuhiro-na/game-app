import pyxel
import random

# 敵の種類
ENEMY_TYPES = [
    {"name": "Goblin", "color": 8, "health": 20, "speed": 0.8, "attack_damage": 5, "score": 10},
    {"name": "Skeleton", "color": 7, "health": 30, "speed": 0.6, "attack_damage": 10, "score": 15},
    {"name": "Zombie", "color": 13, "health": 40, "speed": 0.4, "attack_damage": 15, "score": 20},
]

# 武器の種類
WEAPONS = {
    "pistol": {"name": "Pistol", "ammo_cost": 1, "fire_rate": 15, "bullet_speed": 4, "bullet_count": 1, "spread": 5},
    "shotgun": {"name": "Shotgun", "ammo_cost": 5, "fire_rate": 40, "bullet_speed": 3, "bullet_count": 6, "spread": 30},
    "machinegun": {"name": "Machine Gun", "ammo_cost": 1, "fire_rate": 5, "bullet_speed": 5, "bullet_count": 1, "spread": 10},
}

class Game:
    def __init__(self):
        pyxel.init(256, 256, title="2D Shooter", fps=60)
        self.gamestate = 0  # 0: Running, 1: Game Over
        self.setup()
        pyxel.run(self.update, self.draw)

    def setup(self):
        self.player_x = pyxel.width / 2
        self.player_y = pyxel.height / 2
        self.player_health = 100
        self.player_speed = 1.5
        self.ammo = 100
        self.score = 0
        self.health_packs = 0
        
        self.current_weapon = "pistol"
        self.last_shot_time = 0

        self.bullets = []
        self.enemies = []
        self.health_pack_items = []

        # Warning System
        self.warning_distance = 40
        self.warning_active = False

        for _ in range(5):
            self.spawn_enemy()
            
        for _ in range(3):
            self.spawn_health_pack()

    def update(self):
        if self.gamestate == 1:
            if pyxel.btnp(pyxel.KEY_R):
                self.gamestate = 0
                self.setup()
            return

        self.update_player()
        self.update_bullets()
        self.update_enemies()
        self.update_health_packs()
        self.update_warning_system()
        
        self.last_shot_time += 1

    def update_player(self):
        # Movement
        if pyxel.btn(pyxel.KEY_W):
            self.player_y = max(self.player_y - self.player_speed, 0)
        if pyxel.btn(pyxel.KEY_S):
            self.player_y = min(self.player_y + self.player_speed, pyxel.height - 8)
        if pyxel.btn(pyxel.KEY_A):
            self.player_x = max(self.player_x - self.player_speed, 0)
        if pyxel.btn(pyxel.KEY_D):
            self.player_x = min(self.player_x + self.player_speed, pyxel.width - 8)

        # Weapon Switching
        if pyxel.btnp(pyxel.KEY_1):
            self.current_weapon = "pistol"
        if pyxel.btnp(pyxel.KEY_2):
            self.current_weapon = "shotgun"
        if pyxel.btnp(pyxel.KEY_3):
            self.current_weapon = "machinegun"
            
        # Use Health Pack
        if pyxel.btnp(pyxel.KEY_Q) and self.health_packs > 0 and self.player_health < 100:
            self.health_packs -= 1
            self.player_health = min(100, self.player_health + 25)

        # Shooting
        weapon = WEAPONS[self.current_weapon]
        if pyxel.btn(pyxel.MOUSE_BUTTON_LEFT) and self.ammo >= weapon["ammo_cost"] and self.last_shot_time > weapon["fire_rate"]:
            self.last_shot_time = 0
            self.ammo -= weapon["ammo_cost"]
            
            for _ in range(weapon["bullet_count"]):
                angle = self.get_angle_to_mouse() + random.uniform(-weapon["spread"], weapon["spread"]) * (3.14159 / 180)
                self.bullets.append({
                    "x": self.player_x + 4, 
                    "y": self.player_y + 4, 
                    "vx": pyxel.cos(angle) * weapon["bullet_speed"], 
                    "vy": pyxel.sin(angle) * weapon["bullet_speed"]
                })

    def update_bullets(self):
        for bullet in self.bullets[:]:
            bullet["x"] += bullet["vx"]
            bullet["y"] += bullet["vy"]
            
            # Remove bullets that are off-screen
            if not (0 < bullet["x"] < pyxel.width and 0 < bullet["y"] < pyxel.height):
                self.bullets.remove(bullet)
                continue

            # Collision with enemies
            for enemy in self.enemies[:]:
                if abs(bullet["x"] - enemy["x"]) < 6 and abs(bullet["y"] - enemy["y"]) < 6:
                    enemy["health"] -= 25  # Damage
                    if bullet in self.bullets:
                        self.bullets.remove(bullet)
                    if enemy["health"] <= 0:
                        self.score += enemy["score"]
                        self.enemies.remove(enemy)
                        self.spawn_enemy()
                    break

    def update_enemies(self):
        for enemy in self.enemies:
            # Move towards player
            angle = pyxel.atan2(self.player_y - enemy["y"], self.player_x - enemy["x"])
            enemy["x"] += pyxel.cos(angle) * enemy["speed"]
            enemy["y"] += pyxel.sin(angle) * enemy["speed"]

            # Collision with player
            if abs(self.player_x - enemy["x"]) < 6 and abs(self.player_y - enemy["y"]) < 6:
                self.player_health -= enemy["attack_damage"]
                if self.player_health <= 0:
                    self.gamestate = 1 # Game Over

    def update_health_packs(self):
        for pack in self.health_pack_items[:]:
            if abs(self.player_x - pack["x"]) < 8 and abs(self.player_y - pack["y"]) < 8:
                self.health_packs += 1
                self.health_pack_items.remove(pack)
                self.spawn_health_pack()

    def update_warning_system(self):
        closest_enemy_dist = float('inf')
        if not self.enemies:
            self.warning_active = False
            return

        for enemy in self.enemies:
            dist = pyxel.sqrt((self.player_x - enemy["x"])**2 + (self.player_y - enemy["y"])**2)
            if dist < closest_enemy_dist:
                closest_enemy_dist = dist
        
        if closest_enemy_dist < self.warning_distance:
            self.warning_active = True
        else:
            self.warning_active = False

    def spawn_enemy(self):
        side = random.choice(["top", "bottom", "left", "right"])
        x, y = 0, 0
        if side == "top":
            x, y = random.uniform(0, pyxel.width), 0
        elif side == "bottom":
            x, y = random.uniform(0, pyxel.width), pyxel.height
        elif side == "left":
            x, y = 0, random.uniform(0, pyxel.height)
        elif side == "right":
            x, y = pyxel.width, random.uniform(0, pyxel.height)
        
        enemy_type = random.choice(ENEMY_TYPES)
        self.enemies.append({
            "x": x, "y": y, **enemy_type
        })

    def spawn_health_pack(self):
        self.health_pack_items.append({
            "x": random.uniform(20, pyxel.width - 20),
            "y": random.uniform(20, pyxel.height - 20)
        })

    def get_angle_to_mouse(self):
        return pyxel.atan2(pyxel.mouse_y - self.player_y, pyxel.mouse_x - self.player_x)

    def draw(self):
        pyxel.cls(0) # Black background

        # Draw warning flash
        if self.warning_active and pyxel.frame_count % 10 < 5:
            pyxel.rectb(0, 0, pyxel.width, pyxel.height, 8) # Draw a red border
        
        # Draw player
        pyxel.rect(self.player_x, self.player_y, 8, 8, 11) # Blue player

        # Draw bullets
        for bullet in self.bullets:
            pyxel.circ(bullet["x"], bullet["y"], 1, 10) # Yellow bullets

        # Draw enemies
        for enemy in self.enemies:
            pyxel.rect(enemy["x"], enemy["y"], 8, 8, enemy["color"])
            
        # Draw health packs
        for pack in self.health_pack_items:
            pyxel.rect(pack["x"], pack["y"], 6, 6, 5) # Green health packs
            pyxel.rect(pack["x"]+2, pack["y"]-1, 2, 8, 7)
            pyxel.rect(pack["x"]-1, pack["y"]+2, 8, 2, 7)

        # Draw UI
        self.draw_ui()
        
        if self.gamestate == 1:
            self.draw_game_over()
        else:
            # Draw crosshair
            pyxel.pset(pyxel.mouse_x - 2, pyxel.mouse_y - 2, 7)
            pyxel.pset(pyxel.mouse_x + 2, pyxel.mouse_y - 2, 7)
            pyxel.pset(pyxel.mouse_x - 2, pyxel.mouse_y + 2, 7)
            pyxel.pset(pyxel.mouse_x + 2, pyxel.mouse_y + 2, 7)
            pyxel.pset(pyxel.mouse_x - 3, pyxel.mouse_y - 3, 0)
            pyxel.pset(pyxel.mouse_x + 3, pyxel.mouse_y - 3, 0)
            pyxel.pset(pyxel.mouse_x - 3, pyxel.mouse_y + 3, 0)
            pyxel.pset(pyxel.mouse_x + 3, pyxel.mouse_y + 3, 0)

    def draw_ui(self):
        pyxel.text(5, 5, f"Score: {self.score}", 7)
        pyxel.text(5, 15, f"Health: {max(0, self.player_health)}", 7)
        pyxel.text(5, 25, f"Ammo: {self.ammo}", 7)
        pyxel.text(5, 35, f"Packs: {self.health_packs}", 7)
        pyxel.text(5, 45, f"Weapon: {WEAPONS[self.current_weapon]['name']}", 7)

    def draw_game_over(self):
        pyxel.text(pyxel.width/2 - 20, pyxel.height/2 - 10, "GAME OVER", pyxel.frame_count % 16)
        pyxel.text(pyxel.width/2 - 30, pyxel.height/2, "Press R to Restart", 7)

Game()