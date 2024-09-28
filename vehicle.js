import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { threeToCannon, ShapeType } from 'three-to-cannon';

import chassisUrl from './models/chassis.glb?url'
import wheelUrl from './models/wheel3.glb?url'

export default class Vehicle {
    // Vehicle options must have:
    // mass
    // axis_width, chassis_y, chassis_z
    // wheel_x, wheel_y
    // front_wheel_radius, front_wheel_height, front_wheel_z_scale
    // back_wheel_radius, back_wheel_height, back_wheel_z_scale
    constructor(scene, world, ground_material, vehicleOptions) {
        this.init_everything(scene, world, ground_material, vehicleOptions);
    }

    async init_everything(scene, world, ground_material, vehicleOptions) {
        this.world = world;
        this.scene = scene;
        this.vehicleOptions = vehicleOptions;

        await this.load_models();
    
        const chassisBodyConversion = threeToCannon(this.chassisMesh, {type: ShapeType.BOX})
        this.chassisBody = new CANNON.Body({ mass: vehicleOptions.mass, });
        this.chassisBody.addShape(chassisBodyConversion.shape, chassisBodyConversion.offset, chassisBodyConversion.orientation)
        this.chassisBody.position.set(0, 4, 0);

        console.log(this.chassisBody);
        this.vehicle = new CANNON.RigidVehicle({
            chassisBody: this.chassisBody,
        });

        const wheelMaterial = new CANNON.Material();
        let down = new CANNON.Vec3(0, -1, 0);
        const numSegments = 16;

        const wheelShape = new CANNON.Cylinder(vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_height, numSegments);
        let createWheelBody = function () { let body = new CANNON.Body({ mass: vehicleOptions.mass, material: wheelMaterial, }); body.addShape(wheelShape, new CANNON.Vec3(-0.005, 0.007, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2)); return body; }
        // const wheelBodyConversion = threeToCannon(this.wheelMesh, {type: ShapeType.CYLINDER})
        // let createWheelBody = function () { let body = new CANNON.Body({ mass: vehicleOptions.mass, material: wheelMaterial, }); body.addShape(wheelBodyConversion.shape, wheelBodyConversion.offset, new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2)); return body; }
        // const backWheelGeom = new THREE.CylinderGeometry(vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_height, numSegments);
        // backWheelGeom.rotateY(-Math.PI / 2);
        // backWheelGeom.rotateX(-Math.PI / 2);
        // backWheelGeom.rotateZ(-Math.PI / 2);

        // const frontWheelShape = new CANNON.Cylinder(vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_height, numSegments);
        // const frontWheelGeom = new THREE.CylinderGeometry(vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_height, numSegments);
        // frontWheelGeom.rotateY(-Math.PI / 2);
        // frontWheelGeom.rotateX(-Math.PI / 2);
        // frontWheelGeom.rotateZ(-Math.PI / 2);

        const frontOffset = -0.2
        this.wheelBody1 = createWheelBody();
        this.vehicle.addWheel({
          body: this.wheelBody1,
          position: new CANNON.Vec3(-vehicleOptions.wheel_x + frontOffset, vehicleOptions.wheel_y, vehicleOptions.axis_width / vehicleOptions.front_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, 1),
          direction: down,
        })
        this.wheelMesh1 = this.wheelMesh.clone();
        scene.add(this.wheelMesh1)

        this.wheelBody2 = createWheelBody();
        this.vehicle.addWheel({
          body: this.wheelBody2,
          position: new CANNON.Vec3(-vehicleOptions.wheel_x + frontOffset, vehicleOptions.wheel_y, -vehicleOptions.axis_width / vehicleOptions.front_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, -1),
          direction: down,
        })
        this.wheelMesh2 = this.wheelMesh.clone();
        scene.add(this.wheelMesh2)

        this.wheelBody3 = createWheelBody();
        this.vehicle.addWheel({
          body: this.wheelBody3,
          position: new CANNON.Vec3(vehicleOptions.wheel_x, vehicleOptions.wheel_y, vehicleOptions.axis_width / vehicleOptions.back_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, 1),
          direction: down,
        })
        this.wheelMesh3 = this.wheelMesh.clone();
        scene.add(this.wheelMesh3)

        this.wheelBody4 = createWheelBody();
        this.vehicle.addWheel({
          body: this.wheelBody4,
          position: new CANNON.Vec3(vehicleOptions.wheel_x, vehicleOptions.wheel_y, -vehicleOptions.axis_width / vehicleOptions.back_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, -1),
          direction: down,
        })
        this.wheelMesh4 = this.wheelMesh;
        scene.add(this.wheelMesh4)

        this.vehicle.wheelBodies.forEach((wheelBody) => {
          wheelBody.angularDamping = 0.4
        })

        this.vehicle.addToWorld(world)

        const wheel_ground = new CANNON.ContactMaterial(wheelMaterial, ground_material, {
          friction: 0.3,
          restitution: 0,
          contactEquationStiffness: 1000,
        })
        world.addContactMaterial(wheel_ground)

        this.event_listener();
    }

