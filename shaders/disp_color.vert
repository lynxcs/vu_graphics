// attribute vec2 uv - provided by threejs

uniform sampler2D bumpTexture; /* lookup in texture image */
uniform float bumpScale; /* amount of vertex displacement by bumpTexture */

/* Data shared to frag shader to produce gradient effect */
varying float vAmount;

void main() {
    vec4 bumpData = texture2D(bumpTexture, uv);

    vAmount = 0;
    if (position.g > 0.0) {
        vAmount = bumpData.r;
    }

    vec3 newPosition = position + normal * bumpScale * vAmount;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}