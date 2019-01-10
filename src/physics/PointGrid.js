import PointData from "./PointData";

function hash(x, y) {
    return x * 73856093 ^ y * 83492791;
}

class PointGridData extends PointData {

    insertedKey = null;

    getCellKey(cellSize) {
        const x = Math.floor(this.x / cellSize);
        const y = Math.floor(this.y / cellSize);
        return hash(x, y);
    }
}

export default class PointGrid {

    objects = new Set();
    objectsDataMap = new WeakMap();
    objectsUpdated = [];

    cellMap = new Map(); // key = cell id, value = objects in cell

    constructor(cellSize) {
        this.cellSize = cellSize;
    }

    add(object) {
        if(this.objects.has(object)) {
            return; // Already got it
        }

        this.objects.add(object);
        const data = new PointGridData(object);
        this.objectsDataMap.set(object, data);

        this._insert(data);
    }

    remove(object) {
        if(!this.objects.has(object)) {
            return;
        }

        this.objects.delete(object);
        const data = this.objectsDataMap.get(object);
        this.objectsDataMap.delete(data);

        this._remove(data);
    }

    flagUpdated(object) {
        const data = this.objectsDataMap.get(object);
        if(data) {
            this.objectsUpdated.push(data);
        }
    }

    update() {
        const updated = this.objectsUpdated;
        for(let i = 0, len = updated.length; i < len; i++) {
            const data = updated[i];

            if(data.insertedKey === null) {
                // needs to be inserted
                this._insert(data);
                continue;
            }

            if(data.update()) {
                const key = data.getCellKey(this.cellSize);
                if(key !== data.insertedKey) {
                    this._remove(data);
                    this._insert(data);
                }
            }
        }
        updated.length = 0;
    }

    search(position, radius) {
        // Need to work out all cell IDs we need to check for this search
        // Safest option is to search all cells in an aabb around the centre position.
        // This will have some false positives as we're trying to do a circle check
        const lowX = Math.floor((position.x - radius) / this.cellSize);
        const highX = Math.floor((position.x + radius) / this.cellSize);
        const lowY = Math.floor((position.y - radius) / this.cellSize);
        const highY = Math.floor((position.y + radius) / this.cellSize);
        const radiusSq = radius * radius;
        const hits = [];
        /*if(highX < lowX || highY < lowY) {
            debugger;
        }*/
        for(let x = lowX; x <= highX; x++) {
            for(let y = lowY; y <= highY; y++) {
                const id = hash(x, y);
                const contents = this.cellMap.get(id);
                if(contents && contents.length) {
                    for(let i = 0, len = contents.length; i < len; i++) {
                        const data = contents[i];
                        const dx = data.x - position.x;
                        const dy = data.y - position.y;
                        if(dx * dx + dy * dy <= radiusSq) {
                            hits.push(data);
                        }
                    }
                }
            }
        }
        return hits;
    }

    _insert(pointData) {
        const id = pointData.getCellKey(this.cellSize);
        const contents = this.cellMap.get(id);
        pointData.insertedKey = id;
        if(!contents) {
            this.cellMap.set(id, [pointData]);
        }
        else {
            contents.push(pointData);
        }
    }

    _remove(pointData) {
        if(pointData.insertedKey === null) {
            return; // Not inserted
        }
        const contents = this.cellMap.get(pointData.insertedKey);
        if(!contents) {
            return;
        }
        const index = contents.indexOf(pointData);
        if(index !== -1) {
            contents.splice(index, 1);
        }
    }
}