// This is a WebGL example that draws a cube with an image-based texture.

// Global WebGL context variable
let gl;

// Global for the current texture to be rendered
let texture_loc;

// Global for the number of inds
let total_inds;

window.addEventListener('load', function init() {
	// Get the HTML5 canvas object from it's ID
	const canvas = document.getElementById('gl-canvas');

	// Get the WebGL context (save into a global variable)
	gl = WebGLUtils.create3DContext(canvas, {premultipliedAlpha:false});
	if (!gl) {
		window.alert("WebGL isn't available");
		return;
	}

	// Configure WebGL
	onResize();
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	gl.enable(gl.CULL_FACE); // faces turned away from the view will be hidden
	gl.cullFace(gl.BACK);

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition, vNormal;
		attribute vec2 vTexCoord;
		uniform mat4 model_view, projection;
		const vec4 light_src = vec4(0.0, 0.25, -1.0, 0.0);
		varying vec4 pos, N, L, V;
		varying vec2 fTexCoord;
		void main() {
			pos = model_view*vPosition;
			gl_Position = projection*pos;

			N = normalize(model_view*vNormal);
			L = normalize(light_src);

			// NOTE: this assumes viewer is at <0,0,0> in model coordinates
			V = normalize(vec4(0.0, 0.0, 0.0, 1.0)-pos);
			V.z = -V.z;

			fTexCoord = vTexCoord;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision highp float;
		const float ka = 0.2, kd = 1.0, ks = 1.0;
		const float shininess = 20.0;
		varying vec4 N, L, V, pos;

		uniform sampler2D texture;
		varying vec2 fTexCoord;
		void main() {
			vec4 n = normalize(N);
			vec4 l = normalize(L);
			vec4 v = normalize(V);
			float d = max(dot(l, n), 0.0);
			float s = d != 0.0 ? pow(max(dot(n, normalize(l + v)), 0.0), shininess) : 0.0;

			// Get the texture's color
			vec4 color = vec4(0.75, 0.75, 0.75, 1.0);
			if (fTexCoord[1] != 1.0 && fTexCoord[1] != 0.0) {
 				color = texture2D(texture, fTexCoord);
 			}

			// Apply lighting
			gl_FragColor = ka*color + d*kd*color + s*ks*vec4(1.0, 1.0, 1.0, 0.0);
			gl_FragColor.a = 1.0; // force opaque
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Create the soda can model
	let verts = [], inds = [], texCoords = [];

	// n = number of verts for each circle, r1 = radius of cylinder,
	// r2 = radius of top and bottom, h = height, c = center of the soda can
	let n = 64, r1 = 0.54, r2 = 0.44, h = 1.0, c = vec2(0.0, 0.0);

	soda_can(c, r1, r2, n, h, verts, inds);
	total_inds = inds.length;
	let normals = calc_normals(verts, inds, true);

	/**
	 * The length of the adjacent sides to the cones is 2*(r1 - r2)
 	 * The length of the cone sides is the hypotenuse of the triangle formed by
 	 * the adjacent sides with the cone sides
	 */
	let hyp = Math.sqrt(8*(r1 - r2)*(r1 - r2));
	// The ratio of the total height that each cone side takes up of the texture
	let cone = hyp / (2*hyp + h);

	let heights = [0, cone, 1 - cone, 1]
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < n; j++) {
			texCoords.push(vec2(j / n, heights[i]));
		}
	}

	// Load the texture images
	let img1 = new Image();
	let img2 = new Image();
	let img3 = new Image();
	img1.src = 'textures/coca_cola_512.png';
	img2.src = 'textures/yuengling_512.png';
	img3.src = 'textures/canned_cans_512.png';

	let num_loaded = 0;
	function image_loaded() {
		// Load the texture onto the GPU
		if (++num_loaded === 3) {
			load_texture(gl, img1, 0);
			load_texture(gl, img2, 1);
			load_texture(gl, img3, 2);
			render();
		}
	}

	// Add the event listeners for the textures
	img1.addEventListener('load', image_loaded);
	img2.addEventListener('load', image_loaded);
	img3.addEventListener('load', image_loaded);
	document.getElementById('textureImage').addEventListener('change', onChangeTexture);

	// Load the data onto the GPU
	create_vertex_attr_buffer(gl, program, 'vPosition', verts);
	create_vertex_attr_buffer(gl, program, 'vNormal', normals);
	create_vertex_attr_buffer(gl, program, 'vTexCoord', texCoords);
	// Load the indices
	let bufferId = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Load the textures
	texture_loc = gl.getUniformLocation(program, 'texture');
	gl.uniform1i(texture_loc, 0);

	// Setup the standard movement system
	add_standard_handlers(program);

	// Render the scene
	//render();
});

