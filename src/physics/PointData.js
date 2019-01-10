export default class PointData {
    x = 0;
    y = 0;
    oldX = 0;
    oldY = 0;

    constructor(object) {
        this.object = object;
        this.x = this.oldX = object.x;
        this.y = this.oldY = object.y;
    }

    updateX() {
        if(this.object.x !== this.x) {
            this.oldX = this.x;
            this.x = this.object.x;
            return true;
        }
        return false;
    }

    updateY() {
        if(this.object.x !== this.y) {
            this.oldY = this.y;
            this.y = this.object.y;
            return true;
        }
        return false;
    }

    update() {
        const x = this.updateX();
        const y = this.updateY();
        return x || y;
    }
}