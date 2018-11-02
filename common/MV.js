//////////////////////////////////////////////////////////////////////////////
//
//  MV.js
//
//////////////////////////////////////////////////////////////////////////////
// By Angel and Shreiner
// Modified by Jeff Bush for style, consistency, and efficiency.

/*eslint no-fallthrough: "off", no-unused-vars: "off" */

//----------------------------------------------------------------------------
//
//  Helper functions
//

function _toArray(arrLike) {
	return Array.prototype.concat.apply([], Array.prototype.slice.apply(arrLike));
}

//----------------------------------------------------------------------------

function radians(degrees) { return degrees * Math.PI / 180; }

//----------------------------------------------------------------------------
//
//  Vector Constructors
//

function vec2() {
	let result = _toArray(arguments);
	switch (result.length) {
	case 0: result.push(0);
	case 1: result.push(0);
	}
	return result.splice(0, 2);
}

function vec3() {
	let result = _toArray(arguments);
	switch (result.length) {
	case 0: result.push(0);
	case 1: result.push(0);
	case 2: result.push(0);
	}
	return result.splice(0, 3);
}

function vec4() {
	let result = _toArray(arguments);
	switch (result.length) {
	case 0: result.push(0);
	case 1: result.push(0);
	case 2: result.push(0);
	case 3: result.push(1);
	}
	return result.splice(0, 4);
}

//----------------------------------------------------------------------------
//
//  Matrix Constructors
//

function mat2() {
	let v = _toArray(arguments), m;
	switch (v.length) {
	case 0:
		v[0] = 1;
	case 1:
		m = [
			[v[0], 0],
			[0, v[0]]
		];
		break;
	default:
		m = [];
		m.push(vec2(v)); v.splice(0, 2);
		m.push(vec2(v));
		break;
	}
	m.matrix = true;
	return m;
}

//----------------------------------------------------------------------------

function mat3() {
	let v = _toArray(arguments), m;
	switch (v.length) {
	case 0:
		v[0] = 1;
	case 1:
		m = [
			[v[0], 0, 0],
			[0, v[0], 0],
			[0, 0, v[0]]
		];
		break;
	default:
		m = [];
		m.push(vec3(v)); v.splice(0, 3);
		m.push(vec3(v)); v.splice(0, 3);
		m.push(vec3(v));
		break;
	}
	m.matrix = true;
	return m;
}

//----------------------------------------------------------------------------

function mat4() {
	let v = _toArray(arguments), m;
	switch (v.length) {
	case 0:
		v[0] = 1;
	case 1:
		m = [
			[v[0], 0, 0, 0],
			[0, v[0], 0, 0],
			[0, 0, v[0], 0],
			[0, 0, 0, v[0]]
		];
		break;
	default:
		m = [];
		m.push(vec4(v)); v.splice(0, 4);
		m.push(vec4(v)); v.splice(0, 4);
		m.push(vec4(v)); v.splice(0, 4);
		m.push(vec4(v));
		break;
	}
	m.matrix = true;
	return m;
}

//----------------------------------------------------------------------------

const sizeof = {
	'vec2' : flatten(vec2()).byteLength,
	'vec3' : flatten(vec3()).byteLength,
	'vec4' : flatten(vec4()).byteLength,
	'mat2' : flatten(mat2()).byteLength,
	'mat3' : flatten(mat3()).byteLength,
	'mat4' : flatten(mat4()).byteLength
};

//----------------------------------------------------------------------------
//
//  Vector and Matrix Functions
//

function equal(u, v) {
	if (u.length !== v.length || u.matrix && !v.matrix || !u.matrix && v.matrix) { return false; }
	if (u.matrix && v.matrix) {
		return u.every((x, i) => x.length === v[i].length && x.every((y, j) => y === v[i][j]));
	} else {
		return u.every((x, i) => x === v[i]);
	}
}

//----------------------------------------------------------------------------

function _binaryOp(u, v, op) {
	if (u.length !== v.length) { throw "different dimensions"; }
	if (u.matrix && v.matrix) {
		if (u.some((x, i) => x.length !== v[i].length)) { throw "different dimensions"; }
		let result = u.map((x, i) => x.map((y, j) => op(y, v[i][j])));
		result.matrix = true;
		return result;
	} else if (!u.matrix && !v.matrix) {
		return u.map((x, i) => op(x, v[i]));
	} else {
		throw "matrix/vector mismatch";
	}
}

