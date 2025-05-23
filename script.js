// Инициализация сцены
const canvas = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.layers.enable(1); // Включаем слой для частиц
camera.updateProjectionMatrix(); // Обязательно обновляйте матрицу после изменений

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = false;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.5;

// Добавляем переменные для текста
const textOverlay = document.querySelector('.text-overlay');
let textVisible = false;

// Параметры свечения
let emissionIntensity = 0;
const MAX_EMISSION_INTENSITY = 0.45;
const EMISSION_SPEED = 0.001;
const EMISSION_COLOR = new THREE.Color(0xf4f4f4);
let emissionPeakReached = false;
const PARTICLE_BURST_COUNT = 300;
let burstParticles = null;
// Добавляем в раздел с переменными
let particlesActivated = false; // Флаг активации частиц
const PARTICLES_MIN_OPACITY = 0.3; // Минимальная прозрачность частиц

// Настройка Bloom эффекта
const bloomParams = {
    strength: 3.5,
    radius: 0.9,
    threshold: 0.3
};

// Создаем композер для bloom
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomParams.strength,
    bloomParams.radius,
    bloomParams.threshold
);

const bloomComposer = new THREE.EffectComposer(renderer);
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

// Слой для объектов с bloom
const bloomLayer = new THREE.Layers();
bloomLayer.set(1);

// Освещение
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));


// Переменные для анимации
let pulseTime = 0;
const PARTICLE_COUNT = 150;
const REACT_DISTANCE = 300;
let model;
let fragments = [];
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const originalPositions = [];
const originalRotations = [];
let explodeFactor = 0;
const maxExplodeDistance = 0.3;
const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };
const rotationSpeed = 0.02;
const maxRotation = Math.PI / 4;
const fragmentScale = 1.02;
let isCursorNear = false;
const EXPLODE_THRESHOLD = 1.2; // Дистанция камеры для активации взрыва
const MAX_EXPLODE_DISTANCE = 0.5; // Максимальная сила взрыва
const MOUSE_EXPLODE_FACTOR = 0.3; // Максимальная сила вибрации от мыши


// Обновите функцию handleScroll:
function handleScroll() {
    scrollProgress = Math.min(window.scrollY / SCROLL.scrollRange, 1);
    console.log(`Scroll progress: ${scrollProgress.toFixed(3)}`);
}

// Обновленные настройки частиц
const PARTICLE_SETTINGS = {
  count: 200,            // Общее количество частиц
  size: 2.4,           // Размер частиц
  speed: 0.003,         // Скорость движения
  spawnArea: 0.1        // Область появления вокруг модели (0-1)
};

// Переменные для управления частицами
let particles = null;
let particleSystemInitialized = false;
let targetCameraDistance = 2.0; // Начальная дистанция камеры
let currentCameraDistance = 2.0;

// Добавляем в раздел с переменными
let scrollY = 0;
const SCROLL = {
  minDistance: -2,    // Ближайшее расстояние (при полном скролле вниз)
  maxDistance: 3.0,    // Начальное расстояние (без скролла)
  scrollRange: 2000    // Диапазон скролла в пикселях для полного эффекта
};
let scrollProgress = 0;

// Добавляем в самом начале (после объявления переменных)
window.addEventListener('scroll', handleScroll);
handleScroll(); // Инициализация начального значения


// Функция для отладки
function debugInfo() {
    console.log(`Emission intensity: ${emissionIntensity.toFixed(3)}/${MAX_EMISSION_INTENSITY}`);
    console.log(`Particles on scene: ${burstParticles ? 'Burst particles active' : 'No burst particles'}`);
    console.log(`Model loaded: ${model ? 'Yes' : 'No'}`);
    console.log(`Cursor near: ${isCursorNear}`);
}

