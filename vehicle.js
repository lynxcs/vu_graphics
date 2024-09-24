import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export default class Vehicle {
    // Vehicle options must have:
    // mass
    // axis_width, chassis_y, chassis_z
    // wheel_x, wheel_y
    // front_wheel_radius, front_wheel_height, front_wheel_z_scale
    // back_wheel_radius, back_wheel_height, back_wheel_z_scale
    constructor(scene, world, ground_material, vehicleOptions) {
        this.world = world;
        this.scene = scene;
        this.vehicleOptions = vehicleOptions;
    
        this.chassisShape = new CANNON.Box(new CANNON.Vec3(vehicleOptions.axis_width / 2, vehicleOptions.chassis_y, vehicleOptions.chassis_z));

        this.chassisBody = new CANNON.Body({ mass: vehicleOptions.mass });
        this.chassisBody.addShape(this.chassisShape);
        this.chassisBody.position.set(0, 4, 0);

        this.vehicle = new CANNON.RigidVehicle({
            chassisBody: this.chassisBody,
        });

        let chassisGeom = new THREE.BoxGeometry(vehicleOptions.axis_width, vehicleOptions.chassis_y * 2, vehicleOptions.chassis_z * 2);
        this.chassisMesh = new THREE.Mesh(chassisGeom, new THREE.MeshNormalMaterial());
        scene.add(this.chassisMesh);
        
        const wheelMaterial = new CANNON.Material();
        let down = new CANNON.Vec3(0, -1, 0);
        const numSegments = 16;

        const backWheelShape = new CANNON.Cylinder(vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_height, numSegments);
        const backWheelGeom = new THREE.CylinderGeometry(vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_radius, vehicleOptions.back_wheel_height, numSegments);
        backWheelGeom.rotateY(-Math.PI / 2);
        backWheelGeom.rotateX(-Math.PI / 2);
        backWheelGeom.rotateZ(-Math.PI / 2);

        const frontWheelShape = new CANNON.Cylinder(vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_height, numSegments);
        const frontWheelGeom = new THREE.CylinderGeometry(vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_radius, vehicleOptions.front_wheel_height, numSegments);
        frontWheelGeom.rotateY(-Math.PI / 2);
        frontWheelGeom.rotateX(-Math.PI / 2);
        frontWheelGeom.rotateZ(-Math.PI / 2);

        this.wheelBody1 = new CANNON.Body({ mass: vehicleOptions.mass, material: wheelMaterial })
        this.wheelBody1.addShape(frontWheelShape, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        this.vehicle.addWheel({
          body: this.wheelBody1,
          position: new CANNON.Vec3(-vehicleOptions.wheel_x, vehicleOptions.wheel_y, vehicleOptions.axis_width / vehicleOptions.front_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, 1),
          direction: down,
        })
        this.wheelMesh1 = new THREE.Mesh(frontWheelGeom, new THREE.MeshNormalMaterial())
        scene.add(this.wheelMesh1)

        this.wheelBody2 = new CANNON.Body({ mass: vehicleOptions.mass, material: wheelMaterial })
        this.wheelBody2.addShape(frontWheelShape, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        this.vehicle.addWheel({
          body: this.wheelBody2,
          position: new CANNON.Vec3(-vehicleOptions.wheel_x, vehicleOptions.wheel_y, -vehicleOptions.axis_width / vehicleOptions.front_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, -1),
          direction: down,
        })
        this.wheelMesh2 = new THREE.Mesh(frontWheelGeom, new THREE.MeshNormalMaterial())
        scene.add(this.wheelMesh2)

        this.wheelBody3 = new CANNON.Body({ mass: vehicleOptions.mass, material: wheelMaterial })
        this.wheelBody3.addShape(backWheelShape, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        this.vehicle.addWheel({
          body: this.wheelBody3,
          position: new CANNON.Vec3(vehicleOptions.wheel_x, vehicleOptions.wheel_y, vehicleOptions.axis_width / vehicleOptions.back_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, 1),
          direction: down,
        })
        this.wheelMesh3 = new THREE.Mesh(backWheelGeom, new THREE.MeshNormalMaterial())
        scene.add(this.wheelMesh3)

        this.wheelBody4 = new CANNON.Body({ mass: vehicleOptions.mass, material: wheelMaterial })
        this.wheelBody4.addShape(backWheelShape, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, -Math.PI / 2))
        this.vehicle.addWheel({
          body: this.wheelBody4,
          position: new CANNON.Vec3(vehicleOptions.wheel_x, vehicleOptions.wheel_y, -vehicleOptions.axis_width / vehicleOptions.back_wheel_z_scale),
          axis: new CANNON.Vec3(0, 0, -1),
          direction: down,
        })
        this.wheelMesh4 = new THREE.Mesh(backWheelGeom, new THREE.MeshNormalMaterial())
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
    