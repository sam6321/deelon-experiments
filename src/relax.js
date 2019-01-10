import React from 'react';
import * as THREE from 'three';
import PointGrid from './physics/PointGrid.js';
import Canvas from './canvas.js';
import { ResizableBox } from 'react-resizable';
import * as dat from 'dat.gui';
import 'react-resizable/css/styles.css';

function addAll(array, ...arrays) {
    for(let i = 0, len1 = arrays.length; i < len1; i++) {
        const currentArray = arrays[i];
        for(let a = 0, len2 = currentArray.length; a < len2; a++) {
            array.push(currentArray[a]);
        }
    }
    return array;
}

export default class VectorRelax extends React.Component {

    static defaultWidth = 1024;
    static defaultHeight = 768;

    static minPoints = 1;
    static maxPoints = 5000;
    static minInteractionDistance = 1;
    static maxInteractionDistance = 200;
    static minSpeed = 1;
    static maxSpeed = 1000;
    static minCircleRadius = 1;
    static maxCircleRadius = 200;

    renderer = new THREE.WebGLRenderer();
    camera = new THREE.OrthographicCamera(
        0, VectorRelax.defaultWidth,
        0, VectorRelax.defaultHeight,
        0, 1000
    );
    scene = new THREE.Scene();
    spatialPartition = new PointGrid(16);
    points = [];

    geometry = new THREE.BufferGeometry();
    positionAttribute = null;
    animationFrameId = null;
    lastFrameTime = null;
    numPoints = 500;
    numPointsLast = this.numPoints;
    speed = 10;
    expand = true;
    minDistance = 32;
    minDistanceSq = this.minDistance * this.minDistance;

    circleRadius = 48;
    circleRadiusSq = this.circleRadius * this.circleRadius;
    circleGeometry = new THREE.CircleBufferGeometry(1, 16);
    circle = new THREE.Mesh(this.circleGeometry, new THREE.MeshBasicMaterial({color: 0xffffff}));
    circleWrapMeshX = new THREE.Mesh(this.circleGeometry, new THREE.MeshBasicMaterial({color: 0xaaaaaa}));
    circleWrapMeshY = new THREE.Mesh(this.circleGeometry, new THREE.MeshBasicMaterial({color: 0xaaaaaa}));

    needsWrap = false;

    constructor(props) {
        super(props);

        const centreX = VectorRelax.defaultWidth * 0.5;
        const centreY = VectorRelax.defaultHeight * 0.5;
        const spreadX = 0.2 * VectorRelax.defaultWidth;
        const spreadY = 0.2 * VectorRelax.defaultHeight;

        const vertices = [];
        const colours = [];
        for(let i = 0; i < VectorRelax.maxPoints; i++) {
            const x = THREE.Math.randFloat(centreX - spreadX, centreX + spreadX);
            const y = THREE.Math.randFloat(centreY - spreadY, centreY + spreadY);
            const z = 0;
            const r = THREE.Math.randFloat(0.1, 1.0);
            const g = THREE.Math.randFloat(0.1, 1.0);
            const b = THREE.Math.randFloat(0.1, 1.0);

            vertices.push(x, y, z);
            colours.push(r, g, b);
            this.points.push({x, y, z, id: i});
        }

        for(let i = 0; i < this.numPoints; i++) {
            this.spatialPartition.add(this.points[i]);
        }

        // Create renderable points
        this.positionAttribute = new THREE.Float32BufferAttribute(vertices, 3).setDynamic(true);
        this.colourAttribute = new THREE.Float32BufferAttribute(colours, 3);
        this.geometry.addAttribute('position', this.positionAttribute);
        this.geometry.addAttribute('color', this.colourAttribute);
        this.geometry.setDrawRange(0, this.numPoints);
        const points = new THREE.Points(this.geometry, new THREE.PointsMaterial({vertexColors: THREE.VertexColors, size: 4.0}));

        // Set initial camera position and direction
        this.camera.position.z = 1;
        this.camera.lookAt(0, 0, 0);

        // Create the user's interaction circle.
        this.circle.rotation.y = THREE.Math.degToRad(180);
        this.circle.scale.set(this.circleRadius, this.circleRadius, 1);
        this.circleWrapMeshX.visible = false;
        this.circleWrapMeshX.rotation.y = THREE.Math.degToRad(180);
        this.circleWrapMeshY.visible = false;
        this.circleWrapMeshY.rotation.y = THREE.Math.degToRad(180);

        // Add all objects to scene and initialise renderer
        this.scene.add(points, this.camera, this.circleWrapMeshX, this.circleWrapMeshY);
        this.renderer.setSize(VectorRelax.defaultWidth, VectorRelax.defaultHeight);

        this.gui = new dat.GUI({name: 'Controls'});
        this.gui.add(this, 'minDistance', VectorRelax.minInteractionDistance, VectorRelax.maxInteractionDistance).name('Min Distance');
        this.gui.add(this, 'speed', VectorRelax.minSpeed, VectorRelax.maxSpeed).name('Speed');
        this.gui.add(this, 'expand').name('Expand');
        this.gui.add(this, 'circleRadius', VectorRelax.minCircleRadius, VectorRelax.maxCircleRadius).name('Circle Radius').onChange(() => {
            this.circle.scale.set(this.circleRadius, this.circleRadius, 1);
            this.circleRadiusSq = this.circleRadius * this.circleRadius;
        });
        this.gui.add(this, 'numPoints', VectorRelax.minPoints, VectorRelax.maxPoints, 1).name("Point Count").onChange(() => {
            this.geometry.setDrawRange(0, this.numPoints);
            const pointCountChange = this.numPoints - this.numPointsLast;
            if(pointCountChange > 0) {
                for(let i = this.numPointsLast; i < this.numPoints; i++) {
                    if(this.points[i] === undefined) {
                        console.log(i);
                        debugger;
                    }
                    this.spatialPartition.add(this.points[i]);
                }
            }
            else if(pointCountChange < 0) {
                for(let i = this.numPoints; i < this.numPointsLast; i++) {
                    this.spatialPartition.remove(this.points[i]);
                }
            }

            this.numPointsLast = this.numPoints;
        });
    }

