        import * as THREE from 'three'
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import Stats from 'three/examples/jsm/libs/stats.module.js';
        import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
        import { computeBoundsTree, disposeBoundsTree, computeBatchedBoundsTree, disposeBatchedBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
        import * as CANNON from 'cannon-es'
        import CannonDebugger from 'cannon-es-debugger'
        import displacementVertexShader from './shaders/disp_color.vert?raw'
        import displacementFragmentShader from './shaders/disp_color.frag?raw'

        import snowTextureUrl from './textures/snow6_color.png'

        const wireFrameEnabled = false;
        const debugEnabled = false;
        const showCollisions = false;
        const heightScale = 0.2;
        const heightOffset = 0.0;
        const heightOffset2 = 0.00;
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
                    const height = (((a) / 255) * z) + heightOffset;
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
            // Force it to update shape
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

        //const newlight = new THREE.
        const light2 = new THREE.AmbientLight( 0x404040 ); // soft white light
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
            type: CANNON.Body.STATIC, // can also be achieved by setting the mass to 0
            shape: new CANNON.Plane(),
            material: groundMaterial,
        })
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0) // make it face up
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
        heightfieldBody.position.set(snowGeomPlot / 2, -(heightOffset + heightOffset2), snowGeomPlot / 2);

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
            resetSphere: function() {
                sphereBody.position.set(0, 10, 0);
                sphereBody.velocity.set(0, 0, 0);
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
                    // left edge
                    x1 = src.data[i]
                    x2 = src.data[i + 4]
                } else if (i % (width * 4) == (width - 1) * 4) {
                    // right edge
                    x1 = src.data[i - 4]
                    x2 = src.data[i]
                } else {
                    x1 = src.data[i - 4]
                    x2 = src.data[i + 4]
                }

                if (i < width * 4) {
                    // top edge
                    y1 = src.data[i]
                    y2 = src.data[i + width * 4]
                } else if (i > width * (height - 1) * 4) {
                    // bottom edge
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
                    data[i + 1] = clamp(0, data[i + 1] - 1, increaseBy); // Green
                    data[i + 2] = clamp(0, data[i + 2] - 1, increaseBy); // Blue
                } else {
                    data[i] = clamp(0, 255, data[i] + increaseBy);     // Red
                    data[i + 1] = clamp(0, 255, data[i + 1] + increaseBy); // Green
                    data[i + 2] = clamp(0, 255, data[i + 2] + increaseBy); // Blue
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

            const top_left_x = top_left_cast_x - controlParameters.brushSize / 2;
            const top_left_y = top_left_cast_y - controlParameters.brushSize / 2;

            const powpow = intensity === 0.0 ? controlParameters.brushPower : intensity;
            const bpow = sizePow === 0.0 ? controlParameters.brushSize : sizePow;

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
        gui.add(coloredMaterial.uniforms.bumpScale, 'value', 0.01, 0.8, 0.01)
        gui.add(controlParameters, 'brushSize', 1, 64, 1)
        gui.add(controlParameters, 'brushPower', -255, 255, 1)
        gui.add(controlParameters, 'resetDisplacement')
        gui.add(controlParameters, 'resetSphere')

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

        // FIXME: Move all this car stuff into separate file
        const axisWidth = 0.8
        const chassisDimensions = {
            x: axisWidth / 2,
            y: 0.25,
            z: 0.345
        };
        const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisDimensions.x, chassisDimensions.y, chassisDimensions.z))
        const chassisBody = new CANNON.Body({ mass: 1 })
        const centerOfMassAdjust = new CANNON.Vec3(0, 0, 0)
        chassisBody.addShape(chassisShape, centerOfMassAdjust)
        chassisBody.position.set(0, 10, 0)

        // Create the vehicle
        const vehicle = new CANNON.RigidVehicle({
          chassisBody,
        })

        const chassisGeom = new THREE.BoxGeometry(chassisDimensions.x * 2, chassisDimensions.y * 2, chassisDimensions.z * 2);
        const chassisMesh = new THREE.Mesh(chassisGeom, new THREE.MeshNormalMaterial())
        scene.add(chassisMesh)

        const mass = 1
        const wheelShape = new CANNON.Sphere(0.1)
        const wheelMaterial = new CANNON.Material('wheel')
        const down = new CANNON.Vec3(0, -1, 0)
        const wheelX = 0.4
        const wheelY = -0.2

        const radiusTop = 0.2
        const radiusBottom = 0.2
        const height = 0.1
        const numSegments = 12
        const cylinderShape = new CANNON.Cylinder(radiusTop, radiusBottom, height / 4, numSegments)
        const cylinderShape2 = new CANNON.Cylinder(radiusTop*1.2, radiusBottom*1.2, height / 4, numSegments)

        const wheelMeshGeom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height / 4, numSegments);
        wheelMeshGeom.rotateY(-Math.PI / 2);
        wheelMeshGeom.rotateX(-Math.PI / 2);
        wheelMeshGeom.rotateZ(-Math.PI / 2);

        const wheelMeshGeom2 = new THREE.CylinderGeometry(radiusTop*1.2, radiusBottom*1.2, height / 4, numSegments);
        wheelMeshGeom2.rotateY(-Math.PI / 2);
        wheelMeshGeom2.rotateX(-Math.PI / 2);
        wheelMeshGeom2.rotateZ(-Math.PI / 2);

        const wheelBody1 = new CANNON.Body({ mass, material: wheelMaterial })
        wheelBody1.addShape(cylinderShape, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        vehicle.addWheel({
          body: wheelBody1,
          position: new CANNON.Vec3(-wheelX, wheelY, axisWidth / 2.2).vadd(centerOfMassAdjust),
          axis: new CANNON.Vec3(0, 0, 1),
          direction: down,
        })
        const wheelMesh1 = new THREE.Mesh(wheelMeshGeom, new THREE.MeshNormalMaterial())
        scene.add(wheelMesh1)

        const wheelBody2 = new CANNON.Body({ mass, material: wheelMaterial })
        wheelBody2.addShape(cylinderShape, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        vehicle.addWheel({
          body: wheelBody2,
          position: new CANNON.Vec3(-wheelX, wheelY, -axisWidth / 2.2).vadd(centerOfMassAdjust),
          axis: new CANNON.Vec3(0, 0, -1),
          direction: down,
        })
        const wheelMesh2 = new THREE.Mesh(wheelMeshGeom, new THREE.MeshNormalMaterial())
        scene.add(wheelMesh2)

        const wheelBody3 = new CANNON.Body({ mass, material: wheelMaterial })
        wheelBody3.addShape(cylinderShape2, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        vehicle.addWheel({
          body: wheelBody3,
          position: new CANNON.Vec3(wheelX, wheelY, axisWidth / 1.2).vadd(centerOfMassAdjust),
          axis: new CANNON.Vec3(0, 0, 1),
          direction: down,
        })
        const wheelMesh3 = new THREE.Mesh(wheelMeshGeom2, new THREE.MeshNormalMaterial())
        scene.add(wheelMesh3)

        const wheelBody4 = new CANNON.Body({ mass, material: wheelMaterial })
        wheelBody4.addShape(cylinderShape2, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        vehicle.addWheel({
          body: wheelBody4,
          position: new CANNON.Vec3(wheelX, wheelY, -axisWidth / 1.2).vadd(centerOfMassAdjust),
          axis: new CANNON.Vec3(0, 0, -1),
          direction: down,
        })
        const wheelMesh4 = new THREE.Mesh(wheelMeshGeom2, new THREE.MeshNormalMaterial())
        scene.add(wheelMesh4)

        vehicle.wheelBodies.forEach((wheelBody) => {
          // Some damping to not spin wheels too fast
          wheelBody.angularDamping = 0.4
        })

        vehicle.addToWorld(world)

        const wheel_ground = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
          friction: 0.3,
          restitution: 0,
          contactEquationStiffness: 1000,
        })
        world.addContactMaterial(wheel_ground)

        document.addEventListener('keydown', (event) => {
          const maxSteerVal = Math.PI / 10
          const maxSpeed = 1.0
          const maxForce = 1.5

          switch (event.key) {
            case 'w':
            case 'ArrowUp':
              vehicle.setWheelForce(maxForce, 2)
              vehicle.setWheelForce(-maxForce, 3)
              break

            case 's':
            case 'ArrowDown':
              vehicle.setWheelForce(-maxForce / 1.25, 2)
              vehicle.setWheelForce(maxForce / 1.25, 3)
              break

            case 'a':
            case 'ArrowLeft':
              vehicle.setSteeringValue(maxSteerVal, 0)
              vehicle.setSteeringValue(maxSteerVal, 1)
              break

            case 'd':
            case 'ArrowRight':
              vehicle.setSteeringValue(-maxSteerVal, 0)
              vehicle.setSteeringValue(-maxSteerVal, 1)
              break
          }
        })

        // Reset force on keyup
        document.addEventListener('keyup', (event) => {
          switch (event.key) {
            case 'w':
            case 'ArrowUp':
              vehicle.setWheelForce(0, 2)
              vehicle.setWheelForce(0, 3)
              break

            case 's':
            case 'ArrowDown':
              vehicle.setWheelForce(0, 2)
              vehicle.setWheelForce(0, 3)
              break

            case 'a':
            case 'ArrowLeft':
              vehicle.setSteeringValue(0, 0)
              vehicle.setSteeringValue(0, 1)
              break

            case 'd':
            case 'ArrowRight':
              vehicle.setSteeringValue(0, 0)
              vehicle.setSteeringValue(0, 1)
              break
          }
        })

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
                cannonDebugger.update() // Update the CannonDebugger meshes
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
                        let pp = mapNum(intersects2[0].distance, 0.0, 0.10, 1.95, 0.75)
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

            chassisMesh.position.copy(chassisBody.position)
            chassisMesh.quaternion.copy(chassisBody.quaternion)
            wheelMesh1.position.copy(wheelBody1.position)
            wheelMesh1.quaternion.copy(wheelBody1.quaternion)
            wheelMesh2.position.copy(wheelBody2.position)
            wheelMesh2.quaternion.copy(wheelBody2.quaternion)
            wheelMesh3.position.copy(wheelBody3.position)
            wheelMesh3.quaternion.copy(wheelBody3.quaternion)
            wheelMesh4.position.copy(wheelBody4.position)
            wheelMesh4.quaternion.copy(wheelBody4.quaternion)

            render()
        }

        function render() {
            renderer.render(scene, camera)
        }

        animate()