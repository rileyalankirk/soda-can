/* exported load_obj */
function load_obj(url, ondone, onerror) {
	/**
	 * Loads a Wavefront OBJ file asynchronously. The file is loaded from the
	 * relative or absolute url given. Once the model has completely loaded
	 * then the function ondone is called with the verts, texCoords, normals,
	 * inds, and objs. If there is an error loading then onerror is called
	 * (which defaults to just writing an error message in the console).
	 *
	 * For the ondone function, the arguments are as follows:
	 *  - verts: array of vec3s
	 *  - texCoords: either null (if no object has a texture) or array of vec2s
	 *  - normals: array of vec3s
	 *  - inds: array of integers
	 *  - objs: an array of objects
	 *
	 * The objects have 2 properties: name (which could be null) and parts. The
	 * parts is an array of objects that each have the properties:
	 *  - start: the first index from inds to start drawing from
	 *  - count: the number of indices to draw using
	 *  - material: an object that has at least the following properties:
	 *      - Ka: vec3 for the ambient material color
	 *      - Kd: vec3 for the diffuse material color
	 *      - Ks: vec3 for the specular material color
	 *      - d:  number for the alpha/opacity of the material
	 *      - Ns: number for the material shininess coefficent
	 *      See the MTL manual for more information on other properties and
	 *      specifics: http://paulbourke.net/dataformats/mtl/
	 *
	 * Note: several OBJ features are ignored, including groups (g), smoothing (s), parameter
	 * vertices (vp), lines (l), non-triangular faces, or any of the uncommon geometries such as
	 * Taylor or B-splines.
	 */
	onerror = onerror || function () { console.error('Failed to load OBJ file '+url); };
	_load_file(url, function obj_loader() {
		// Variables for dealing with vertices, normals, and texture coordinates
		let vs = [], vns = [], vts = [];
		let verts = [], normals = [], texCoords = [], objs = [];
		let missingNormal = false, hasTexCoord = false;
		let inds = [];
		let map = new Map();
		function get_idx(v, t, n) {
			// Gets the index of a v/t/n or creates a new one if it has never been used before
			let s = v.toString()+';'+(t===null||typeof t==="undefined"?'':t.toString())+';'+(n===null||typeof t==="undefined"?'':n.toString());
			if (!map.has(s)) {
				map.set(s, verts.length);
				verts.push(v);
				texCoords.push(t);
				normals.push(n);
			}
			return map.get(s);
		}

		// Variables for dealing with materials
		let loaded_mtls = 0, mtls = [];
		let cur_mtl = null;
		function finish_materials() {
			// Change material names into material objects
			for (let i = 0; i < objs.length; i++) {
				for (let j = 0; j < objs[i].parts.length; j++) {
					let part = objs[i].parts[j];
					if (part.material === null) {
						// Use default material
						part.material = _def_material();
					} else {
						// Lookup the material name in the material contexts
						let mc = part.material_context, k;
						for (k = mc.length-1; k >= 0 && (mtls[mc[k]] === null || !(part.material in mtls[mc[k]])); k--);
						if (k < 0) {
							console.log('Material '+part.material+' not defined');
							part.material = _def_material();
						} else {
							part.material = mtls[mc[k]][part.material];
						}
					}
					delete part.material_context;
				}
			}

			// We are finished!
			ondone(verts, texCoords, normals, inds, objs);
		}

		// Face types
		let types = [
			/^-?\d+$/,               // v
			/^-?\d+\/-?\d+$/,        // v/t
			/^-?\d+\/\/-?\d+$/,      // v//n
			/^-?\d+\/-?\d+\/-?\d+$/, // v/t/n
		];

		// The object information
		objs.push({ name:null, parts:[{start:0,material:cur_mtl,material_context:[]}], });

		// Go through each line in the file
		let lines = _read_lines(this.responseText);
		for (let i = 0; i < lines.length; i++) {
			if (lines[i] === null) { continue; }
			let cmd = lines[i][0], args = lines[i].slice(1);
			if (cmd === 'mtllib') {
				// mtllib filename filename ...
				for (let j = 0; j < args.length; j++) {
					let mtl = args[j];
					if (mtls.indexOf(mtl) === -1) {
						load_mtl(mtl, function mtl_loaded(mtl_name, materials) {
							mtls[mtl_name] = materials;
							if (++loaded_mtls === mtls.length) { finish_materials(); }
						}, function mtl_error(mtl_name) {
							mtls[mtl_name] = null;
							if (++loaded_mtls === mtls.length) { finish_materials(); }
						});
					}
					mtls.push(mtl);
				}
			} else if (cmd === 'usemtl') {
				// usemtl material_name
				if (args.length !== 1) {
					console.warn('Bad usemtl ('+url+','+(i+1)+')');
				} else {
					let parts = objs[objs.length-1].parts, part = parts[parts.length-1];
					let ni = inds.length;
					if (ni === part.start) { parts.pop(); } else { part.count = ni-part.start; }
					cur_mtl = args[0];
					parts.push({start:ni,material:cur_mtl,material_context:mtls.slice()});
				}
			} else if (cmd === 'o') {
				// o object_name
				if (args.length !== 1) {
					console.warn('Bad object ('+url+','+(i+1)+')');
				} else {
					let parts = objs[objs.length-1].parts, part = parts[parts.length-1];
					let ni = inds.length;
					if (ni === part.start) {
						if (parts.length === 1) { objs.pop(); } else { parts.pop(); }
					} else { part.count = ni-part.start; }
					objs.push({ name:args[0], parts:[{start:ni,material:cur_mtl,material_context:mtls.slice()}], });
				}
			} else if (cmd === 'v') {
				// vertex: v # # # [1]
				if (args.length < 3 || args.length > 4) {
					console.warn('Bad vertex ('+url+','+(i+1)+')');
				} else {
					let x = +args[0], y = +args[1], z = +args[2], w = args.length === 4 ? +args[3] : 1;
					if (isNaN(x) || isNaN(y) || isNaN(z)) { console.warn('Bad vertex values ('+url+','+(i+1)+')'); }
					if (isNaN(w) || Math.abs(w - 1.0) > 1e-8) { console.warn('Ignoring vertex w value '+args[3]+' ('+url+','+(i+1)+')'); }
					vs.push(vec3(x, y, z));
				}
			} else if (cmd === 'vn') {
				// normal: vn # # #
				if (args.length !== 3) {
					console.warn('Bad vertex normal ('+url+','+(i+1)+')');
				} else {
					let x = +args[0], y = +args[1], z = +args[2];
					if (isNaN(x) || isNaN(y) || isNaN(z)) { console.warn('Bad vertex normal values ('+url+','+(i+1)+')'); }
					vns.push(vec3(x, y, z));
				}
			} else if (cmd === 'vt') {
				// normal: vt # # [0]
				if (args.length < 2 || args.length > 3) {
					console.warn('Bad vertex texture coordinate ('+url+','+(i+1)+')');
				} else {
					let u = +args[0], v = +args[1], w = args.length === 3 ? +args[2] : 0;
					if (isNaN(u) || isNaN(v)) { console.warn('Bad vertex texture coordinate ('+url+','+(i+1)+')'); }
					if (isNaN(w) || Math.abs(w) > 1e-8) { console.warn('Ignoring vertex texture coordinate w value '+args[2]+' ('+url+','+(i+1)+')'); }
					vts.push(vec2(u, v));
				}
			} else if (cmd === 'f') {
				// face:
				//f 1 2 3
				//f 3/1 4/2 5/3
				//f 6/4/1 3/5/3 7/6/5
				//f 7//1 8//2 9//3
				if (args.length < 3) {
					console.warn('Bad face ('+url+','+(i+1)+')');
				} else if (args.length > 3) {
					console.warn('Ignoring face with >3 vertices ('+url+','+(i+1)+')');
				} else {
					let t;
					for (t = 0; t < types.length && !types[t].test(args[0]); t++);
					let type = types[t];
					if (typeof type ==="undefined" || !type.test(args[1]) || !type.test(args[2])) {
						console.warn('Bad face values ('+url+','+(i+1)+')');
					} else {
						let hasT = t === 1 || t === 3, hasN = t === 2 || t === 3;
						let a = args[0].split('/'), b = args[1].split('/'), c = args[2].split('/');

						// Convert to numbers and adjust negative values and 1-indexing
						a[0] *= 1; b[0] *= 1; c[0] *= 1;
						if (a[0] < 0) { a[0] += vs.length; } else { a[0] -= 1; }
						if (b[0] < 0) { b[0] += vs.length; } else { b[0] -= 1; }
						if (c[0] < 0) { c[0] += vs.length; } else { c[0] -= 1; }
						if (hasT) {
							a[1] *= 1; b[1] *= 1; c[1] *= 1;
							if (a[1] < 0) { a[1] += vts.length; } else { a[1] -= 1; }
							if (b[1] < 0) { b[1] += vts.length; } else { b[1] -= 1; }
							if (c[1] < 0) { c[1] += vts.length; } else { c[1] -= 1; }
						}
						if (hasN) {
							a[2] *= 1; b[2] *= 1; c[2] *= 1;
							if (a[2] < 0) { a[2] += vns.length; } else { a[2] -= 1; }
							if (b[2] < 0) { b[2] += vns.length; } else { b[2] -= 1; }
							if (c[2] < 0) { c[2] += vns.length; } else { c[2] -= 1; }
						}

						// Check for valid face
						if (a[0] < 0 || a[0] >= vs.length || b[0] < 0 || b[0] >= vs.length || c[0] < 0 || c[0] >= vs.length ||
							hasT && (a[1] < 0 || a[1] >= vts.length || b[1] < 0 || b[1] >= vts.length || c[1] < 0 || c[1] >= vts.length) ||
							hasN && (a[2] < 0 || a[2] >= vns.length || b[2] < 0 || b[2] >= vns.length || c[2] < 0 || c[2] >= vns.length)) {
							console.warn('Bad face values ('+url+','+(i+1)+')');
						} else {
							// Finally, add the vertices
							let v_a = vs[a[0]], v_b = vs[b[0]], v_c = vs[c[0]];
							let vt_a = null, vt_b = null, vt_c = null;
							let vn_a = null, vn_b = null, vn_c = null;
							if (hasT) {
								vt_a = vts[a[1]]; vt_b = vts[b[1]]; vt_c = vts[c[1]];
								hasTexCoord = true;
							}
							if (hasN) {
								vn_a = vns[a[2]]; vn_b = vns[b[2]]; vn_c = vns[c[2]];
							} else { missingNormal = true; }
							inds.push(
								get_idx(v_a, vt_a, vn_a),
								get_idx(v_b, vt_b, vn_b),
								get_idx(v_c, vt_c, vn_c));
						}
					}
				}
			} else {
				console.warn('Unknown or unsupported command '+cmd+' ('+url+','+(i+1)+')');
			}
		}

		// Finish up the last object/part
		let parts = objs[objs.length-1].parts, part = parts[parts.length-1];
		let ni = inds.length;
		if (ni === part.start) {
			if (parts.length === 1) { objs.pop(); } else { parts.pop(); }
		} else { part.count = ni-part.start; }

		// Fill in missing values
		if (missingNormal) {
			let ns = _calc_normals(verts, inds);
			for (let i = 0; i < normals.length; i++) {
				if (normals[i] === null) { normals[i] = ns[i]; }
			}
		}
		if (hasTexCoord) {
			for (let i = 0; i < texCoords.length; i++) {
				if (texCoords[i] === null) { texCoords[i] = vec2(0,0); }
			}
		} else { texCoords = null; }

		// Wait for all materials to finish loading (or there were no materials)
		if (mtls.length === 0) { finish_materials(); }
	}, onerror);
}