function add(u, v) { return _binaryOp(u, v, (a, b) => a + b); }
function subtract(u, v) { return _binaryOp(u, v, (a, b) => a - b); }
function mult(u, v) {
	if (u.length !== v.length) { throw "different dimensions"; }
	if (u.matrix) {
		if (v.matrix) {
			// matrix multiplication (assumes square matrices)
			let len = u.length;
			if (u.some((x) => x.length !== len) || v.some((x) => x.length !== len)) { throw "different dimensions"; }
			let result = [];
			for (let i = 0; i < len; ++i) {
				let row = [];
				for (let j = 0; j < len; ++j) {
					row.push(u[i].reduce((sum, x, k) => sum + x * v[k][j], 0));
				}
				result.push(row);
			}
			result.matrix = true;
			return result;
		} else {
			// matrix-vector multiplication
			if (u.some((x) => x.length !== u.length)) { throw "different dimensions"; }
			return u.map((x) => x.reduce((sum, y, j) => sum + y * v[j], 0));
		}
	}
	return _binaryOp(u, v, (a, b) => a * b);
}

//----------------------------------------------------------------------------

function scale(s, u) {
	if (!Array.isArray(u)) { throw "scale(): second parameter is not a vector or matrix"; }
	if (u.matrix) {
		let result = u.map((x) => x.map((y) => s*y));
		result.matrix = true;
		return result;
	} else { return u.map((x) => s*x); }
}
function negate(u) {
	if (u.matrix) {
		let result = u.map((x) => x.map((y) => -y));
		result.matrix = true;
		return result;
	} else { return u.map((x) => -x); }
}

//----------------------------------------------------------------------------
//
//  Matrix Functions
//

function transpose(m) {
	let result = m.map((x, i) => x.map((y, j) => m[j][i]));
	result.matrix = true;
	return result;
}

function printm(m) {
	for (let i = 0; i < m.length; i++) { console.log.apply(m[i]); }
}

function det2(m) { return m[0][0]*m[1][1]-m[0][1]*m[1][0]; }
function det3(m) {
	return m[0][0]*m[1][1]*m[2][2] + m[0][1]*m[1][2]*m[2][0] + m[0][2]*m[2][1]*m[1][0]
		- m[2][0]*m[1][1]*m[0][2] - m[1][0]*m[0][1]*m[2][2] - m[0][0]*m[1][2]*m[2][1];
}

function det4(m) {
	let m0 = [
		[m[1][1], m[1][2], m[1][3]],
		[m[2][1], m[2][2], m[2][3]],
		[m[3][1], m[3][2], m[3][3]]
	];
	let m1 = [
		[m[1][0], m[1][2], m[1][3]],
		[m[2][0], m[2][2], m[2][3]],
		[m[3][0], m[3][2], m[3][3]]
	];
	let m2 = [
		[m[1][0], m[1][1], m[1][3]],
		[m[2][0], m[2][1], m[2][3]],
		[m[3][0], m[3][1], m[3][3]]
	];
	let m3 = [
		[m[1][0], m[1][1], m[1][2]],
		[m[2][0], m[2][1], m[2][2]],
		[m[3][0], m[3][1], m[3][2]]
	];
	return m[0][0]*det3(m0) - m[0][1]*det3(m1)
		+ m[0][2]*det3(m2) - m[0][3]*det3(m3);
}

function det(m) {
	if (!m.matrix) { throw "not a matrix"; }
	if (m.length === 2) { return det2(m); }
	if (m.length === 3) { return det3(m); }
	if (m.length === 4) { return det4(m); }
	throw "bad dimension of matrix";
}

//----------------------------------------------------------------------------
//
//  Vector Functions
//

function length(u) { return Math.sqrt(u.reduce((sum, x) => sum + x*x, 0)); }

function dot(u, v) {
	if (u.length !== v.length) { throw "vectors are not the same dimension"; }
	return u.reduce((sum, x, i) => sum + x*v[i], 0);
}

function cross(u, v) {
	if (!Array.isArray(u) || u.length !== 3 && (u.length !== 4 || u[3] !== 0)) { throw "cross(): first argument is not a vector of exactly 3"; }
	if (!Array.isArray(v) || v.length !== 3 && (v.length !== 4 || v[3] !== 0)) { throw "cross(): second argument is not a vector of exactly 3"; }
	if (u.length !== v.length) { throw "arguments must be the same length"; }
	let a = u[1]*v[2] - u[2]*v[1], b = u[2]*v[0] - u[0]*v[2], c = u[0]*v[1] - u[1]*v[0]
	return (u.length === 4 ? vec4 : vec3)(a, b, c, 0);
}

function normalize(u, excludeLastComponent) {
	// TODO: is this supposed to modify in-place?
	let last;
	if (excludeLastComponent) { last = u.pop(); }
	let len = length(u);
	if (!isFinite(len)) { throw "normalize(): vector has zero length"; }
	for (let i = 0; i < u.length; ++i) { u[i] /= len; }
	if (excludeLastComponent) { u.push(last); }
	return u;
}

function mix(u, v, s) {
	if (u.length !== v.length) { throw "vector dimension mismatch"; }
	return u.map((x, i) => (1-s)*x+s*v[i]);
}

