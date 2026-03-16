import * as THREE from 'three';

const FINGER_BONES = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
];

export class HandVisualizer {
    constructor(cameraRef) {
        this.cameraRef = cameraRef;
        this.visualGroup = new THREE.Group();
        this.markerPool = [];
        this.connectionPool = [];

        this.cameraRef.add(this.visualGroup);

        this._createVisualElements();
    }

    _createVisualElements() {
        const maxHandCount = 2;
        const markersPerHand = 21;
        const totalMarkers = markersPerHand * maxHandCount;

        const sphereGeom = new THREE.SphereGeometry(0.015, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true });

        for (let i = 0; i < totalMarkers; i++) {
            const marker = new THREE.Mesh(sphereGeom, sphereMat);
            marker.visible = false;
            marker.renderOrder = 999;
            this.visualGroup.add(marker);
            this.markerPool.push(marker);
        }

        const totalConnections = FINGER_BONES.length * maxHandCount;
        const connectionMat = new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true });
        for (let i = 0; i < totalConnections; i++) {
            const conn = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), connectionMat);
            conn.visible = false;
            conn.renderOrder = 999;
            this.visualGroup.add(conn);
            this.connectionPool.push(conn);
        }
    }

    update(handDataArray) {
        this.hide();
        const handsToRender = Array.isArray(handDataArray[0]) ? handDataArray : [handDataArray];

        const viewDepth = 2;
        const verticalFOV = THREE.MathUtils.degToRad(this.cameraRef.fov);
        const viewHeight = 2 * Math.tan(verticalFOV / 2) * viewDepth;
        const viewWidth = viewHeight * this.cameraRef.aspect;

        handsToRender.forEach((markers, handIdx) => {
            if (handIdx >= 2) return;

            const projectedPoints = markers.map(marker => {
                const xPos = (0.5 - marker.x) * viewWidth;
                const yPos = (0.5 - marker.y) * viewHeight;
                const zPos = -viewDepth;
                return new THREE.Vector3(xPos, yPos, zPos);
            });

            const markerBaseIdx = handIdx * 21;
            const connectionBaseIdx = handIdx * FINGER_BONES.length;

            projectedPoints.forEach((point, idx) => {
                const markerMesh = this.markerPool[markerBaseIdx + idx];
                markerMesh.position.copy(point);
                markerMesh.visible = true;
            });

            FINGER_BONES.forEach((bone, idx) => {
                const connection = this.connectionPool[connectionBaseIdx + idx];
                connection.geometry.setFromPoints([projectedPoints[bone[0]], projectedPoints[bone[1]]]);
                connection.visible = true;
            });
        });
    }

    hide() {
        this.markerPool.forEach(m => m.visible = false);
        this.connectionPool.forEach(c => c.visible = false);
    }
}