// Обновленная функция updateEmission с отладкой
function updateEmission() {
    if (!fragments.length || !model) {
        console.log("No fragments or model not loaded");
        return;
    }
    
    pulseTime += 0.01;
    const pulseFactor = 1 + Math.sin(pulseTime) * 0.1;
    
    // Проверяем пересечение только если курсор рядом
    let isIntersecting = false;
    if (isCursorNear) {
        raycaster.setFromCamera(mouse, camera);
        isIntersecting = raycaster.intersectObject(model, true).length > 0;
    }
    
    if (isCursorNear && isIntersecting) {
        const prevIntensity = emissionIntensity;
        emissionIntensity = Math.min(emissionIntensity + EMISSION_SPEED, MAX_EMISSION_INTENSITY);
        
        // Отладочная информация
        if (emissionIntensity >= MAX_EMISSION_INTENSITY * 0.99) {
            console.log("MAX EMISSION INTENSITY REACHED!");
        }
        
        // Проверяем, достигли ли мы максимума в этом кадре
        if (!emissionPeakReached && emissionIntensity >= MAX_EMISSION_INTENSITY * 0.99) {
            console.log("Creating particle burst...");
            createParticleBurst();
            emissionPeakReached = true;
        }
    } else {
        emissionIntensity = Math.max(emissionIntensity - EMISSION_SPEED * 2, 0);
        emissionPeakReached = false;
    }
    
    const currentIntensity = emissionIntensity * pulseFactor;
    
    fragments.forEach(fragment => {
        if (fragment.isMesh) {
            fragment.material.emissive.copy(EMISSION_COLOR)
                .multiplyScalar(currentIntensity);
            fragment.material.emissiveIntensity = currentIntensity;
            fragment.material.needsUpdate = true;
        }
    });

    // Обновляем частицы всплеска
    if (burstParticles) {
        updateBurstParticles();
    }
    
    // Периодически выводим отладочную информацию
    if (Math.random() < 0.01) {
        debugInfo();
    }
}

// Улучшенная функция создания всплеска частиц
// Обновленная функция createParticleBurst (белые частицы одинакового размера)
function createParticleBurst() {
    if (!model) return;

    const burstBox = new THREE.Box3().setFromObject(model);
    const burstCenter = burstBox.getCenter(new THREE.Vector3());
    const burstSize = burstBox.getSize(new THREE.Vector3()).length();
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_BURST_COUNT * 3);
    const colors = new Float32Array(PARTICLE_BURST_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_BURST_COUNT);

    for (let i = 0; i < PARTICLE_BURST_COUNT; i++) {
        const r = burstSize * 0.5 * Math.random();
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i * 3] = burstCenter.x + r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = burstCenter.y + r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = burstCenter.z + r * Math.cos(phi);
        
        // Белый цвет для burst частиц
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
        
        // Такой же размер как у обычных частиц
        sizes[i] = burstSize * 0.01;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: burstSize * 0.01, // Такой же размер как у обычных частиц
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: false
    });

    burstParticles = new THREE.Points(geometry, material);
    burstParticles.layers.enable(1);
    
    burstParticles.userData = {
        velocities: Array(PARTICLE_BURST_COUNT).fill().map(() => ({
            vx: (Math.random() - 0.5) * 0.03,
            vy: (Math.random() - 0.5) * 0.03,
            vz: (Math.random() - 0.5) * 0.03,
            life: 100 + Math.random() * 50
        })),
        time: 0
    };
    
    scene.add(burstParticles);
}


// Обновление частиц всплеска с защитой от ошибок
function updateBurstParticles() {
    if (!burstParticles || !burstParticles.geometry) return;
    
    try {
        const positions = burstParticles.geometry.attributes.position.array;
        const userData = burstParticles.userData;
        userData.time++;
        
        let allDead = true;
        
        for (let i = 0; i < PARTICLE_BURST_COUNT; i++) {
            const offset = i * 3;
            const vel = userData.velocities[i];
            
            if (userData.time < vel.life) {
                allDead = false;
                
                // Увеличиваем скорость со временем
                const speedFactor = 0.1 + userData.time * 0.01;
                
                positions[offset] += vel.vx * speedFactor;
                positions[offset + 1] += vel.vy * speedFactor;
                positions[offset + 2] += vel.vz * speedFactor;
                
                // Постепенное исчезновение
                const lifeRatio = 1.0 - (userData.time / vel.life);
                burstParticles.material.opacity = lifeRatio * 0.8;
            }
        }
        
        burstParticles.geometry.attributes.position.needsUpdate = true;
        
        // Удаляем частицы, когда все "умерли"
        if (allDead) {
            scene.remove(burstParticles);
            burstParticles.geometry.dispose();
            burstParticles.material.dispose();
            burstParticles = null;
            console.log('Particle burst removed');
        }
    } catch (e) {
        console.error('Error updating burst particles:', e);
    }
}

// Функция для обновления позиции камеры
function updateCameraPosition() {
    if (!model) return;
    
    const targetDistance = THREE.MathUtils.lerp(
        SCROLL.maxDistance,
        SCROLL.minDistance,
        scrollProgress
    );
    
    camera.position.z += (targetDistance - camera.position.z) * 0.01;

    
    // Для отладки
    console.log(`Target distance: ${targetDistance.toFixed(2)}, Current: ${camera.position.z.toFixed(2)}`);
}