//----------------------------------------------------------------------------
//
// Vector and Matrix functions
//

function flatten(v) {
	if (v.matrix) {
		v = transpose(v);
	}

	let n = v.length;
	let elemsAreArrays = false;

	if (Array.isArray(v[0])) {
		elemsAreArrays = true;
		n *= v[0].length;
	}

	let floats = new Float32Array(n);

	if (elemsAreArrays) {
		let idx = 0;
		for (let i = 0; i < v.length; ++i) {
			for (let j = 0; j < v[i].length; ++j) {
				floats[idx++] = v[i][j];
			}
		}
	} else {
		for (let i = 0; i < v.length; ++i) {
			floats[i] = v[i];
		}
	}

	return floats;
}

//----------------------------------------------------------------------------
//
//  Basic Transformation Matrix Generators
//

function translate(x, y, z) {
	if (Array.isArray(x) && x.length === 3) { y = x[1]; z = x[2]; x = x[0]; }
	let result = mat4();
	result[0][3] = x;
	result[1][3] = y;
	result[2][3] = z;
	return result;
}

//----------------------------------------------------------------------------

function rotate(angle, axis) {
	if (!Array.isArray(axis)) { axis = [ arguments[1], arguments[2], arguments[3] ]; }
	let [x, y, z] = normalize(axis);
	let s = Math.sin(radians(angle));
	let c = Math.cos(radians(angle)), omc = 1 - c;
	return mat4(
		x*x*omc + c,   x*y*omc - z*s, x*z*omc + y*s, 0,
		x*y*omc + z*s, y*y*omc + c,   y*z*omc - x*s, 0,
		x*z*omc - y*s, y*z*omc + x*s, z*z*omc + c,   0,
		0, 0, 0, 1);
}

function rotateX(theta) {
	let c = Math.cos(radians(theta));
	let s = Math.sin(radians(theta));
	return mat4(
		1, 0,  0, 0,
		0, c, -s, 0,
		0, s,  c, 0,
		0, 0,  0, 1);
}
function rotateY(theta) {
	let c = Math.cos(radians(theta));
	let s = Math.sin(radians(theta));
	return mat4(
		c, 0, s, 0,
		0, 1, 0, 0,
		-s,0, c, 0,
		0, 0, 0, 1);
}
function rotateZ(theta) {
	let c = Math.cos(radians(theta));
	let s = Math.sin(radians(theta));
	return mat4(
		c, -s, 0, 0,
		s,  c, 0, 0,
		0,  0, 1, 0,
		0,  0, 0, 1);
}


//----------------------------------------------------------------------------

function scalem(x, y, z) {
	if (Array.isArray(x) && x.length === 3) { y = x[1]; z = x[2]; x = x[0]; }
	let result = mat4();
	result[0][0] = x;
	result[1][1] = y;
	result[2][2] = z;
	return result;
}

//----------------------------------------------------------------------------
//
//  ModelView Matrix Generators
//

function lookAt(eye, at, up) {
	if (!Array.isArray(eye) || eye.length !== 3) {
		throw "lookAt(): eye must be an a vec3";
	}
	if (!Array.isArray(at) || at.length !== 3) {
		throw "lookAt(): at must be an a vec3";
	}
	if (!Array.isArray(up) || up.length !== 3) {
		throw "lookAt(): up must be an a vec3";
	}

	if (equal(eye, at)) { return mat4(); }

	let v = normalize(subtract(at, eye));  // view direction vector
	let n = normalize(cross(v, up));	   // perpendicular vector
	let u = normalize(cross(n, v));		   // "new" up vector
	v = negate(v);
	return mat4(
		vec4(n, -dot(n, eye)),
		vec4(u, -dot(u, eye)),
		vec4(v, -dot(v, eye)),
		vec4()
	);
}

//----------------------------------------------------------------------------
//
//  Projection Matrix Generators
//

function ortho(left, right, bottom, top, near, far) {
	if (left === right) { throw "ortho(): left and right are equal"; }
	if (bottom === top) { throw "ortho(): bottom and top are equal"; }
	if (near === far)   { throw "ortho(): near and far are equal"; }
	let w = right - left, h = top - bottom, d = far - near;
	return mat4(
		2/w, 0,   0,    -(left + right) / w,
		0,   2/h, 0,    -(top + bottom) / h,
		0,   0,   -2/d, -(near + far) / d,
		0,   0,   0,    1);
}

//----------------------------------------------------------------------------

function perspective(fovy, aspect, near, far) {
	let d = far - near;
	let f = 1 / Math.tan(radians(fovy) / 2);
	return mat4(
		f/aspect, 0,  0,  0,
		0,        f,  0,  0,
		0,        0,  -(near+far)/d, -2*near*far/d,
		0,        0, -1,  0);
}
