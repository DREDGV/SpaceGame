class Physics {
    applyGravity(rocket, planets, dt) {
        for (const planet of planets) {
            const dx = rocket.x - planet.x;
            const dy = rocket.y - planet.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);
            
            if (dist > 0) {
                const gravityForce = CONFIG.GRAVITY_CONSTANT * planet.radius / distSq;
                const ax = -gravityForce * dx / dist;
                const ay = -gravityForce * dy / dist;
                
                rocket.vx += ax * dt;
                rocket.vy += ay * dt;
            }
        }
    }

    checkCollision(rocket, planet) {
        const dist = rocket.distanceTo(planet);
        return dist < planet.radius + rocket.radius;
    }
}