// Загрузка модели с улучшенной обработкой ошибок
const loader = new THREE.GLTFLoader();
loader.load('model.glb', (gltf) => {
    try {
        model = gltf.scene;
        
        // Центрирование модели
        const initBox = new THREE.Box3().setFromObject(model);
        const initCenter = initBox.getCenter(new THREE.Vector3());
        model.position.sub(initCenter);
        
        // Начальная позиция камеры
        const initSize = initBox.getSize(new THREE.Vector3()).length();
        camera.position.z = initSize * SCROLL.maxDistance;
        model.traverse((child) => {
            if (child.isMesh) {
                child.userData.originalColor = child.material.color.clone();
                child.userData.originalEmissive = child.material.emissive 
                    ? child.material.emissive.clone() 
                    : new THREE.Color(0x000000);
                child.userData.originalEmissiveIntensity = child.material.emissiveIntensity || 0;
                
                if (!child.material.emissive) {
                    child.material.emissive = new THREE.Color(0x000000);
                }
                child.material.emissiveIntensity = 0;
                child.layers.enable(1);
                
                fragments.push(child);
                child.scale.set(fragmentScale, fragmentScale, fragmentScale);
                originalPositions.push({
                    position: child.position.clone(),
                    worldPosition: child.getWorldPosition(new THREE.Vector3()).clone()
                });
                originalRotations.push(child.rotation.clone());
            }
        });

        scene.add(model);

        // Центрирование
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const modelSize = box.getSize(new THREE.Vector3()).length();
        targetCameraDistance = modelSize * SCROLL.maxDistance; // Используем maxDistance как базовое значение
        camera.position.z = targetCameraDistance;


        // Создание частиц
        createParticles(center, box.getSize(new THREE.Vector3()).length() * 0.15);
        animate();
        console.log('Model loaded successfully');
    } catch (e) {
        console.error('Error processing model:', e);
    }
}, undefined, (error) => {
    console.error('Error loading model:', error);
});

// Остальные функции (createParticles, updateParticles, vibrateFragments, animate и т.д.)
// остаются без изменений, как в вашем исходном коде

// Добавляем новую функцию для обновления свечения
// Обновленная функция updateEmission с расширенной отладкой
function updateEmission() {
    if (!fragments.length || !model) {
        console.log("No fragments or model not loaded");
        return;
    }
    
    pulseTime += 0.01;
    const pulseFactor = 1 + Math.sin(pulseTime) * 0.1;
    
    // Проверяем пересечение только если курсор рядом
    let isIntersecting = false;
    if (isCursorNear) {
        raycaster.setFromCamera(mouse, camera);
        isIntersecting = raycaster.intersectObject(model, true).length > 0;
    }
    
    if (isCursorNear && isIntersecting) {
        const prevIntensity = emissionIntensity;
        emissionIntensity = Math.min(emissionIntensity + EMISSION_SPEED, MAX_EMISSION_INTENSITY);
        
        // Логируем достижение максимальной интенсивности
        if (emissionIntensity >= MAX_EMISSION_INTENSITY * 0.99 && !emissionPeakReached) {
            console.log(`MAX EMISSION INTENSITY REACHED! (${emissionIntensity.toFixed(3)})`);
            console.log(`Creating ${PARTICLE_BURST_COUNT} burst particles...`);
            createParticleBurst();
            emissionPeakReached = true;
        }
    } else {
        emissionIntensity = Math.max(emissionIntensity - EMISSION_SPEED * 2, 0);
        emissionPeakReached = false;
    }
    
    // Логируем текущую интенсивность каждые 30 кадров (~0.5 сек)
    if (Math.floor(Date.now() / 500) % 2 === 0) {
        console.log(`Current emission: ${(emissionIntensity * 100 / MAX_EMISSION_INTENSITY).toFixed(1)}%`);
        
        // Считаем общее количество частиц на сцене
        let particleCount = 0;
        if (particles && particles.visible) particleCount += PARTICLE_COUNT;
        if (burstParticles) particleCount += PARTICLE_BURST_COUNT;
        console.log(`Total particles: ${particleCount}`);
    }
    
    const currentIntensity = emissionIntensity * pulseFactor;
    
    fragments.forEach(fragment => {
        if (fragment.isMesh) {
            fragment.material.emissive.copy(EMISSION_COLOR)
                .multiplyScalar(currentIntensity);
            fragment.material.emissiveIntensity = currentIntensity;
            fragment.material.needsUpdate = true;
        }
    });

    if (burstParticles) {
        updateBurstParticles();
    }
}