/**
 * Render the scene.
 */
function render() {
	// Clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Render
	gl.drawElements(gl.TRIANGLE_STRIP, total_inds, gl.UNSIGNED_SHORT, 0);

	// Animate
	window.requestAnimationFrame(render);
}




//////////////////////// Standard Movement Handlers ////////////////////////
// You probably don't need to change anything below here

// Uniform locations
let model_view_loc, projection_loc;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 0.4;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;

// Whether to render with perspective or not
const show_perspective = false;

/**
 * Sets up our standard movement handlerrs for the given program.
 */
function add_standard_handlers(program) {
	// Get the uniforms
	model_view_loc = gl.getUniformLocation(program, 'model_view');
	projection_loc = gl.getUniformLocation(program, 'projection');

	// Give the uniforms their initial values
	update_model_view();
	update_projection();

	// Add just the mouse-down handler initially
	gl.canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	gl.canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);
}

/**
 * Updates the model-view transformation based on the global variables.
 */
function update_model_view() {
	let mv = mult(rotateZ(thetas[2]), mult(rotateY(thetas[1]), rotateX(thetas[0])));
	mv = mult(translate(position[0], position[1], position[2]), mv);
	mv = mult(scalem(cur_scale, cur_scale, cur_scale), mv);
	gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
}

/**
 * Updates the projection transformation based on the global variables.
 */
function update_projection() {
	let p, w = gl.canvas.width, h = gl.canvas.height;
	if (show_perspective) {
		p = perspective(45, w/h, 0.01, 10);
		// Need to move the camera away from the origin and flip the z-axis
		p = mult(p, mult(translate(0, 0, -3), scalem(1, 1, -1)));
	} else {
		p = (w > h) ? ortho(-w/h, w/h, -1, 1, 10, -10) : ortho(-1, 1, -h/w, h/w, 10, -10);
	}
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));
}

/**
 * Get the mouse coordinates in object-space as a vec2 from the MouseEvent.
 */
function mouse_coords(evt) {
	let t = evt.currentTarget;
	let x = evt.clientX - t.clientLeft - t.getBoundingClientRect().left + t.scrollLeft;
	let y = evt.clientY - t.clientTop - t.getBoundingClientRect().top + t.scrollTop;
	x = 2*(x/t.width) - 1;
	y = 1 - 2*(y/t.height);
	return vec2(x, y);
}

/**
 * When the mouse is pressed down we record the initial coordinates and start listening for the
 * mouse move and up events.
 */
function onMouseDown(evt) {
	drag_mode = evt.shiftKey ? 'move' : 'rotate';
	initial_coord = mouse_coords(evt);
	initial_thetas = thetas.slice(0);
	initial_pos = position.slice(0);
	this.addEventListener('mousemove', onMouseMove);
	this.addEventListener('mouseup', onMouseUp);
	update_model_view();
}

/**
 * When the mouse is moved (while down) then the rotation is updated and the scene rendered.
 */
function onMouseMove(evt) {
	if (evt.buttons === 0) {
		// mouse button went away when we weren't paying attention
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);
	} else {
		let coord = mouse_coords(evt);
		if (drag_mode === 'rotate') {
			thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
			thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
		} else {
			position[0] = initial_pos[0] + (coord[0] - initial_coord[0]);
			position[1] = initial_pos[1] + (coord[1] - initial_coord[1]);
		}
		update_model_view();
	}
}

/**
 * When the mouse is lifted we update the rotation is updated one final time and we stop listening
 * to the mouse move and up events.
 */
function onMouseUp(evt) {
	let coord = mouse_coords(evt);
	if (drag_mode === 'rotate') {
		thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
		thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
	} else {
		position[0] = initial_pos[0] + (coord[0] - initial_coord[0]);
		position[1] = initial_pos[1] + (coord[1] - initial_coord[1]);
	}
	update_model_view();
	this.removeEventListener('mousemove', onMouseMove);
	this.removeEventListener('mouseup', onMouseUp);
}

