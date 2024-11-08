import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as CANNON from 'cannon-es'
import CannonDebugger from 'cannon-es-debugger'
import Vehicle from './vehicle.js'

import displacementVertexShader from './shaders/disp_color.vert?raw'
import displacementFragmentShader from './shaders/disp_color.frag?raw'

import snowTextureUrl from './textures/snow6_color.png'

const wireFrameEnabled = false;
const debugEnabled = false;
const heightScale = 0.1;
const textureSize = 2048;
const snowGeomPlot = 4;

const vehicleParams = {
    mass: 1,
    axis_width: 0.7,
    chassis_y: 0.25,
    chassis_z: 0.445,
    wheel_x: 0.25,
    wheel_y: -0.10,
    front_wheel_radius: 0.22,
    front_wheel_height: 0.3,
    front_wheel_z_scale: 2.2,
    back_wheel_radius: 0.199,
    back_wheel_height: 0.15,
    back_wheel_z_scale: 2.2,
};


function generateCanvasElement(width, height, id) {
    let elem = document.createElement('canvas');
    elem.id = id;
    elem.width = width;
    elem.height = height;
    return elem;
}

document.body.appendChild(generateCanvasElement(textureSize, textureSize, 'canvasD'));
// document.body.appendChild(generateCanvasElement(textureSize, textureSize, 'canvasN'));

// Add three-mesh-bvh extensions
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.diposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let debugMeshWasupdated = false;

const scene = new THREE.Scene()
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });

world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 2.0

const cannonDebugger = debugEnabled ? new CannonDebugger(scene, world, {
    color: 0xff0000, onUpdate: ((body, mesh, shape) => {
        // Force it to update shap
        if (debugMeshWasupdated) {
            if (shape.type == 32) {
                if (body.shapes.length == 1) {
                    body.shapes[0] = shape;
                    body.addShape(heightfieldShape);
                } else {
                    body.removeShape(body.shapes[0]);
                }
            }
        }
    })
}) : undefined;

const groundMaterial = new CANNON.Material();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(5, 3.89, -0.133)
camera.rotation.set(-0.554, 0.387, 0.22)
camera.quaternion.set(0.89, -0.2755, 0.3354, 0.103)

const light = new THREE.DirectionalLight()
light.position.set(1, 1, 1)
scene.add(light)

scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

const light2 = new THREE.AmbientLight(0x404040);
scene.add(light2);

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enablePan = false
controls.enableDamping = true

const canvasD = document.getElementById('canvasD')
const contextD = canvasD.getContext('2d', { willReadFrequently: true })
contextD.fillStyle = '#FFFFFF'
contextD.fillRect(0, 0, textureSize, textureSize)

const displacementMap = new THREE.CanvasTexture(canvasD)

const colorMap = new THREE.TextureLoader().load(snowTextureUrl);
colorMap.wrapS = THREE.RepeatWrapping;
colorMap.wrapT = THREE.RepeatWrapping;
colorMap.repeat.set( 4, 4 );

const geometry = new THREE.PlaneGeometry(snowGeomPlot, snowGeomPlot, textureSize, textureSize)

const uniforms = {
    bumpTexture: { value: displacementMap },
    bumpScale: { value: heightScale },
    colorMap: { value: colorMap },
};

const coloredMaterial = new THREE.ShaderMaterial({
    wireframe: wireFrameEnabled,
    uniforms: uniforms,
    vertexShader: displacementVertexShader,
    fragmentShader: displacementFragmentShader,
});

const plane = new THREE.Mesh(geometry, coloredMaterial)

// geometry.computeBoundsTree();

plane.rotation.x = -Math.PI / 2
scene.add(plane)

const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: groundMaterial,
})
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(groundBody)

const raycaster = new THREE.Raycaster()
raycaster.firstHitOnly = true;
let intersects
const mouse = new THREE.Vector2()
let lastRaycast = Date.now()
let shouldRaycast = false
let ctrlDown = false
let ptrDown = false

const matrix = []
const sizeX = 15
const sizeZ = 15
for (let i = 0; i < sizeX; i++) {
    matrix.push([])
    for (let j = 0; j < sizeZ; j++) {
        if (i === 0 || i === sizeX - 1 || j === 0 || j === sizeZ - 1) {
            const height = 3
            matrix[i].push(height)
            continue
        }

        const height = Math.cos((i / sizeX) * Math.PI * 2) * Math.cos((j / sizeZ) * Math.PI * 2) + 2
        matrix[i].push(height)
    }
}
function initDisplacement() {
    contextD.fillStyle = '#FFFFFF'
    contextD.fillRect(0, 0, textureSize, textureSize)
    coloredMaterial.needsUpdate = true
    displacementMap.needsUpdate = true;
}