// Создание светящихся частиц
// Обновленная функция createParticles (белые частицы)
function createParticles(center, radius) {
    const geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLE_COUNT * 3); // Каждая частица имеет три координаты XYZ
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const r = radius * 0.3 * Math.cbrt(Math.random()); // Радиус сферы
        const theta = Math.random() * Math.PI * 2; // Угол вокруг оси Z
        const phi = Math.acos(2 * Math.random() - 1); // Полярный угол сферической системы координат

        pos[i * 3]     = center.x + r * Math.sin(phi) * Math.cos(theta); // X
        pos[i * 3 + 1] = center.y + r * Math.sin(phi) * Math.sin(theta); // Y
        pos[i * 3 + 2] = center.z + r * Math.cos(phi);                   // Z

        // Цвет частиц белый
        colors[i * 3]   = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;

        sizes[i] = radius * 0.1; // Начальный размер частиц
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); // Позиции частиц
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); // Цвета частиц
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));   // Размеры частиц

    const material = new THREE.PointsMaterial({ // Материал для отображения частиц
        size: radius * 0.03,                     // Фиксированный размер каждой частицы
        vertexColors: true,                      // Используем заданные цвета
        transparent: true,                       // Частицы полупрозрачные
        opacity: 0.8,                            // Непрозрачность около 80%
        blending: THREE.AdditiveBlending,        // Эффект свечения при наложении цветов
        sizeAttenuation: true, // Важно отключить attenuation
        depthWrite: false // Добавляем эту строку
    });

    particles = new THREE.Points(geometry, material); // Создаем набор частиц
    particles.layers.enable(1);                      // Включаем слой 1
    particles.frustumCulled = false; // Отключаем отсечение по фрустуму
    particles.renderOrder = 1; // Устанавливаем высокий порядок рендеринга

    //particles.visible = false;                       // Скрываем пока частицы
    //particles.material.opacity = 0;                  // Полностью прозрачный начальный материал
    scene.add(particles);                            // Добавляем частицы в сцену

    // Данные для управления движением частиц
    particles.userData = {
        velocities: Array(PARTICLE_COUNT).fill().map(() => ({ // Скорость каждой частицы
            x: (Math.random() - 0.5) * 0.002,
            y: (Math.random() - 0.5) * 0.002,
            z: (Math.random() - 0.5) * 0.002,
            offset: Math.random() * Math.PI * 2 // Смещение фазы колебаний
        }))
    };
}

function updateParticles() {
    if (!particles || !particlesActivated) return;

    const pos = particles.geometry.attributes.position.array;
    const time = Date.now() * 0.001;
    const modelScale = model.scale.length();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const v = particles.userData.velocities[i];
        const o = i * 3;
        
        // Масштабируем движение частиц относительно размера модели
        pos[o] += (v.x + Math.sin(time * 0.5 + v.offset) * 0.0005 * modelScale);
        pos[o + 1] += (v.y + Math.cos(time * 0.6 + v.offset) * 0.0005 * modelScale);
        pos[o + 2] += (v.z + Math.sin(time * 0.4 + v.offset) * 0.0005 * modelScale);
    }

    particles.geometry.attributes.position.needsUpdate = true;
    
    // Автоматическая коррекция прозрачности
    if (camera.position.z < EXPLODE_THRESHOLD) {
        const fadeFactor = THREE.MathUtils.clamp(
            camera.position.z / EXPLODE_THRESHOLD,
            0.3, 1
        );
        particles.material.opacity = 0.8 * fadeFactor;
    }
}

// Обработка движения мыши
document.addEventListener('mousemove', (event) => {
    if (!model || !particles) return;

    const rect = canvas.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const distance = Math.sqrt(
        Math.pow(cursorX - centerX, 2) +
        Math.pow(cursorY - centerY, 2)
    );

    isCursorNear = distance < REACT_DISTANCE;

    if (isCursorNear) {
        // Активируем частицы только один раз при первом наведении
        if (!particlesActivated) {
            particlesActivated = true;
            particles.visible = true;
            gsap.to(particles.material, {
                opacity: 0.8,
                duration: 0.5,
                ease: "power2.out"
            });
        }
        mouse.x = (cursorX / rect.width) * 2 - 1;
        mouse.y = - (cursorY / rect.height) * 2 + 1;

        targetRotation.y = mouse.x * maxRotation;
        targetRotation.x = mouse.y * maxRotation;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(model, true);

        if (intersects.length > 0) {
            particles.material.opacity = Math.min(1, particles.material.opacity + 0.05);
            // Управляем только небольшой вибрацией
            explodeFactor = Math.min(explodeFactor + 0.03, 0.3); // Максимум 0.3 вместо 1.0
        } else {
            particles.material.opacity = Math.min(1, particles.material.opacity + 0.05);
            explodeFactor = Math.max(explodeFactor - 0.01, 0);
        }
    } else {
        explodeFactor = Math.max(explodeFactor - 0.02, 0);
    }
});

