import * as THREE from 'three';



function defaultValue(v, d) {
    return v === undefined ? d : v;
}

class QuadtreeNode {
    children = [];
    objects = [];

    constructor(tree, parent=null, bounds=new THREE.Box2()) {
        this.tree = tree;
        this.parent = parent;
        this.bounds = bounds;
    }

    add(objectData) {
        /*


            Object added inside this node

                if the threshold has been hit split this node into 4 and send all objects down into the children
                if

         */
        let hasChildren = this.children.length > 0;
        const hasObjectSpace = this.objects.length < this.tree.threshold;

        if(this.bounds.containsPoint(objectData.position)) {
            // Object added inside this node
            if(hasObjectSpace) {
                // This node has no children and doesn't contain enough objects to be split, so just add the object here.
                this.children.push(objectData);
                return true; // Successfully added
            }

            if(!hasObjectSpace && !hasChildren) {
                // threshold has been hit, so this node needs to be split
                const centre = this.bounds.getCenter(new THREE.Vector2());
                const min = this.bounds.min;
                const max = this.bounds.max;

                this.children[0] = new QuadtreeNode(this.tree, this,
                    new THREE.Box2(new THREE.Vector2(min.x, centre.y), new THREE.Vector2(centre.x, max.y))
                );

                this.children[1] = new QuadtreeNode(this.tree, this,
                    new THREE.Box2(centre.clone(), max.clone())
                );

                this.children[2] = new QuadtreeNode(this.tree, this,
                    new THREE.Box2(min.clone(), centre.clone())
                );

                this.children[3] = new QuadtreeNode(this.tree, this,
                    new THREE.Box2(new THREE.Vector2(centre.x, min.y), new THREE.Vector2(max.x, centre.y))
                );

                hasChildren = true;
            }

            if(hasChildren) {
                // This node has children, try adding the point to whichever child it belongs in
                for(let i = 0; i < 4; i++) {
                    if(this.children[i].add(objectData)) {
                        return true;
                    }
                }
            }
        }
        else if(this.parent === null) {
            // This is the root node, and an object has been added outside of it, so it needs to expand.
            this.bounds.expandByPoint(objectData.position);
            if(hasChildren) {
                for(let i = 0; i < 4; i++) {
                    this.children[i].rebuild();
                }
            }
        }
        else {
            // Not the root node and the object is outside of it, don't add it.
            return false;
        }
    }

    remove(objectData) {

    }
}

class QuadtreeObjectData {

    position = new THREE.Vector2();
    radius = 0;

    constructor(object) {
        this.object = object;
        this.update();
    }

    update() {
        let needsUpdate = false;

        const object = this.object;
        const position = this.position;
        if(position.x !== object.x || position.y !== object.y) {
            position.set(object.x, object.y);
            needsUpdate = true;
        }

        return needsUpdate;
    }
}

export default class Quadtree {

    objectsUpdated = [];
    objectsData = new WeakMap();
    root = new QuadtreeNode();

    constructor(parameters={}) {
        this.threshold = defaultValue(parameters.threshold, 8);
    }

    add(object) {
        if(this.objectsData.has(object)) {
            return;
        }

        const data = new QuadtreeObjectData(object);
        this.objectsData.set(object, data);
        this.root.add(data);
    }

    flagUpdated(object) {
        this.objectsUpdated.push(object);
    }

    remove(object) {
        if(!this.objectsData.has(object)) {
            return;
        }

        const data = this.objectsData.get(object);
        this.objectsData.delete(object);
        this.root.remove(data);
    }

    update() {
        const updated = this.objectsUpdated;
        for(let i = 0, len = updated.length; i < len; i++) {
            const data = this.objectsData.get(updated[i]);
            if(data.update()) {
                // Update this object in the tree
                this.root.update(data);
            }
        }
        updated.length = 0;
    }

    search(position, radius) {

    }
}