const controlParameters = {
    brushSize: 1,
    brushPower: -1,
    resetDisplacement: function () {
        initDisplacement();
        depthCombinerMaterial.uniforms.originalTexture.value = displacementMap;
        depthCombinerMaterial.uniforms.originalTexture.value.needsUpdate = true;
        depthCombinerMaterial.needsUpdate = true;
    },
};

// height2normal - based on www.mrdoob.com/lab/javascript/height2normal/
function height2normal(context, contextN) {
    var width = textureSize
    var height = textureSize

    var src = context.getImageData(0, 0, width, height)
    var dst = contextN.createImageData(width, height)

    for (var i = 0, l = width * height * 4; i < l; i += 4) {
        var x1, x2, y1, y2
        if (i % (width * 4) == 0) {
            x1 = src.data[i]
            x2 = src.data[i + 4]
        } else if (i % (width * 4) == (width - 1) * 4) {
            x1 = src.data[i - 4]
            x2 = src.data[i]
        } else {
            x1 = src.data[i - 4]
            x2 = src.data[i + 4]
        }

        if (i < width * 4) {
            y1 = src.data[i]
            y2 = src.data[i + width * 4]
        } else if (i > width * (height - 1) * 4) {
            y1 = src.data[i - width * 4]
            y2 = src.data[i]
        } else {
            y1 = src.data[i - width * 4]
            y2 = src.data[i + width * 4]
        }

        dst.data[i] = x1 - x2 + 127
        dst.data[i + 1] = y1 - y2 + 127
        dst.data[i + 2] = 255
        dst.data[i + 3] = 255
    }

    contextN.putImageData(dst, 0, 0)
}

function clamp(min, max, number) {
    return Math.max(min, Math.min(number, max));
}

function increasePixelValues(x, y, width, height, increaseBy, ctx, increaseTo) {
    // Get the image data for the specified region
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;

    // Loop through the pixel data (RGBA format, so every 4th value is alpha)
    var modified = false;
    for (let i = 0; i < data.length; i += 4) {
        var data_r = data[i];
        if (increaseTo) {
            data[i] = clamp(0, data[i] - 1, increaseBy)
            data[i + 1] = clamp(0, data[i + 1] - 1, increaseBy);
            data[i + 2] = clamp(0, data[i + 2] - 1, increaseBy);
        } else {
            data[i] = clamp(0, 255, data[i] + increaseBy);
            data[i + 1] = clamp(0, 255, data[i + 1] + increaseBy);
            data[i + 2] = clamp(0, 255, data[i + 2] + increaseBy);
        }
        if (data_r !== data[i]) {
            modified = true;
        }
    }

    // Put the modified image data back onto the canvas
    if (modified) {
        ctx.putImageData(imageData, x, y);
    }
    return modified;
}

function draw(uv, set_h = true, update_n = true, intensity = 0.0, increaseTo = false, sizePow = 0.0) {
    const top_left_cast_x = uv.x * textureSize;
    const top_left_cast_y = textureSize - uv.y * textureSize;

    const bpow = sizePow === 0.0 ? controlParameters.brushSize : sizePow;
    const powpow = intensity === 0.0 ? controlParameters.brushPower : intensity;

    const top_left_x = top_left_cast_x - (bpow / 2);
    const top_left_y = top_left_cast_y - (bpow / 2);

    var was_modified = increasePixelValues(top_left_x, top_left_y, bpow, bpow, powpow, contextD, increaseTo)
    if (was_modified) {
        coloredMaterial.needsUpdate = true
        displacementMap.needsUpdate = true;
    }
    return was_modified;
}

function raycast() {
    raycaster.setFromCamera(mouse, camera)
    intersects = raycaster.intersectObject(plane, false)
    if (intersects.length > 0) {
        draw(intersects[0].uv)
    }
}

document.addEventListener('mousemove', function (event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    if (ctrlDown && ptrDown) shouldRaycast = true
})

renderer.domElement.addEventListener('pointerdown', function () {
    ptrDown = true
    if (ctrlDown) shouldRaycast = true
})

renderer.domElement.addEventListener('pointerup', function () {
    ptrDown = false
})

window.addEventListener('keydown', function (event) {
    if (event.key === 'Shift') {
        renderer.domElement.style.cursor = 'crosshair'
        controls.enabled = false
        ctrlDown = true
    }
})

window.addEventListener('keyup', function (event) {
    if (event.key === 'Shift') {
        renderer.domElement.style.cursor = 'pointer'
        controls.enabled = true
        ctrlDown = false
    }
})

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
}

const stats = new Stats()
document.body.appendChild(stats.dom)

const gui = new GUI()
gui.add(controlParameters, 'brushSize', 1, 64, 1)
gui.add(controlParameters, 'brushPower', -255, 255, 1)
gui.add(controlParameters, 'resetDisplacement')

var vehicle = new Vehicle(scene, world, groundMaterial, vehicleParams);

const vehicleFunctions = {
    resetVehicle: function () {
        vehicle.reset();
    },
};