/**
 * Make the object smaller/larger on scroll wheel.
 */
function onWheel(evt) {
	// Various equations could be used here, but this is what I chose
	cur_scale *= (1000-evt.deltaY) / 1000;
	update_model_view();
}

/**
 * Make the canvas fit the window
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
	gl.viewport(0, 0, w, h);
	update_projection();
}

/**
 * When a new texture is selected it is rendered
 */
function onChangeTexture() {
	gl.uniform1i(texture_loc, this.value);
}

/**
 * Add the vertices for a circle centered at c with a radius of r and n sides
 * to the array verts.
 */
function circle(c, r, n, verts) {
	let theta = 2*Math.PI/n;
	for (let i = 0; i < n; ++i) {
		let b = vec4(
			c[0]+Math.cos(i*theta)*r, c[2],
			c[1]+Math.sin(i*theta)*r, 1);
		verts.push(b);
	}
}

/**
 * Add the vertices and indices for a hollow cylinder that has no top or bottom.
 * It is centered at c, has a radius of r, n sides and a height of h.
 */
function cylinder(c, r, n, h, verts, inds) {
	let offset = verts.length;
	circle(vec4(c[0], c[1], h), r, n, verts);
	circle(vec4(c[0], c[1], -h), r, n, verts);
	for (let i = 0; i < n; i++) {
		inds.push(i + offset);
		inds.push(i + n + offset);
	}
	// Add repeated inds so the cylinder is completed
	inds.push(offset);
	inds.push(offset + n);
	// Added so that later indices will not be used to
	// create more triangles in the triangle strip
	inds.push(offset + n);
}

/**
 * Add the indices for the angled top/bottom of the soda can.
 * mult_1 and mult_2 allow us to offset by a multiple of num_verts to connect
 * different circles. n tells us how many verts are in each circle.
 * The offset gives us which vertices are used in the truncated cone.
 * to have been used. inds is our array of indices.
 */
function add_truncated_cone(mult_1, mult_2, n, offset, inds) {
	// Added so that previous indices will not be used to
	// create extra triangles in the triangle strip
	inds.push(mult_1*n + offset);

	for (let i = 0; i < n; i++) {
		inds.push(i + mult_1*n + offset);
		inds.push(i + mult_2*n + offset);
	}
	// Add repeated inds so the top is fully connected
	inds.push(mult_1*n + offset);
	inds.push(mult_2*n + offset);

	// Added so that later indices will not be used to
	// create extra triangles in the triangle strip
	inds.push(mult_2*n + offset);
}

/**
 * Add the indices for a circle.
 * n gives us the number of vertices of our circle and it should be even.
 * The offset gives us which vertices are used in the circle.
 * to have been used. inds is our array of indices.
 * reverse will swap the order in which the indices are added. This allows us to
 * get the correct normals for a filled circle that faces the opposite direction.
 */
function add_circle_fill(n, offset, inds, reverse) {
	// Adds the first index of our circle twice so that previous indices
	// will not be used to create extra triangles
	inds.push(offset);
	inds.push(offset);
	if (typeof reverse === 'undefined' || reverse !== true) {
		for(let i = 0; i < n / 2; i++) {
			inds.push(i + 1 + offset);
			inds.push(n - i - 1 + offset);
		}
	} else {
		for(let i = 0; i < n / 2; i++) {
			inds.push(n - i - 1 + offset);
			inds.push(i + 1 + offset);
		}
	}
	// The loop adds the last index twice so that later indices will not be used to
	// create extra triangles
}

/**
 * Add the vertices and indices for a soda can.
 * It is centered at c, has a radius of r1 and n sides.
 * The can has a height of h. The inner circle has a radius of r2.
 */
function soda_can(c, r1, r2, n, h, verts, inds) {
	let offset = verts.length;
	circle(vec4(c[0], c[1], h), r2, n, verts); // top inner circle
	cylinder(c, r1, n, h - 2*(r1 - r2), verts, inds);
	circle(vec4(c[0], c[1], -h), r2, n, verts); // bottom inner circle

	// connect the top and bottom to the cylinder
	add_truncated_cone(0, 1, n, offset, inds); // top
	add_truncated_cone(2, 3, n, offset, inds); // bottom

	// Add the top and bottom
	add_circle_fill(n, offset, inds);
	add_circle_fill(n, offset + 3*n, inds, true);
}