    componentDidMount() {
        this.lastFrameTime = performance.now() / 1000;
        this.update();
    }

    componentWillUnmount() {
        if(this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    onClick = e => {
        if(this.circle.parent === null) {
            this.scene.add(this.circle);
        }
        else {
            this.scene.remove(this.circle);
        }
    };

    onMouseMove = e => {
        const rect = e.target.getBoundingClientRect();
        this.circle.position.set(e.clientX - rect.left, e.clientY - rect.top, 0);
    };

    clampCamera(vector) {

        function oneDim(min, max, value) {
            const width = max - min;
            if(value >= max) {
                return value - width;
            }

            if(value <= min) {
                return value + width;
            }

            return value;
        }

        vector.x = oneDim(this.camera.left, this.camera.right, vector.x);
        vector.y = oneDim(this.camera.top, this.camera.bottom, vector.y);
    }

    getEdgeDistances(vector) {
        return {
            right: Math.abs(this.camera.right - vector.x),
            left: Math.abs(this.camera.left - vector.x),
            top: Math.abs(this.camera.top - vector.y),
            bottom: Math.abs(this.camera.bottom - vector.y)
        }
    }

    isNearEdgeX(distances, minDistanceToEdge) {
        return distances.right <= minDistanceToEdge || distances.left <= minDistanceToEdge;
    }

    isNearEdgeY(distances, minDistanceToEdge) {
        return distances.top <= minDistanceToEdge || distances.bottom <= minDistanceToEdge;
    }

    getEdgeWraps(vector, distances, minDistanceToEdge, wrapX, wrapY) {
        wrapX.copy(vector);
        wrapY.copy(vector);

        const camera = this.camera;
        if(distances.left <= minDistanceToEdge) {
            wrapX.x = camera.right + distances.left;
        }
        else if(distances.right <= minDistanceToEdge) {
            wrapX.x = camera.left - distances.right;
        }

        if(distances.top <= minDistanceToEdge) {
            wrapY.y = camera.bottom + distances.top;
        }
        else if(distances.bottom <= minDistanceToEdge) {
            wrapY.y = camera.top - distances.bottom;
        }
    }

    applyForce(vector, vector2, minDistance, delta) {
        const movement = new THREE.Vector3();
        let distance = minDistance - vector.distanceTo(vector2);
        distance = THREE.Math.mapLinear(distance, 0, minDistance, 0, 1);
        // Add movement to move this vector away from the other one so there's at least one unit of space
        movement.subVectors(vector, vector2);
        if(movement.lengthSq() === 0) {
            // pick a random movement direction
            const x = THREE.Math.randFloat(-1, 1);
            const y = THREE.Math.randFloat(-1, 1);
            movement.set(x, y, 0)
                .normalize()
                .multiplyScalar(delta);
        }
        else {
            movement.normalize()
                .multiplyScalar(distance * delta);
        }

        if(!this.expand) {
            vector.multiplyScalar(-1);
        }

        vector.add(movement);
    }

    update = () => {
        this.animationFrameId = requestAnimationFrame(this.update);
        const time = performance.now() / 1000;
        let delta = time - this.lastFrameTime;
        delta = Math.min(delta, 0.25);
        this.lastFrameTime = time;

        const vector = new THREE.Vector3();
        const vector2 = new THREE.Vector3();
        const edgeWrapX = new THREE.Vector3();
        const edgeWrapY = new THREE.Vector3();
        const circleEdgeWrapX = new THREE.Vector3();
        const circleEdgeWrapY = new THREE.Vector3();
        const points = this.points;
        const force = this.speed * delta;
        const minDistance = this.minDistance;
        const minDistanceSq = this.minDistanceSq;
        const spatialPartition = this.spatialPartition;
        const positionAttribute = this.positionAttribute;

        // First, collect all intersections between points
        const allIntersections = [];
        for(let i = 0, len = this.numPoints; i < len; i++) {
            const point = points[i];
            vector.set(point.x, point.y, 0);
            const intersections = spatialPartition.search(vector, minDistance);
            const distances = this.getEdgeDistances(vector);
            const nearX = this.isNearEdgeX(distances, minDistance);
            const nearY = this.isNearEdgeY(distances, minDistance);
            if(nearX || nearY) {
                // Wrap the point around the edge and also add in the intersections
                this.getEdgeWraps(vector, distances, minDistance, edgeWrapX, edgeWrapY);
                if(nearX) {
                    addAll(intersections, spatialPartition.search(edgeWrapX, minDistance));
                }
                if(nearY) {
                    addAll(intersections, spatialPartition.search(edgeWrapY, minDistance));
                }
            }
            allIntersections.push(intersections);
        }

        let circleEdgeDistances;
        let circleNearEdgeX = false;
        let circleNearEdgeY = false;
        if(this.circle.parent) {
            circleEdgeDistances = this.getEdgeDistances(this.circle.position);
            circleNearEdgeX = this.isNearEdgeX(circleEdgeDistances, this.circleRadius);
            circleNearEdgeY = this.isNearEdgeY(circleEdgeDistances, this.circleRadius);
            if(circleNearEdgeX || circleNearEdgeY) {
                this.getEdgeWraps(this.circle.position, circleEdgeDistances, this.circleRadius, circleEdgeWrapX, circleEdgeWrapY);
                this.circleWrapMeshX.position.copy(circleEdgeWrapX);
                this.circleWrapMeshY.position.copy(circleEdgeWrapY);
                this.circleWrapMeshX.visible = circleNearEdgeX;
                this.circleWrapMeshY.visible = circleNearEdgeY;
            }
            else {
                this.circleWrapMeshX.visible = false;
                this.circleWrapMeshY.visible = false;
            }
        }

        // Second, process intersections
        for(let i = 0, len = this.numPoints; i < len; i++) {
            let needsUpdate = this.needsWrap;
            const point = points[i];
            vector.set(point.x, point.y, 0);

            for(const intersection of allIntersections[i]) {
                const object = intersection.object;

                if(object.id === i) {
                    // Don't compare against the object we're searching as
                    continue;
                }

                vector2.set(intersection.x, intersection.y, 0);

                if(vector.distanceToSquared(vector2) > minDistanceSq) {
                    // this is a screen wrapped one
                    const distances = this.getEdgeDistances(vector2);
                    this.getEdgeWraps(vector2, distances, minDistance, edgeWrapX, edgeWrapY);
                    if(this.isNearEdgeX(distances, minDistance) && vector.distanceToSquared(edgeWrapX) <= minDistanceSq) {
                        this.applyForce(vector, edgeWrapX, minDistance, force);
                    }

                    if(this.isNearEdgeY(distances, minDistance) && vector.distanceToSquared(edgeWrapY) <= minDistanceSq) {
                        this.applyForce(vector, edgeWrapY, minDistance, force);
                    }
                }
                else {
                    // Non screen wrapped
                    this.applyForce(vector, vector2, minDistance, force);
                    if(vector.distanceTo(point) > minDistance) {
                        void undefined;
                    }
                }

                needsUpdate = true;
            }

            // Check against the user's circle
            if(this.circle.parent) {
                let distanceSq = vector.distanceToSquared(this.circle.position);
                const forceMultiplication = this.circleRadius - Math.sqrt(distanceSq);
                if (distanceSq < this.circleRadiusSq) {
                    const position = this.circle.position.clone();
                    position.z = 0;
                    this.applyForce(vector, position, this.circleRadius, force * forceMultiplication);
                    needsUpdate = true;
                }
                else if(circleNearEdgeX || circleNearEdgeY) {
                    if(circleNearEdgeX && vector.distanceToSquared(circleEdgeWrapX) <= this.circleRadiusSq) {
                        this.applyForce(vector, circleEdgeWrapX, this.circleRadius, force * forceMultiplication);
                    }

                    if(circleNearEdgeY && vector.distanceToSquared(circleEdgeWrapY) <= this.circleRadiusSq) {
                        this.applyForce(vector, circleEdgeWrapY, this.circleRadius, force * forceMultiplication);
                    }
                    needsUpdate = true;
                }
            }

            this.clampCamera(vector);

            if(needsUpdate) {
                point.x = vector.x;
                point.y = vector.y;
                point.radius = minDistance;
                spatialPartition.flagUpdated(point);
                positionAttribute.setXY(i, vector.x, vector.y);
                positionAttribute.needsUpdate = true;
            }
        }

        spatialPartition.update();
        this.renderer.render(this.scene, this.camera);
        this.needsWrap = false;
    };

    onResize = (_, data) => {
        const {width, height} = data.size;
        this.renderer.setSize(width, height);
        this.camera.left = 0;
        this.camera.right = width;
        this.camera.top = 0;
        this.camera.bottom = height;
        this.camera.updateProjectionMatrix();
        this.needsWrap = true;
    };

    render() {
        return (
            <div className='container2'>
                <div className='container'>
                    <div className='canvas-container '>
                        <ResizableBox width={1024} height={768}
                                      minConstraints={[320, 240]}
                                      maxConstraints={[1024, 768]}
                                      onResize={this.onResize}>
                            <Canvas canvas={this.renderer.domElement} onClick={this.onClick} onMouseMove={this.onMouseMove}/>
                        </ResizableBox>
                    </div>
                    <div className='gui' ref={e => e && e.appendChild(this.gui.domElement)}/>
                </div>

                <p className='description'>
                    <h1>Vector Relaxation</h1>

                    <b>Description</b>
                    <p>
                        A set of points are inserted into a field with one condition: each point must not have any other points within a certain distance of itself.
                        This causes the points to push apart from each other until the points are in equilibrium, with the minimum distance constraint being met for each point.
                        This process is known as relaxation, and I first read about it in the <i><a href="http://number-none.com/product/Transmitting%20Vectors/index.html">Transmitting Vectors</a></i> article written by
                        Jonathan Blow for the July 2002 issue of Game Developer Magazine.<br/>
                        You'll notice that as the points approach equilibrium, the immediate neighbours of each point form a hexagonal shaped pattern around it.
                        This is because the most efficient way to pack circles (a point with a minimum distance constraint is effectively a circle) is in a hexagonal lattice.<br/>
                        In addition to the basic relaxation simulation, I added several other features to the simulation to allow you to play around with it.
                    </p>

                    <b>Controls</b>
                    <p>
                        Left click adds an interaction circle that pushes points away from it. The circle can be moved by
                        moving the mouse.<br/>
                        The handle at the bottom right of the window can be used to resize the canvas.<br/>
                        The control panel to the left can be used to modify the parameters of the simulation.<br/>
                        Points that are pushed out of the field along the X or Y axis will wrap around to the far side of the canvas.
                        <ul><li>Min Distance sets the minimum distance that two points must be in order to interact.</li></ul>
                        <ul><li>Speed sets the speed that points push away / pull toward each other.</li></ul>
                        <ul><li>Expand can be toggled on to push points away from each other, and toggled off to pull them toward each other.</li></ul>
                        <ul><li>Circle Radius sets the radius of the interaction circle.</li></ul>
                        <ul><li>Point Count is the number of points in the simulation. Increasing this number while using a small canvas size can cause performance issues. Try it though!</li></ul>
                    </p>
                </p>
            </div>
        );
    }
}