varying float vAmount;
varying vec2 vUv;

uniform sampler2D colorMap;

void main() {
    // vec3 snow_bottom = smoothstep(0.01, 0.75, vAmount) - smoothstep(0.20, 0.21, vAmount) * vec3(0.5, 0.5, 0.5);
    // vec3 snow = smoothstep(0.70, 0.8, vAmount) * vec3(1.0, 1.0, 1.0);
    vec3 white_color = vec3(1.0, 1.0, 1.0);
    vec3 darker_white_color = vec3(0.5, 0.5, 0.5);
    vec3 snow = mix(darker_white_color, white_color, smoothstep(0.01, 0.99, vAmount) * vec3(1.0, 1.0, 1.0));

    gl_FragColor = texture( colorMap, vUv) * vec4(snow, 1.0);
    // gl_FragColor = vec4(snow, 1.0);
}