// Обновление вращения модели
function updateRotation() {
    currentRotation.y += (targetRotation.y - currentRotation.y) * rotationSpeed;
    currentRotation.x += (targetRotation.x - currentRotation.x) * rotationSpeed;

    if (model) {
        model.rotation.y = currentRotation.y;
        model.rotation.x = currentRotation.x;
    }
}

// Вибрация фрагментов
function vibrateFragments() {
    if (fragments.length === 0) return;

    // Эффект вибрации при наведении (оригинальный)
    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = raycaster.ray.direction.clone().multiplyScalar(10).add(camera.position);

    fragments.forEach((fragment, i) => {
        const originalPos = originalPositions[i].position;
        const originalWorldPos = originalPositions[i].worldPosition;

        const distanceToMouse = originalWorldPos.distanceTo(intersectPoint);
        const strength = 1 - Math.min(distanceToMouse / 5.0, 1.0);
        const scaledStrength = Math.pow(strength, 2) * 0.3;

        const direction = new THREE.Vector3()
            .subVectors(originalWorldPos, intersectPoint)
            .normalize();

        const randomOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
        );

        // Только эффект от курсора (без взрыва)
        const targetPosition = new THREE.Vector3()
            .copy(originalPos)
            .add(direction.multiplyScalar(explodeFactor * maxExplodeDistance * scaledStrength))
            .add(randomOffset.multiplyScalar(explodeFactor));

        fragment.position.lerp(targetPosition, 0.3);

        if (explodeFactor > 0.1) {
            fragment.rotation.x = originalRotations[i].x + (Math.random() - 0.5) * explodeFactor * 0.1;
            fragment.rotation.y = originalRotations[i].y + (Math.random() - 0.5) * explodeFactor * 0.1;
        }
    });

    // Отдельно добавляем эффект взрыва при близости камеры
    if (camera.position.z < EXPLODE_THRESHOLD) {
        const explosionStrength = THREE.MathUtils.clamp(
            (EXPLODE_THRESHOLD - camera.position.z) / EXPLODE_THRESHOLD, 
            0, 
            1
        ) * MAX_EXPLODE_DISTANCE;

        fragments.forEach((fragment, i) => {
            const originalWorldPos = originalPositions[i].worldPosition;
            const explosionDirection = new THREE.Vector3()
                .subVectors(originalWorldPos, model.position)
                .normalize();

            fragment.position.add(explosionDirection.multiplyScalar(explosionStrength * 0.3));
        });
    }
}

// Анимация
// Обновленная функция animate с отладкой
function animate() {
    requestAnimationFrame(animate);

    if (!model) return; // Не анимируем, если модель не загружена
        // Очистка только глубины
    renderer.clearDepth();
    renderer.clearColor()

    // Рендерим частицы после основной сцены
    renderer.render(scene, camera);
    updateCameraPosition();
    // Всегда обновляем частицы после активации
    if (particlesActivated) {
        updateParticles();
    }

    try {
        updateRotation();
        vibrateFragments();
        if (particles) updateParticles();
        //updateEmission();
        bloomComposer.render();
        
        // Периодическая отладка (раз в 2 секунды)
        if (Math.floor(Date.now() / 2000) % 2 === 0) {
            console.log('--- Scene Status ---');
            console.log(`Model loaded: ${!!model}`);
            console.log(`Fragments: ${fragments.length}`);
            console.log(`Emission: ${emissionIntensity.toFixed(3)}/${MAX_EMISSION_INTENSITY}`);
            console.log(`Particles: ${particles?.visible ? 'Visible' : 'Hidden'}`);
            console.log(`Burst particles: ${burstParticles ? 'Active' : 'None'}`);
        }
    } catch (e) {
        console.error('Animation error:', e);
    }
}



// Ресайз
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
});