function load_mtl(url, ondone, onerror) {
	/**
	 * Loads a Wavefront MTL file asynchronously. The file is loaded from the
	 * relative or absolute url given. Once the model has completely loaded
	 * then the function ondone is called with the given url and an array of
	 * the materials loaded. If there is an error loading then onerror is
	 * called (which default to just writing an error message in the console).
	 * See the MTL manual for details on the properties of the materials.
	 */
	onerror = onerror || function (mtl_name) { console.error('Failed to load MTL file '+mtl_name); };
	_load_file(url, function mtl_loader() {
		let lines = _read_lines(this.responseText);
		let cur_mtl = null;
		let materials = {};

		// Variables for dealing with materials
		let needed_txts = 0, loaded_txts = 0;
		function finish_textures() {
			ondone(url, materials);
		}

		for (let i = 0; i < lines.length; i++) {
			if (lines[i] === null) { continue; }
			let cmd = lines[i][0], args = lines[i].slice(1);
			if (cmd === 'newmtl') {
				if (args.length !== 1) {
					console.warn('Bad newmtl ('+url+','+(i+1)+')');
				} else {
					let mtl = args[0];
					if (mtl in materials) { console.warn('Redefining material '+mtl+' ('+url+','+(i+1)+')'); }
					materials[mtl] = cur_mtl = _def_material();
					cur_mtl.name = mtl;
				}
			} else if (cur_mtl === null) {
				console.warn('Command came before first material ('+url+','+(i+1)+')');
			} else {
				for (let j = 0; j < args.length; j++) {
					if (!isNaN(args[j])) { args[j] = +args[j]; }
				}
				if (cmd === 'map_Ka' || cmd === 'map_Kd' || cmd === 'map_Ks' || cmd === 'map_Ns' ||
					cmd === 'map_d' || cmd === 'disp' || cmd === 'decal' || cmd === 'bump' ||
					cmd === 'map_bump' || cmd === 'refl') {
					let img = new Image();
					img.addEventListener('load', function () {
						if (needed_txts === ++loaded_txts) { finish_textures(); }
					});
					img.addEventListener('error', function () {
						console.log('Error loading texture image ' + this.src);
						if (needed_txts === ++loaded_txts) { finish_textures(); }
					});
					img.src = args[args.length-1];
					args[args.length-1] = img;
					needed_txts++;
				}
				cur_mtl[cmd] = (args.length === 1) ? args[0] : args;
			}
		}

		// Wait for all textures to finish loading (or there were no textures)
		if (needed_txts === 0) { finish_textures(); }
	}, onerror);
}

