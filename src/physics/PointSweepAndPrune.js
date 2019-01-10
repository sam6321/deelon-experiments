import PointData from './PointData.js';

/*
Need a sorted list going along each axis, with entries for each point's X and Y position (along with a point ID).
Each time a point is inserted, add its entry into the X and Y points list a
 */

function binarySearch(array, value, compare) {
    let low = 0;
    let high = array.length - 1;
    let mid;

    if(array.length === 0 || compare(array[low], value) > 0) {
        return ~low; // Goes before every single item
    }

    if(compare(array[high], value) < 0) {
        return ~(high + 1);
    }

    while(low <= high) {
        mid = (low + high) >>> 1;
        const c = compare(array[mid], value);
        if(c < 0) {
            low = mid + 1;
        }
        else if(c > 0) {
            high = mid - 1;
        }
        else {
            return mid;
        }
    }

    return ~low;
}

function sortedInsert(array, value, compare) {
    let index = binarySearch(array, value, compare);
    if(index < 0) {
        index = ~index;
    }
    array.splice(index, 0, value);
}

function sortedRemove(array, value, compare) {
    let index = binarySearch(array, value, compare);
    if(index < 0) {
        return; // Not added
    }

    if(array[index] !== value) {
        // We've got an object with an equivalent value via the compare function, but it isn't
        // the object we're searching for.
        const startIndex = index;
        let found = false;
        while(compare(array[index - 1], value) === 0 && index >= 0) {
            // Search backwards
            index--;
            if(array[index] === value) {
                found = true;
                break; // Found the index
            }
        }

        if(!found) {
            // Didn't find by searching backwards, try searching forwards
            index = startIndex;
            while(compare(array[index + 1], value === 0 && index < array.length)) {
                index++;
                if(array[index] === value) {
                    found = true;
                    break; // Found the index
                }
            }
        }

        if(!found) {
            // In the entire range of equal values, we couldn't find the one we're after
            return;
        }
    }

    array.splice(index, 1); // Remove the value from the array
}

function xSort(a, b) {
    return a.x - b.x;
}

function ySort(a, b) {
    return a.y - b.y;
}

function xRemove(a, b) {
    return a.x - b.oldX;
}

function yRemove(a, b) {
    return a.y - b.oldY;
}

function xSearch(a, b) {
    return a.x - b;
}

function ySearch(a, b) {
    return a.y - b;
}

function searchAxis(axis, position, radius, comparator) {
    let start = binarySearch(axis, position - radius, comparator);
    if(start < 0) {
        start = ~start;
    }
    if(start > axis.length - 1) {
        // No hits along the x axis at all, so there's nothing to be found
        return null;
    }

    let end = binarySearch(axis, position + radius, comparator);
    if(end < 0) {
        end = ~end;
    }

    if(start >= end) {
        return null;
    }

    // Pull out all points between start and end
    return axis.slice(start, end);
}

export default class PointSweepAndPrune {
    xPoints = [];
    yPoints = [];
    objects = new Set();
    objectsDataMap = new WeakMap();
    objectsUpdated = [];

    add(object) {
        if(this.objects.has(object)) {
            return; // Already got it
        }

        this.objects.add(object);
        const data = new PointData(object);
        this.objectsDataMap.set(object, data);

        sortedInsert(this.xPoints, data, xSort);
        sortedInsert(this.yPoints, data, ySort);
    }

    remove(object) {
        if(!this.objects.has(object)) {
            return;
        }

        this.objects.delete(object);
        const data = this.objectsDataMap.get(object);
        this.objectsDataMap.delete(data);

        sortedRemove(this.xPoints, data, xSort);
        sortedRemove(this.yPoints, data, ySort);
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
            if(data.updateX()) {
                sortedRemove(this.xPoints, data, xRemove);
                sortedInsert(this.xPoints, data, xSort);
            }

            if(data.updateY()) {
                sortedRemove(this.yPoints, data, yRemove);
                sortedInsert(this.yPoints, data, ySort);
            }
        }
        updated.length = 0;
    }

    search(position, radius) {
        // Search on X axis first
        const xHits = searchAxis(this.xPoints, position.x, radius, xSearch);
        if(!xHits) {
            return []; // No hits along X, so we don't care about searching Y
        }

        const yHits = searchAxis(this.yPoints, position.y, radius, ySearch);
        if(!yHits) {
            return []; // No hits along Y.
        }
        let biggest, other;
        if(xHits.length > yHits.length) {
            biggest = xHits;
            other = yHits;
        }
        else  {
            biggest = yHits;
            other = xHits;
        }
        // We have hits along both the X and Y axes, so we need to find all elements in both
        // Convert the biggest into a set, then iterate over the smallest
        const doubleHits = [];
        const radiusSq = radius * radius;
        biggest = new Set(biggest);
        for(let i = 0, len = other.length; i < len; i++) {
            const hit = other[i];
            const dx = hit.x - position.x;
            const dy = hit.y - position.y;
            if(biggest.has(hit) && dx * dx + dy * dy <= radiusSq) {
                doubleHits.push(hit);
            }
        }

        return doubleHits;
    }
}