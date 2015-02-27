/* BBox
 *
 * BBox represents a Bounding Box in three dimensional space.
 * It provides an interface for defining a set of coordinates
 * and determining various properties of the contained space
 * (such as intersections with other BBoxes).
 *
 * The BBox is defined by two R3 cartesian vectors
 * at opposing corners of the box.
 *
 * author @ Mark Richardson
 **/

/* BBox
 *
 * Initialize a new BBox. The arguments min and max are
 * not named well.
 *
 * Required:
 *  min: The first defining point. {x, y, z}
 *  max: The second defining point. {x, y, z}
 *
 * Returns: BBox
 */
function Bbox(init) {
	"use strict";
	this.min = new THREE.Vector3(init.min.x, init.min.y, init.min.z);
	this.max = new THREE.Vector3(init.max.x, init.max.y, init.max.z);
}

/* equals
 *
 * Determine if two BBox objects are exactly the same.
 *
 * Required:
 *  [0] o: Another BBox object
 *
 * Returns: boolean
 */
Bbox.prototype.equals = function(o) {
	return (this.min.equals(o.min) && this.max.equals(o.max));
}


/* subSelf
 *
 * Subtracts a three space vector from
 * defining points.
 *
 * Required:
 *   [0] v: A 3R vector
 *
 * Returns: self
 */
Bbox.prototype.subSelf = function(v) {
	this.min.subSelf(v);
	this.max.subSelf(v);

	return this;
}

/* addSelf
 *
 * Translates the current BBox by adding a vector
 * to both defining points.
 *
 * Required:
 *  [0] v: A three space vector
 *
 * Returns: self
 */
Bbox.prototype.addSelf = function(v) {
	this.min.add(v);
	this.max.add(v);

	return this;
}

/* clone
 *
 * Generate a new BBox identical to this one.
 *
 * Required: none
 *
 * Returns: a new BBox
 */
Bbox.prototype.clone = function () {
	return new Bbox(this.min.clone(), this.max.clone());
}

/* getCenter
 *
 * Finds the centroid of the bounding box.
 *
 * Required: none
 *
 * Returns: A THREE vector
 */
Bbox.prototype.getCenter = function () {
	return this.min.clone().add(this.max).divideScalar(2);
}

Bbox.prototype.getPosVertex = function (plane) {
	var pos = this.min.clone();

	if (plane.x >= 0) {
		pos.x = this.max.x;
	}
	if (plane.y >= 0) {
		pos.y = this.max.y;
	}
	if (plane.z >= 0) {
		pos.z = this.max.z;
	}

	return pos;
}

Bbox.prototype.getNegVertex = function (plane) {
	var neg = this.max.clone();

	if (plane.x >= 0) {
		neg.x = this.min.x;
	}
	if (plane.y >= 0) {
		neg.y = this.min.y;
	}
	if (plane.z >= 0) {
		neg.z = this.min.z;
	}

	return neg;
}