    async load_models() {
        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();

        dracoLoader.setDecoderConfig({ type: 'js' })
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

        gltfLoader.setDRACOLoader(dracoLoader);

        // Load chassis model
        let chassis_gltf = await gltfLoader.loadAsync(chassisUrl);
        // chassis_gltf.scene.scale.set(2.5, 2.5, 2.5); 
        this.chassisMesh = chassis_gltf.scene;
        this.scene.add(this.chassisMesh);
        // chassis_gltf.scene.traverse(function (child) {
        //     console.log(child);
        // });
        
        // Load wheel model
        // Back right
        let wheel_gltf = await gltfLoader.loadAsync(wheelUrl);
        let wheelScale = 0.0018;
        wheel_gltf.scene.scale.set(wheelScale, wheelScale, wheelScale); 
        this.wheelMesh = wheel_gltf.scene;
        // this.wheelMesh.rotateY(-Math.PI / 2);
        // this.wheelMesh.rotateX(-Math.PI / 2);
        // this.wheelMesh.rotateZ(-Math.PI / 2);
        // this.scene.add(this.wheelMesh);
        // gltfLoader.load("./models/wheel.glb", gltf => {
        // });
        // Back left
        // gltfLoader.load("./models/wheel.glb", gltf => {
        //     gltf.scene.scale.set(2.5, 2.5, -2.5); 
        //     this.back_left = gltf.scene;
        //     this.scene.add(this.back_left);
        // });
        // Front left
        // gltfLoader.load("./models/wheel.glb", gltf => {
        //     gltf.scene.scale.set(-2.5, 2.5, -2.5); 
        //     gltf.scene.position.add(new THREE.Vector3(-0.47, 0, 0))
        //     this.front_left = gltf.scene;
        //     this.scene.add(this.front_left);
        // });
        // Front right
        // gltfLoader.load("./models/wheel.glb", gltf => {
        //     gltf.scene.scale.set(-2.5, 2.5, 2.5); 
        //     gltf.scene.position.add(new THREE.Vector3(-0.47, 0, 0))
        //     this.front_right = gltf.scene;
        //     this.scene.add(this.front_right);
        // });
    }

    event_listener() {
        document.addEventListener('keydown', (event) => {
          const maxSteerVal = Math.PI / 10
          const maxForce = 1.1

          switch (event.key) {
            case 'w':
            case 'ArrowUp':
              this.vehicle.setWheelForce(maxForce, 2)
              this.vehicle.setWheelForce(-maxForce, 3)
              break

            case 's':
            case 'ArrowDown':
              this.vehicle.setWheelForce(-maxForce / 1.25, 2)
              this.vehicle.setWheelForce(maxForce / 1.25, 3)
              break

            case 'a':
            case 'ArrowLeft':
              this.vehicle.setSteeringValue(maxSteerVal, 0)
              this.vehicle.setSteeringValue(maxSteerVal, 1)
              break

            case 'd':
            case 'ArrowRight':
              this.vehicle.setSteeringValue(-maxSteerVal, 0)
              this.vehicle.setSteeringValue(-maxSteerVal, 1)
              break
          }
        })

        document.addEventListener('keyup', (event) => {
          switch (event.key) {
            case 'w':
            case 'ArrowUp':
              this.vehicle.setWheelForce(0, 2)
              this.vehicle.setWheelForce(0, 3)
              break

            case 's':
            case 'ArrowDown':
              this.vehicle.setWheelForce(0, 2)
              this.vehicle.setWheelForce(0, 3)
              break

            case 'a':
            case 'ArrowLeft':
              this.vehicle.setSteeringValue(0, 0)
              this.vehicle.setSteeringValue(0, 1)
              break

            case 'd':
            case 'ArrowRight':
              this.vehicle.setSteeringValue(0, 0)
              this.vehicle.setSteeringValue(0, 1)
              break
          }
        })
    }

    dispose() {
        this.scene.remove(this.chassisMesh);
        this.scene.remove(this.wheelMesh1);
        this.scene.remove(this.wheelMesh2);
        this.scene.remove(this.wheelMesh3);
        this.scene.remove(this.wheelMesh4);
        this.vehicle.removeFromWorld(this.world);
    }

    reset() {
        this.vehicle.chassisBody.position.set(0, 4, 0)
        this.vehicle.wheelBodies.forEach((wheelBody) => {
            wheelBody.position.set(0, 4, 0)
        });
    }

    update() {
        if (this.chassisMesh && this.wheelMesh1 && this.wheelMesh2 && this.wheelMesh3 && this.wheelMesh4) {
            this.chassisMesh.position.copy(this.chassisBody.position)
            this.chassisMesh.quaternion.copy(this.chassisBody.quaternion)
            this.wheelMesh1.position.copy(this.wheelBody1.position)
            this.wheelMesh1.quaternion.copy(this.wheelBody1.quaternion)
            this.wheelMesh2.position.copy(this.wheelBody2.position)
            this.wheelMesh2.quaternion.copy(this.wheelBody2.quaternion)
            this.wheelMesh3.position.copy(this.wheelBody3.position)
            this.wheelMesh3.quaternion.copy(this.wheelBody3.quaternion)
            this.wheelMesh4.position.copy(this.wheelBody4.position)
            this.wheelMesh4.quaternion.copy(this.wheelBody4.quaternion)
        }
    }
}

// Pasiskolint 3D modelio
// Ratai su dantukais
// Ataskaita ±3 pls