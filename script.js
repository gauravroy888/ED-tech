(function () {
  'use strict';

  var THEME_STORAGE_KEY = 'edtech-island-theme';
  var DEFAULT_CHAPTER_ID = 'light-shadows';
  var DETAIL_CHAPTER_ORDER = ['light-shadows', 'space-solar'];
  var AVAILABLE_APPS = {
    'Chapter_experience_L_S.html': true,
    'Shadow_Lab.html': true,
    'quiz.html': true
  };
  var CHAPTERS = {
    'light-shadows': {
      id: 'light-shadows',
      title: 'LIGHT AND SHADOWS',
      description: 'The light and shadow simulation model provides interactive exploration of fundamental optical principles. Visualize the formation of complex shadow patterns, examine umbra and penumbra regions, and observe how light propagates to form shadows based on object shape and distance.',
      iconClass: 'ph ph-lightbulb',
      sceneKey: 'lightShadows',
      experienceUrl: 'Chapter_experience_L_S.html',
      quizReady: true,
      contentReady: true
    },
    'space-solar': {
      id: 'space-solar',
      title: 'SPACE AND SOLAR SYSTEM',
      description: 'The solar system model provides an interactive journey through our cosmic neighbourhood. Explore planetary orbits, understand gravitational forces, and discover the unique characteristics of each planet from the scorching Mercury to the icy realms of Neptune.',
      iconClass: 'ph ph-planet',
      sceneKey: 'solarSystem',
      experienceUrl: '',
      quizReady: false,
      contentReady: false
    }
  };

  var currentScreenId = 'screen-home';
  var currentChapterId = DEFAULT_CHAPTER_ID;
  var overlayResetTimer = 0;
  var toastHideTimer = 0;
  var FULLSCREEN_OVERLAY_BODY_CLASS = 'fullscreen-overlay-open';
  var sceneAnimationId = 0;
  var sceneRenderer = null;
  var sceneCleanup = null;
  var sceneRoot = null;
  var sceneBootTimer = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function getChapter(chapterId) {
    return CHAPTERS[chapterId] || CHAPTERS[DEFAULT_CHAPTER_ID];
  }

  function getCurrentChapter() {
    return getChapter(currentChapterId);
  }

  function setThemeButtonLabel() {
    var themeButton = byId('theme-toggle');
    if (!themeButton) {
      return;
    }

    var isLight = document.body.classList.contains('light-theme');
    themeButton.textContent = isLight ? 'Theme: Light' : 'Theme: Dark';
    themeButton.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
  }

  function saveThemePreference(value) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (error) {
      // Ignore storage failures in restricted browser contexts.
    }
  }

  function applySavedTheme() {
    var storedTheme = '';

    try {
      storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) || '';
    } catch (error) {
      storedTheme = '';
    }

    document.body.classList.toggle('light-theme', storedTheme === 'light');
    setThemeButtonLabel();
  }

  function syncFullscreenButton() {
    var fullscreenButton = byId('fullscreen-toggle');
    if (!fullscreenButton) {
      return;
    }

    var inFullscreen = !!document.fullscreenElement;
    var label = inFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
    var iconSpan = fullscreenButton.querySelector('.fullscreen-icon');

    // Update only the text node — preserve the icon <span> inside the button
    if (iconSpan) {
      // Remove existing text nodes, keep the span
      Array.prototype.forEach.call(fullscreenButton.childNodes, function (node) {
        if (node.nodeType === 3) { fullscreenButton.removeChild(node); }
      });
      fullscreenButton.appendChild(document.createTextNode(' ' + label));
    } else {
      fullscreenButton.textContent = label;
    }
    fullscreenButton.setAttribute('aria-label', inFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
  }

  function ensureToast() {
    var toast = byId('app-toast');

    if (toast) {
      return toast;
    }

    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.bottom = '96px';
    toast.style.transform = 'translateX(-50%) translateY(12px)';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '999px';
    toast.style.border = '1px solid rgba(255, 255, 255, 0.18)';
    toast.style.background = 'rgba(8, 15, 28, 0.92)';
    toast.style.backdropFilter = 'blur(14px)';
    toast.style.webkitBackdropFilter = 'blur(14px)';
    toast.style.color = '#f8fafc';
    toast.style.fontSize = '0.95rem';
    toast.style.fontWeight = '600';
    toast.style.letterSpacing = '0.02em';
    toast.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.35)';
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
    toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
    toast.style.zIndex = '1200';
    document.body.appendChild(toast);

    return toast;
  }

  function showToast(message) {
    var toast = ensureToast();

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    window.clearTimeout(toastHideTimer);
    toastHideTimer = window.setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(12px)';
    }, 2600);
  }

  function updateBottomNav(screenId) {
    var activeLabel = screenId === 'screen-home' ? 'HOME' : 'STUDIES';

    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (button) {
      var label = button.querySelector('.nav-label');
      var isActive = !!label && label.textContent.trim() === activeLabel;
      button.classList.toggle('active', isActive);
    });
  }

  function activateTab(tabName) {
    Array.prototype.forEach.call(document.querySelectorAll('.sol-tab'), function (button) {
      var isActive = button.getAttribute('data-tab') === tabName;
      button.classList.toggle('active-tab', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Array.prototype.forEach.call(document.querySelectorAll('.sol-tab-panel'), function (panel) {
      panel.classList.toggle('active', panel.id === 'tabpanel-' + tabName);
    });

    if (tabName === 'experience') {
      window.setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
        if (currentScreenId === 'screen-chapter-detail') {
          scheduleChapterSceneBoot();
        }
      }, 10);
    }
  }

  function disposeSceneGraph(root) {
    if (!root) {
      return;
    }

    if (typeof window.disposeThreeObject === 'function') {
      window.disposeThreeObject(root);
      return;
    }

    if (!root.traverse) {
      return;
    }

    root.traverse(function (object) {
      var materials;

      if (object.geometry && typeof object.geometry.dispose === 'function') {
        object.geometry.dispose();
      }

      if (!object.material) {
        return;
      }

      materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(function (material) {
        Object.keys(material).forEach(function (key) {
          if (material[key] && typeof material[key].dispose === 'function') {
            material[key].dispose();
          }
        });

        if (typeof material.dispose === 'function') {
          material.dispose();
        }
      });
    });
  }

  function destroyChapterScene() {
    var canvasContainer = byId('canvas-container');

    if (sceneAnimationId) {
      window.cancelAnimationFrame(sceneAnimationId);
      sceneAnimationId = 0;
    }

    if (sceneCleanup) {
      sceneCleanup();
      sceneCleanup = null;
    }

    disposeSceneGraph(sceneRoot);
    sceneRoot = null;

    if (sceneRenderer) {
      sceneRenderer.dispose();
      if (typeof sceneRenderer.forceContextLoss === 'function') {
        sceneRenderer.forceContextLoss();
      }
      sceneRenderer = null;
    }

    if (canvasContainer) {
      canvasContainer.innerHTML = '';
    }
  }

  function makeGlowTexture(innerColor, outerColor) {
    var canvas = document.createElement('canvas');
    var context;
    var gradient;

    canvas.width = 128;
    canvas.height = 128;
    context = canvas.getContext('2d');
    gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, innerColor || 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(210,240,255,0.85)');
    gradient.addColorStop(0.55, 'rgba(140,200,255,0.35)');
    gradient.addColorStop(1, outerColor || 'rgba(100,200,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
  }

  function addDragRotate(container, target, sensitivityX, sensitivityY) {
    var drag = false;
    var last = { x: 0, y: 0 };
    var sx = sensitivityX || 0.006;
    var sy = sensitivityY || 0.003;

    function start(event) {
      var point = event.touches ? event.touches[0] : event;
      drag = true;
      last = { x: point.clientX, y: point.clientY };
    }

    function end() {
      drag = false;
    }

    function move(event) {
      var point;

      if (!drag) {
        return;
      }

      point = event.touches ? event.touches[0] : event;
      target.rotation.y += (point.clientX - last.x) * sx;
      target.rotation.x = Math.max(-Math.PI / 5, Math.min(Math.PI / 5, target.rotation.x + (point.clientY - last.y) * sy));
      last = { x: point.clientX, y: point.clientY };
    }

    container.addEventListener('mousedown', start);
    container.addEventListener('mouseup', end);
    container.addEventListener('mouseleave', end);
    container.addEventListener('mousemove', move);
    container.addEventListener('touchstart', start, { passive: true });
    container.addEventListener('touchend', end);
    container.addEventListener('touchmove', move, { passive: true });

    return function removeDragRotate() {
      container.removeEventListener('mousedown', start);
      container.removeEventListener('mouseup', end);
      container.removeEventListener('mouseleave', end);
      container.removeEventListener('mousemove', move);
      container.removeEventListener('touchstart', start);
      container.removeEventListener('touchend', end);
      container.removeEventListener('touchmove', move);
    };
  }

  function initLightAndShadows3D() {
    var container = byId('canvas-container');
    var loadingEl = byId('canvas-loading');
    var scene;
    var width;
    var height;
    var camera;
    var renderer;
    var lightPosition;
    var pointLight;
    var corona;
    var objectGroup;
    var objectGeometry;
    var positionsAttr;
    var uniquePoints = [];
    var lines = [];
    var onResize;
    var removeDragRotate;
    var time = 0;

    if (typeof THREE === 'undefined' || !container) {
      showToast('The 3D engine is not available right now.');
      return;
    }

    destroyChapterScene();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070d18);
    scene.fog = new THREE.FogExp2(0x070d18, 0.025);
    scene.rotation.y = 1.8;
    scene.rotation.x = 0.1;

    width = Math.max(container.clientWidth, 1);
    height = Math.max(container.clientHeight, 1);
    camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 200);
    camera.position.set(0, 2.5, 13);
    camera.lookAt(1, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.IFP_PIXEL_RATIO || Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);
    sceneRenderer = renderer;
    sceneRoot = scene;

    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    scene.add(new THREE.AmbientLight(0x0d1b33, 0.4));

    lightPosition = new THREE.Vector3(-4.8, -1.2, 3.0);
    pointLight = new THREE.PointLight(0xffffff, 5.0, 40);
    pointLight.position.copy(lightPosition);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.set(2048, 2048);
    pointLight.shadow.bias = -0.001;
    pointLight.shadow.camera.near = 0.5;
    pointLight.shadow.camera.far = 25;
    scene.add(pointLight);

    (function addLightVisuals() {
      var rimLight = new THREE.DirectionalLight(0x40d0e0, 0.1);
      var bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      var coronaMaterial = new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.92
      });
      var stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.12, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.8, metalness: 0.5 })
      );
      var pool = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshBasicMaterial({
          map: makeGlowTexture('rgba(160, 220, 255, 0.40)', 'rgba(0,0,0,0)'),
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false
        })
      );

      rimLight.position.set(8, 4, -4);
      scene.add(rimLight);

      bulb.position.copy(lightPosition);
      scene.add(bulb);

      corona = new THREE.Sprite(coronaMaterial);
      corona.position.copy(lightPosition);
      corona.scale.set(2.2, 2.2, 1);
      scene.add(corona);

      stand.position.set(lightPosition.x, lightPosition.y - 0.85, lightPosition.z);
      scene.add(stand);

      pool.rotation.x = -Math.PI / 2;
      pool.position.set(lightPosition.x, -2.39, lightPosition.z);
      scene.add(pool);
    })();

    objectGroup = new THREE.Group();
    objectGroup.position.set(0.6, 0.2, 0);
    objectGeometry = new THREE.IcosahedronGeometry(1.4, 0);
    objectGroup.add(new THREE.Mesh(
      objectGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xbbeeff,
        roughness: 0.8,
        metalness: 0.1,
        flatShading: true
      })
    ));
    objectGroup.children[0].castShadow = true;
    scene.add(objectGroup);

    (function addWireframeStand() {
      var pyramid = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 3.2, 4),
        new THREE.MeshBasicMaterial({ color: 0x99ccdd, wireframe: true, transparent: true, opacity: 0.35 })
      );
      pyramid.position.set(0.6, -1.5, 0);
      pyramid.rotation.y = Math.PI / 4;
      scene.add(pyramid);
    })();

    (function addProjectionScreen() {
      var screenPosition = new THREE.Vector3(-7.27, 1.0, 4.37);
      var screenGeometry = new THREE.CylinderGeometry(15.0, 15.0, 14.0, 64, 16, true, -0.7, 1.4);
      var screenMesh = new THREE.Mesh(
        screenGeometry,
        new THREE.MeshStandardMaterial({
          color: 0xaaddf0,
          roughness: 1,
          metalness: 0,
          side: THREE.DoubleSide
        })
      );
      var gridMesh = new THREE.Mesh(
        screenGeometry.clone(),
        new THREE.MeshBasicMaterial({
          color: 0x336677,
          wireframe: true,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1
        })
      );

      screenMesh.rotation.y = 2.07;
      screenMesh.position.copy(screenPosition);
      screenMesh.receiveShadow = true;
      scene.add(screenMesh);

      gridMesh.rotation.y = 2.07;
      gridMesh.position.copy(screenPosition);
      scene.add(gridMesh);
    })();

    (function addFloorGrid() {
      var floor = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 16, 22, 16),
        new THREE.MeshBasicMaterial({
          color: 0x40e0d0,
          wireframe: true,
          transparent: true,
          opacity: 0.055
        })
      );

      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -2.4;
      scene.add(floor);
    })();

    (function addRays() {
      var linesGroup = new THREE.Group();
      var rayMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45
      });

      scene.add(linesGroup);
      positionsAttr = objectGeometry.attributes.position;

      for (var i = 0; i < positionsAttr.count; i += 1) {
        var vertex = new THREE.Vector3().fromBufferAttribute(positionsAttr, i);
        if (!uniquePoints.some(function (point) { return point.distanceTo(vertex) < 0.1; })) {
          uniquePoints.push(vertex);
        }
      }

      uniquePoints.forEach(function () {
        var line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
          rayMaterial
        );
        linesGroup.add(line);
        lines.push(line);
      });
    })();

    removeDragRotate = addDragRotate(container, scene, 0.005, 0.003);

    onResize = function () {
      if (!container || !sceneRenderer) {
        return;
      }
      camera.aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      sceneRenderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    };

    window.addEventListener('resize', onResize);
    sceneCleanup = function () {
      window.removeEventListener('resize', onResize);
      removeDragRotate();
    };

    function animate() {
      sceneAnimationId = window.requestAnimationFrame(animate);

      if (window.IFP_VISIBLE === false || currentScreenId !== 'screen-chapter-detail') {
        return;
      }

      time += 0.012;
      objectGroup.rotation.y += 0.002;
      objectGroup.rotation.x += 0.001;
      objectGroup.updateMatrixWorld();

      uniquePoints.forEach(function (localPosition, index) {
        var worldPosition = localPosition.clone().applyMatrix4(objectGroup.matrixWorld);
        var direction = worldPosition.clone().sub(lightPosition).normalize();
        var endPosition = lightPosition.clone().add(direction.multiplyScalar(24));
        var buffer = new Float32Array([
          lightPosition.x, lightPosition.y, lightPosition.z,
          endPosition.x, endPosition.y, endPosition.z
        ]);
        lines[index].geometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
      });

      if (corona) {
        var pulse = 1 + Math.sin(time * 1.8) * 0.14;
        corona.scale.set(2.2 * pulse, 2.2 * pulse, 1);
      }

      pointLight.intensity = 5.0 + Math.sin(time * 3.5) * 0.5 + (Math.random() - 0.5) * 0.2;
      renderer.render(scene, camera);
    }

    animate();
  }

  function init3DSolarSystem() {
    var container = byId('canvas-container');
    var loadingEl = byId('canvas-loading');
    var scene;
    var camera;
    var renderer;
    var starField;
    var sun;
    var planets = [];
    var onResize;
    var removeDragRotate;

    if (typeof THREE === 'undefined' || !container) {
      showToast('The 3D engine is not available right now.');
      return;
    }

    destroyChapterScene();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      1000
    );
    camera.position.set(0, 30, 45);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    renderer.setPixelRatio(window.IFP_PIXEL_RATIO || Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050814);
    container.appendChild(renderer.domElement);
    sceneRenderer = renderer;
    sceneRoot = scene;

    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    scene.add(new THREE.PointLight(0xffdcb4, 2.5, 160));

    (function addStarField() {
      var starsGeometry = new THREE.BufferGeometry();
      var starPositions = new Float32Array(1200 * 3);

      for (var i = 0; i < starPositions.length; i += 1) {
        starPositions[i] = (Math.random() - 0.5) * 220;
      }

      starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starField = new THREE.Points(
        starsGeometry,
        new THREE.PointsMaterial({
          size: 0.12,
          color: 0x88ccff,
          transparent: true,
          opacity: 0.8
        })
      );
      scene.add(starField);
    })();

    sun = new THREE.Mesh(
      new THREE.SphereGeometry(3, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    scene.add(sun);
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide
      })
    ));

    [
      { radius: 0.30, distance: 6, speed: 0.020, color: 0x888888 },
      { radius: 0.60, distance: 9, speed: 0.015, color: 0xe3bb76 },
      { radius: 0.65, distance: 13, speed: 0.010, color: 0x3366ff },
      { radius: 0.40, distance: 17, speed: 0.008, color: 0xff3300 },
      { radius: 1.80, distance: 23, speed: 0.004, color: 0xd99b58 },
      { radius: 1.40, distance: 30, speed: 0.003, color: 0xc5ab6e, hasRing: true },
      { radius: 0.90, distance: 36, speed: 0.002, color: 0x66ccff }
    ].forEach(function (planetData) {
      var orbitPoints = [];
      var group = new THREE.Group();
      var mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planetData.radius, 28, 28),
        new THREE.MeshStandardMaterial({ color: planetData.color, roughness: 0.7, metalness: 0.1 })
      );

      for (var i = 0; i <= 64; i += 1) {
        var theta = (i / 64) * Math.PI * 2;
        orbitPoints.push(new THREE.Vector3(
          Math.cos(theta) * planetData.distance,
          0,
          Math.sin(theta) * planetData.distance
        ));
      }

      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x40e0d0, transparent: true, opacity: 0.2 })
      ));

      mesh.position.x = planetData.distance;
      group.add(mesh);
      scene.add(group);

      if (planetData.hasRing) {
        var ring = new THREE.Mesh(
          new THREE.RingGeometry(planetData.radius * 1.4, planetData.radius * 2.2, 32),
          new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
          })
        );
        ring.rotation.x = Math.PI / 2 + 0.3;
        mesh.add(ring);
      }

      planets.push({
        group: group,
        mesh: mesh,
        speed: planetData.speed,
        angle: Math.random() * Math.PI * 2
      });
    });

    removeDragRotate = addDragRotate(container, scene);

    onResize = function () {
      if (!container || !sceneRenderer) {
        return;
      }
      camera.aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      sceneRenderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    };

    window.addEventListener('resize', onResize);
    sceneCleanup = function () {
      window.removeEventListener('resize', onResize);
      removeDragRotate();
    };

    function animate() {
      sceneAnimationId = window.requestAnimationFrame(animate);

      if (window.IFP_VISIBLE === false || currentScreenId !== 'screen-chapter-detail') {
        return;
      }

      starField.rotation.y += 0.0002;
      sun.rotation.y += 0.005;
      planets.forEach(function (planet) {
        planet.angle += planet.speed;
        planet.group.rotation.y = planet.angle;
        planet.mesh.rotation.y += 0.018;
      });
      renderer.render(scene, camera);
    }

    animate();
  }

  function bootChapterScene() {
    var chapter = getCurrentChapter();

    if (!chapter || !chapter.sceneKey || currentScreenId !== 'screen-chapter-detail') {
      return;
    }

    if (chapter.sceneKey === 'lightShadows') {
      initLightAndShadows3D();
      return;
    }

    if (chapter.sceneKey === 'solarSystem') {
      init3DSolarSystem();
    }
  }

  function scheduleChapterSceneBoot() {
    var loadingEl = byId('canvas-loading');

    if (currentScreenId !== 'screen-chapter-detail') {
      return;
    }

    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    window.clearTimeout(sceneBootTimer);
    sceneBootTimer = window.setTimeout(function () {
      bootChapterScene();
    }, 90);
  }

  function updateChapterDetail(chapterId) {
    var chapter = getChapter(chapterId);
    var detailTitle = byId('detail-title');
    var detailDescription = byId('detail-description');
    var detailIcon = byId('detail-tab-phosphor-icon');
    var chapterScreen = byId('screen-chapter-detail');
    var startButton = byId('btn-start-journey');
    var nextButton = byId('btn-next-chapter');
    var quizTitle = document.querySelector('#tabpanel-quiz .sol-unlocked-title');
    var quizDescription = document.querySelector('#tabpanel-quiz .sol-unlocked-desc');
    var quizButton = document.querySelector('#tabpanel-quiz .sol-start-btn');
    var canvasLoading = byId('canvas-loading');

    currentChapterId = chapter.id;

    if (detailTitle) {
      detailTitle.textContent = chapter.title;
    }

    if (detailDescription) {
      detailDescription.textContent = chapter.description;
    }

    if (detailIcon) {
      detailIcon.className = chapter.iconClass;
    }

    if (chapterScreen) {
      chapterScreen.style.backgroundImage = chapter.id === 'space-solar'
        ? "url('assets/Future verion lowres.jpg')"
        : "url('assets/chapter background lowres.jpg')";
    }

    if (startButton) {
      startButton.textContent = chapter.experienceUrl ? 'Start Journey' : 'Journey Coming Soon';
    }

    if (nextButton) {
      nextButton.textContent = chapter.id === 'space-solar' ? 'Back to Chapter 1' : 'Next Chapter';
    }

    if (quizTitle) {
      quizTitle.textContent = chapter.quizReady ? 'Interactive Quiz' : 'Quiz Coming Soon';
    }

    if (quizDescription) {
      quizDescription.textContent = chapter.quizReady
        ? 'Test your mastery on ' + chapter.title + '.'
        : 'Quiz content for ' + chapter.title + ' is still being prepared.';
    }

    if (quizButton) {
      quizButton.textContent = chapter.quizReady ? 'Start Quiz' : 'Quiz Coming Soon';
    }

    if (canvasLoading) {
      canvasLoading.style.display = 'flex';
    }

    destroyChapterScene();
    activateTab('experience');
  }

  function navigateTo(screenId, options) {
    var targetScreen = byId(screenId);
    var isDetailScreenChange = screenId === 'screen-chapter-detail' && currentScreenId === 'screen-chapter-detail' && options && options.chapterId && options.chapterId !== currentChapterId;
    var currentActiveScreen = byId(currentScreenId);

    if (!targetScreen) {
      showToast('That screen is not available yet.');
      return;
    }

    if (currentScreenId === 'screen-chapter-detail' || screenId === 'screen-chapter-detail') {
      destroyChapterScene();
    }

    if (isDetailScreenChange) {
      updateChapterDetail(options.chapterId);
      updateBottomNav(screenId);
      scheduleChapterSceneBoot();
      return;
    }

    if (screenId === currentScreenId) {
      return;
    }

    if (options && options.chapterId) {
      updateChapterDetail(options.chapterId);
    } else if (screenId === 'screen-chapter-detail') {
      updateChapterDetail(currentChapterId);
    }

    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (screen) {
      if (screen.id === screenId) {
        screen.classList.remove('exit-left');
        screen.classList.add('active');
      } else if (screen.classList.contains('active') || screen === currentActiveScreen) {
        screen.classList.remove('active');
        screen.classList.add('exit-left');
        window.setTimeout(function () {
          screen.classList.remove('exit-left');
        }, 280);
      } else {
        screen.classList.remove('exit-left');
        screen.classList.remove('active');
      }
    });

    currentScreenId = screenId;
    updateBottomNav(screenId);

    if (screenId === 'screen-chapter-detail') {
      scheduleChapterSceneBoot();
    }
  }

  function setOverlayLayout(kind) {
    var overlay = byId('app-overlay');
    var shell = byId('app-overlay-shell');
    var frame = byId('app-overlay-frame');

    if (!overlay || !shell || !frame) {
      return;
    }

    overlay.classList.remove('app-overlay--story', 'app-overlay--fullscreen');
    overlay.style.pointerEvents = 'auto';

    if (kind === 'story') {
      overlay.classList.add('app-overlay--story');
      document.body.classList.remove(FULLSCREEN_OVERLAY_BODY_CLASS);
      overlay.style.background = '';
      overlay.style.backdropFilter = '';
      overlay.style.webkitBackdropFilter = '';
      shell.style.width = '';
      shell.style.height = '';
      frame.style.borderRadius = '';
      return;
    }

    overlay.classList.add('app-overlay--fullscreen');
    document.body.classList.add(FULLSCREEN_OVERLAY_BODY_CLASS);
    overlay.style.background = '';
    overlay.style.backdropFilter = '';
    overlay.style.webkitBackdropFilter = '';
    shell.style.width = '';
    shell.style.height = '';
    frame.style.borderRadius = '';
  }

  function openOverlay(source, kind, options) {
    var overlay = byId('app-overlay');
    var iframe = byId('app-iframe');
    var loader = byId('iframe-loading-dots');
    var finalSource = source;

    if (!overlay || !iframe) {
      return;
    }

    if (options && options.cacheBust) {
      finalSource += (source.indexOf('?') === -1 ? '?' : '&') + 'cb=' + Date.now();
    }

    window.clearTimeout(overlayResetTimer);
    setOverlayLayout(kind);
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    
    if (loader) {
      loader.classList.remove('hidden');
    }
    
    iframe.onload = function() {
      if (loader) {
        loader.classList.add('hidden');
      }
    };

    iframe.src = finalSource;
    overlay.classList.remove('hidden');
  }

  function closeOverlay() {
    var overlay = byId('app-overlay');
    var iframe = byId('app-iframe');

    if (!overlay || !iframe) {
      return;
    }

    document.body.classList.remove(FULLSCREEN_OVERLAY_BODY_CLASS);
    overlay.classList.add('hidden');
    window.clearTimeout(overlayResetTimer);
    overlayResetTimer = window.setTimeout(function () {
      iframe.removeAttribute('src');
    }, 160);
  }

  function openExperiment(path) {
    var chapter = getCurrentChapter();

    if (!chapter.contentReady) {
      showToast(chapter.title + ' interactive content is coming soon.');
      return;
    }

    if (!AVAILABLE_APPS[path]) {
      showToast('This activity is not connected yet.');
      return;
    }

    openOverlay(encodeURI(path), 'fullscreen', { cacheBust: true });
  }

  function openStoryVideo(url) {
    openOverlay(url, 'story');
  }

  function startChapterJourney() {
    var chapter = getCurrentChapter();

    if (!chapter.contentReady || !chapter.experienceUrl) {
      showToast(chapter.title + ' journey is coming soon.');
      return;
    }

    openExperiment(chapter.experienceUrl);
  }

  function goToNextChapter() {
    var currentIndex = DETAIL_CHAPTER_ORDER.indexOf(currentChapterId);
    var nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % DETAIL_CHAPTER_ORDER.length;
    var nextChapterId = DETAIL_CHAPTER_ORDER[nextIndex];

    navigateTo('screen-chapter-detail', { chapterId: nextChapterId });

    if (!getChapter(nextChapterId).contentReady) {
      showToast(getChapter(nextChapterId).title + ' is ready for preview. Full activities are still coming online.');
    }
  }

  function scrollCarousel(direction) {
    var carousel = byId('experiments-carousel');

    if (!carousel) {
      return;
    }

    carousel.scrollBy({
      left: direction * 320,
      behavior: 'smooth'
    });
  }

  function toggleTheme() {
    var useLightTheme = !document.body.classList.contains('light-theme');

    document.body.classList.toggle('light-theme', useLightTheme);
    saveThemePreference(useLightTheme ? 'light' : 'dark');
    setThemeButtonLabel();
  }

  function toggleAppFullscreen() {
    if (!document.fullscreenElement) {
      if (!document.documentElement.requestFullscreen) {
        showToast('Fullscreen is not available in this browser.');
        return;
      }

      document.documentElement.requestFullscreen().catch(function () {
        showToast('Fullscreen could not be started.');
      });
      return;
    }

    document.exitFullscreen().catch(function () {
      showToast('Fullscreen could not be closed.');
    });
  }

  function addClickListener(selector, handler) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (element) {
      element.addEventListener('click', handler);
    });
  }

  function bindTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.sol-tab'), function (button) {
      button.addEventListener('click', function () {
        activateTab(button.getAttribute('data-tab'));
      });
    });
  }

  function bindPlaceholderButtons() {
    [
      ['#subj-history', 'History content is coming soon.'],
      ['#subj-geography', 'Geography content is coming soon.'],
      ['#subj-pe', 'Physical Education content is coming soon.'],
      ['#subj-arts', 'Arts content is coming soon.'],
      ['#subj-english', 'English content is coming soon.'],
      ['#subj-math', 'Mathematics content is coming soon.'],
      ['#subj-music', 'Music content is coming soon.'],
      ['#ch-skeletal', 'Skeletal System is queued for the next release.'],
      ['#ch-food-health', 'Food and Health is queued for the next release.'],
      ['#ch-pollination', 'Pollination is queued for the next release.'],
      ['#ch-fertilization', 'Fertilization is queued for the next release.'],
      ['#ch-solids', 'Solids, Liquids, and Gases is queued for the next release.'],
      ['#ch-interdependence', 'Interdependence is queued for the next release.']
    ].forEach(function (entry) {
      var element = document.querySelector(entry[0]);

      if (!element) {
        return;
      }

      element.addEventListener('click', function () {
        showToast(entry[1]);
      });
    });

    addClickListener('.nav-btn[aria-label="World"]:not([onclick])', function () {
      showToast('World view is coming soon.');
    });

    addClickListener('.nav-btn[aria-label="Profile"]:not([onclick])', function () {
      showToast('Profile view is coming soon.');
    });

    addClickListener('.nav-btn[aria-label="Exit"]:not([onclick])', function () {
      navigateTo('screen-home');
    });
  }

  function bindOverlayEvents() {
    var overlay = byId('app-overlay');
    var closeButton = byId('close-app-btn');

    if (closeButton) {
      closeButton.addEventListener('click', closeOverlay);
    }

    if (overlay) {
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) {
          closeOverlay();
        }
      });
    }

    window.addEventListener('message', function (event) {
      if (event.data === 'closeOverlay') {
        closeOverlay();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (!byId('app-overlay').classList.contains('hidden')) {
          closeOverlay();
          return;
        }

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(function () {
            showToast('Fullscreen could not be closed.');
          });
        }
      }
    });
  }

  function bindPrimaryButtons() {
    var startJourneyButton = byId('btn-start-journey');
    var nextChapterButton = byId('btn-next-chapter');

    if (startJourneyButton) {
      startJourneyButton.addEventListener('click', startChapterJourney);
    }

    if (nextChapterButton) {
      nextChapterButton.addEventListener('click', goToNextChapter);
    }
  }

  function init() {
    applySavedTheme();
    syncFullscreenButton();
    updateBottomNav(currentScreenId);
    updateChapterDetail(DEFAULT_CHAPTER_ID);
    bindTabs();
    bindPrimaryButtons();
    bindPlaceholderButtons();
    bindOverlayEvents();

    document.addEventListener('fullscreenchange', syncFullscreenButton);
    window.addEventListener('beforeunload', destroyChapterScene);
  }

  window.navigateTo = navigateTo;
  window.activateTab = activateTab;
  window.scrollCarousel = scrollCarousel;
  window.openExperiment = openExperiment;
  window.openStoryVideo = openStoryVideo;
  window.toggleTheme = toggleTheme;
  window.toggleAppFullscreen = toggleAppFullscreen;
  window.closeOverlay = closeOverlay;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
