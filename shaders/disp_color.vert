// attribute vec2 uv - provided by threejs

uniform sampler2D bumpTexture; /* lookup in texture image */
uniform float bumpScale; /* amount of vertex displacement by bumpTexture */

/* Data shared to frag shader to produce gradient effect */
varying float vAmount;
varying vec2 vUv;

void main() {
    float bumpVal = texture2D(bumpTexture, uv).r;

    float edgeFalloff = 0.01;

    float uvFalloffX = smoothstep(0.0, edgeFalloff, uv.x) * smoothstep(1.0, 1.0 - edgeFalloff, uv.x);
    float uvFalloffY = smoothstep(0.0, edgeFalloff, uv.y) * smoothstep(1.0, 1.0 - edgeFalloff, uv.y);
    float edgeFalloffFactor = min(uvFalloffX, uvFalloffY);
    // Compute distance to the nearest corner to add a smooth corner falloff effect
    vec2 uvToCornerDist = min(uv, 1.0 - uv);  // Distance from UV to nearest corner (either 0 or 1)
    float cornerFalloff = smoothstep(0.0, edgeFalloff * 1.9, length(uvToCornerDist));

    // Combine edge and corner falloff for a smoother transition
    float totalFalloff = min(edgeFalloffFactor, cornerFalloff);

    // Create the triangle-esque shape by using a normalized falloff
    vAmount = max(0.001, bumpVal) * totalFalloff;
    vec3 newPosition = position + normal * bumpScale * vAmount;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    vUv = uv;
}