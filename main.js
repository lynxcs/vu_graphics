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
        const showCollisions = false;
        const heightScale = 0.2;
        const textureSize = 256;
        
        function generateCanvasElement(width, height, id) {
            let elem = document.createElement('canvas');
            elem.id = id;
            elem.width = width;
            elem.height = height;
            return elem;
        }

        document.body.appendChild(generateCanvasElement(textureSize, textureSize, 'canvasD'));
        document.body.appendChild(generateCanvasElement(textureSize, textureSize, 'canvasN'));

        function setHeights(heightfield, canvas, scale, update_h = false) {
            const { x, z, y } = scale;
            const imageData = canvas.getImageData(0, 0, textureSize, textureSize);

            // Set element size for heightfield
            if (update_h === false) {
                heightfield.elementSize = Math.abs(x) / imageData.width;
                heightfield.data = [...Array(imageData.width)].map(e => Array(imageData.height).fill(0));
            }

            const matrix = heightfield.data;

            // Iterate over the imageData and update the matrix accordingly
            let lowest = 9999.999;
            let highest = -9999.99;
            for (let i = 0; i < imageData.height; i++) {
                const dataOffset = i * imageData.height;
                const matrixRow = matrix[y < 0 ? imageData.height - 1 - i : i];
                for (let j = 0; j < imageData.width; j++) {
                    const a = imageData.data[(dataOffset + j) * 4];
                    const height = (((a) / 255) * z);
                    const colIdx = x < 0 ? j : imageData.width - 1 - j;

                    if (height < lowest) {
                        lowest = height;
                    }
                    if (height > highest) {
                        highest = height;
                    }

                    matrixRow[colIdx] = height;
                }
            }

            heightfield.maxValue = highest;
            heightfield.minValue = lowest;
            heightfield.update();
        }

        // Add three-mesh-bvh extensions
        THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
        THREE.BufferGeometry.prototype.diposeBoundsTree = disposeBoundsTree;
        THREE.Mesh.prototype.raycast = acceleratedRaycast;

        let debugMeshWasupdated = false;

        const scene = new THREE.Scene()
        const world = new CANNON.World({gravity: new CANNON.Vec3(0, -9.81, 0)});

        world.broadphase = new CANNON.SAPBroadphase(world);
        world.defaultContactMaterial.friction = 2.0

        const cannonDebugger = debugEnabled ? new CannonDebugger(scene, world, {color: 0xff0000, onUpdate: ((body, mesh, shape) => {
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
        })}) : undefined;

        const groundMaterial = new CANNON.Material();

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        camera.position.set(5, 3.89, -0.133)
        camera.rotation.set(-0.554, 0.387, 0.22)
        camera.quaternion.set(0.89, -0.2755, 0.3354, 0.103)

        const light = new THREE.DirectionalLight()
        light.position.set(1, 1, 1)
        scene.add(light)

        scene.background = new THREE.Color( 0xa0a0a0 );
		scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );

        const light2 = new THREE.AmbientLight( 0x404040 );
        scene.add( light2 );

        const renderer = new THREE.WebGLRenderer({ antialias: true})
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setPixelRatio(window.devicePixelRatio)
        document.body.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enablePan = false
        controls.enableDamping = true

        const canvasD = document.getElementById('canvasD')
        const contextD = canvasD.getContext('2d', { willReadFrequently: true })
        const canvasN = document.getElementById('canvasN')
        const contextN = canvasN.getContext('2d')
        contextN.fillStyle = '#7f7fff'
        contextN.fillRect(0, 0, textureSize, textureSize)
        contextD.fillStyle = '#FFFFFF'
        contextD.fillRect(0, 0, textureSize, textureSize)
        height2normal(contextD, contextN);

        const displacementMap = new THREE.CanvasTexture(canvasD)
        const normalMap = new THREE.CanvasTexture(canvasN)

        const colorMap = new THREE.TextureLoader().load(snowTextureUrl);

        const snowGeomPlot = 16;
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

        geometry.computeBoundsTree();

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
        const heightsElem = {x: snowGeomPlot, z: heightScale, y: -2}
        let heightfieldShape = new CANNON.Heightfield(matrix, {elementSize: 4})
        setHeights(heightfieldShape, contextD, heightsElem)
        const heightfieldBody = new CANNON.Body({ mass: 0, isTrigger: true, shape: heightfieldShape, type: CANNON.Body.STATIC })

        heightfieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0.5 * Math.PI)
        heightfieldBody.position.set(snowGeomPlot / 2, 0, snowGeomPlot / 2);

        world.addBody(heightfieldBody)
        
        function initDisplacement() {
            contextN.fillStyle = '#7f7fff'
            contextN.fillRect(0, 0, textureSize, textureSize)
            contextD.fillStyle = '#FFFFFF'
            contextD.fillRect(0, 0, textureSize, textureSize)
            coloredMaterial.needsUpdate = true
            displacementMap.needsUpdate = true;
            height2normal(contextD, contextN);
        }
        
        const controlParameters = {
            brushSize: 1,
            brushPower: -1,
            resetDisplacement: function() {
                initDisplacement();
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
                if (update_n) {
                    height2normal(contextD, contextN);
                }
                if (set_h) {
                    heightfieldBody.removeShape(heightfieldShape);
                    setHeights(heightfieldShape, contextD, heightsElem)
                    heightfieldBody.addShape(heightfieldShape);
                }
                debugMeshWasupdated = true;
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
            render()
        }

        const stats = new Stats()
        document.body.appendChild(stats.dom)

        const gui = new GUI()
        gui.add(controlParameters, 'brushSize', 1, 64, 1)
        gui.add(controlParameters, 'brushPower', -255, 255, 1)
        gui.add(controlParameters, 'resetDisplacement')

        const mapNum = function (obj, in_min, in_max, out_min, out_max) {
            let val = (obj - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
            if (val < out_min) val = out_min;
            else if (val > out_max) val = out_max;
            return val;
        }

        function displayDebugSphere(position) {
            if (showCollisions) {
                let writtenIdx = debugInstance.count;
                debugInstance.setMatrixAt(writtenIdx, new THREE.Matrix4().makeTranslation(position.x, position.y, position.z));
                debugInstance.count++;
                debugInstance.instanceMatrix.needsUpdate = true;
            }
        }
        
        function clearDebugSpheres() {
            if (showCollisions) {
                debugInstance.count = 0;
                debugInstance.instanceMatrix.needsUpdate = true;
            }
        }

        const debugGeom = showCollisions? new THREE.SphereGeometry(0.01, 4, 4) : undefined; // Small sphere with radius 0.1
        const debugMat = showCollisions ? new THREE.MeshBasicMaterial({ color: 0x00ff00 }) : undefined; // Green color
        const debugInstance = showCollisions ? new THREE.InstancedMesh(debugGeom, debugMat, 3000) : undefined;
        if (showCollisions) {
            debugInstance.count = 0;
            scene.add(debugInstance);
        }

        const vehicleParams = {
            mass: 1,
            axis_width: 0.7,
            chassis_y: 0.25,
            chassis_z: 0.445,
            wheel_x: 0.4,
            wheel_y: -0.2,
            front_wheel_radius: 0.2,
            front_wheel_height: 0.1,
            front_wheel_z_scale: 1.2,
            back_wheel_radius: 0.2,
            back_wheel_height: 0.1,
            back_wheel_z_scale: 1.2,
        };

        var vehicle = new Vehicle(scene, world, groundMaterial, vehicleParams);

        const vehicleFunctions = {
            resetVehicle: function() {
                vehicle.reset();
            },
        };

        const vehicleFolder = gui.addFolder('Vehicle')
        vehicleFolder.add(vehicleParams, 'mass', 0.1, 10, 0.1)
        vehicleFolder.add(vehicleParams, 'axis_width', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'chassis_y', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'chassis_z', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'wheel_x', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'wheel_y', -2, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'front_wheel_radius', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'front_wheel_height', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'front_wheel_z_scale', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'back_wheel_radius', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'back_wheel_height', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleParams, 'back_wheel_z_scale', 0.1, 2, 0.1)
        vehicleFolder.add(vehicleFunctions, 'resetVehicle')
        vehicleFolder.onFinishChange(function() {
                vehicle.dispose();
                vehicle = new Vehicle(scene, world, groundMaterial, vehicleParams);
        });

        function animate() {
            requestAnimationFrame(animate)

            controls.update()

            stats.update()

            if (Date.now() - lastRaycast > 4 &&  shouldRaycast) {
                raycast();
                shouldRaycast = false;
                lastRaycast = Date.now();
            }

            world.fixedStep(1 / 60)

            if (debugEnabled) {
                cannonDebugger.update()
            }

            let wasModified = false;
            clearDebugSpheres(); // clear last frames debug spheres
            world.contacts.forEach((contact) => {
                if (contact.bj === heightfieldBody) {
                    const poz = new CANNON.Vec3();
                    poz.copy(contact.bi.position);
                    poz.x += contact.ri.x;
                    poz.y += contact.ri.y;
                    poz.z += contact.ri.z;
                    raycaster.ray.origin.copy(poz); // Start ray at collision point
                    raycaster.ray.direction.set(0, -1, 0); // Point ray downwards (towards the plane)
                    let intersects2 = raycaster.intersectObject(plane, false)
                    if (intersects2.length > 0) {
                        let vv = mapNum(intersects2[0].distance, 0.0, heightScale, 0, 255)
                        let pp = mapNum(intersects2[0].distance, 0.0, 0.10, 1.45, 0.75)
                        let drawModified = draw(intersects2[0].uv, false, false, vv, true, Math.round(pp));
                        if (drawModified) {
                            displayDebugSphere(poz);
                            wasModified = true;
                        }
                    }
                }
            });

            if (wasModified) {
                height2normal(contextD, contextN);
                coloredMaterial.needsUpdate = true
                heightfieldBody.removeShape(heightfieldShape);
                setHeights(heightfieldShape, contextD, heightsElem, true)
                heightfieldBody.addShape(heightfieldShape);
            }

            vehicle.update();

            render()
        }

        function render() {
            renderer.render(scene, camera)
        }

        animate()