function _def_material() {
	/**
	 * Gets the default material which is solid white.
	 */
	return {
		Ka: vec3(1, 1, 1),
		Kd: vec3(1, 1, 1),
		Ks: vec3(1, 1, 1),
		d: 1, Ns: 10,
	};
}

function _load_file(name, ondone, onerror) {
	/**
	 * Loads the file with the give name relative to this file. This works when
	 * running locally and remotely. The function ondone is called when the
	 * file is loaded. The function onerror is called if the file fails to
	 * load.
	 */
	let xhr = new XMLHttpRequest();
	xhr.addEventListener('load', ondone);
	xhr.addEventListener('error', onerror);
	xhr.open('GET', name, true);
	xhr.send(null);
}

function _read_lines(txt) {
	/**
	 * Reads lines from an OBJ or MTL file spliting each line. Blank lines and
	 * comments are given as null lines so that the line numbers can still be
	 * kept accurate.
	 */
	let lines = txt.split('\n');
	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();

		// Skip comments and blank lines
		if (line.length === 0 || line[0] === '#') { lines[i] = null; continue; }

		// Split line at spaces, collapsing multiple spaces in a row into a single space
		let parts = line.split(' ');
		line = [];
		for (let j = 0; j < parts.length; j++) {
			if (parts[j].length > 0) { line.push(parts[j]); }
		}

		// Add the line to the new list
		lines[i] = line;
	}
	return lines;
}

function _calc_normals(verts, inds) {
	/**
	 * Calculates the normals for the vertices given an array of vertices and
	 * array of indices to look up into. This version assumes non-strips and
	 * no skips.
	 */
	// Start with all vertex normals as <0,0,0>
	let normals = new Array(verts.length);
	for (let i = 0; i < verts.length; i++) { normals[i] = vec3(0, 0, 0); }

	// Calculate the face normals for each triangle then add them to the vertices
	for (let i = 0; i < inds.length - 2; i+=3) {
		let j = inds[i], k = inds[i+1], l = inds[i+2];
		if (j === k || k === l || l === j) { continue; } // degenerate triangle, skip it
		let a = verts[j], b = verts[k], c = verts[l];
		let face_norm = cross(subtract(b, a), subtract(a, c));
		normals[j] = add(normals[j], face_norm);
		normals[k] = add(normals[k], face_norm);
		normals[l] = add(normals[l], face_norm);
	}

	// Normalize the normals
	for (let i = 0; i < verts.length; i++) { normals[i] = normalize(normals[i]); }
	return normals;
}
