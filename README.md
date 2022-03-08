This project creates a basic soda can that has labelling.
The soda can is a cylinder with two truncated cones at the ends so that it looks fairly like a soda can.
The 1 cylinder and 2 truncated cones are created programmatically using indexed vertices.
The render function does minimal work and culling is also used to increase performance.
The can is highly reflective like a normal aluminum can.
The scene has a light source so the specular-ness of the can can be seen.
The label used is applied as a texture on the cylinder and sides of the top truncated cone but is not applied on the very top or bottom of the can or the bottom truncated cone. These parts are simply a solid shiny silver color.
Provided are the option of 3 different can labels to the user via a drop-down menu.
The textures for these three labels are loaded onto the GPU at the very beginning so that switching is instant.
No loading of images occur after init is finished.