const vehicleFolder = gui.addFolder('Vehicle')
vehicleFolder.add(vehicleParams, 'mass', 0.1, 10, 0.1)
vehicleFolder.add(vehicleFunctions, 'resetVehicle')
vehicleFolder.onFinishChange(function () {
    vehicle.dispose();
    vehicle = new Vehicle(scene, world, groundMaterial, vehicleParams);
});

const depthTexOpts = {
    format: THREE.RedFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.FloatType,
    generateMipmaps: false,
}

const depthRenderTarget = new THREE.WebGLRenderTarget(textureSize, textureSize, depthTexOpts);
depthRenderTarget.stencilBuffer = false;
depthRenderTarget.depthTexture = new THREE.DepthTexture();
depthRenderTarget.depthTexture.type = THREE.FloatType;
depthRenderTarget.depthTexture.format = THREE.DepthFormat;
depthRenderTarget.depthBuffer = true;

const depthCamera = new THREE.OrthographicCamera(
  -snowGeomPlot / 2, snowGeomPlot / 2, // left, right
  snowGeomPlot / 2, -snowGeomPlot / 2, // top, bottom
  0, heightScale            // near, far
)
depthCamera.position.set(0, -0.001, 0); // Below the plane, at Y = -L
depthCamera.rotation.x = -Math.PI / 2
depthCamera.rotation.z = -Math.PI
depthCamera.rotation.y = -Math.PI
depthCamera.updateProjectionMatrix();

const depthCombinerTextureTarget = new THREE.WebGLRenderTarget(textureSize, textureSize, depthTexOpts);
const depthCombinerMaterial = new THREE.ShaderMaterial({
    uniforms: {
        depthTexture: { value: depthRenderTarget.depthTexture },
        originalTexture: { value: displacementMap },
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D depthTexture;
    uniform sampler2D originalTexture;

    void main() {
      vec2 uv = vUv;
      uv.y = 1.0 - uv.y;  // Flip vertically if necessary
      float depth2 = texture2D(depthTexture, uv).r;
      float depthOrig = texture2D(originalTexture, uv).r;
      float resDepth = min(depth2, depthOrig);
      gl_FragColor = vec4(vec3(resDepth), 1.0);
    }
  `
});
const quadGeom = new THREE.PlaneGeometry(2, 2);
const quad = new THREE.Mesh(quadGeom, depthCombinerMaterial);
const combinerScene = new THREE.Scene();
combinerScene.add(quad);
const combinerCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
combinerCamera.updateProjectionMatrix();

const depthCombinerSyncTarget = new THREE.WebGLRenderTarget(textureSize, textureSize, depthTexOpts);
const depthCombinerSyncMaterial = new THREE.ShaderMaterial({
    uniforms: {
        depthTexture: { value: depthCombinerTextureTarget.texture },
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D depthTexture;

    void main() {
      vec2 uv = vUv;
      uv.y = 1.0 - uv.y;  // Flip vertically if necessary
      gl_FragColor = vec4(texture2D(depthTexture, uv));
    }
  `
});
const quad2 = new THREE.Mesh(quadGeom, depthCombinerSyncMaterial);
const combinerScene2 = new THREE.Scene();
combinerScene2.add(quad2);

function applyDepthToDisplacementMap() {
    if (coloredMaterial.uniforms.bumpTexture.value != depthCombinerTextureTarget.texture) {
        coloredMaterial.uniforms.bumpTexture.value = depthCombinerTextureTarget.texture;
        coloredMaterial.uniforms.bumpTexture.value.needsUpdate = true;
        coloredMaterial.texture = depthCombinerTextureTarget.texture;
        coloredMaterial.texture.needsUpdate = true;
        coloredMaterial.needsUpdate = true;
    }

    if (depthCombinerMaterial.uniforms.originalTexture.value != depthCombinerSyncTarget.texture) {
        depthCombinerMaterial.uniforms.originalTexture.value = depthCombinerSyncTarget.texture;
        depthCombinerMaterial.uniforms.originalTexture.value.needsUpdate = true;
        depthCombinerMaterial.needsUpdate = true;
    }
}

function animate() {
    requestAnimationFrame(animate)

    controls.update()

    stats.update()

    if (Date.now() - lastRaycast > 4 && shouldRaycast) {
        raycast();
        shouldRaycast = false;
        lastRaycast = Date.now();
    }

    world.fixedStep(1 / 60)

    if (debugEnabled) {
        cannonDebugger.update()
    }

    vehicle.update();

    renderer.setRenderTarget(depthRenderTarget);
    renderer.render(scene, depthCamera);

    renderer.setRenderTarget(depthCombinerTextureTarget);
    renderer.render(combinerScene, combinerCamera);

    renderer.setRenderTarget(depthCombinerSyncTarget);
    renderer.render(combinerScene2, combinerCamera);
    
    applyDepthToDisplacementMap();
    
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
}

animate()