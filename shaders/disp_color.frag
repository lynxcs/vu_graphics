varying float vAmount;
varying vec2 vUv;

uniform sampler2D colorMap;

void main() {
    vec3 white_color = vec3(1.0, 1.0, 1.0);
    vec3 darker_white_color = vec3(0.5, 0.5, 0.5);
    // vec3 black = vec3(1.0, 0.0, 0.0);
    vec3 black = vec3(0.3, 0.3, 0.3);
    vec3 snow = mix(darker_white_color, white_color, smoothstep(0.01, 0.99, vAmount) * vec3(1.0, 1.0, 1.0));
    vec3 snow2 = mix(black, snow, smoothstep(0.001, 0.01, vAmount) * vec3(1.0, 1.0, 1.0));

    gl_FragColor = texture( colorMap, vUv) * vec4(snow2, 1.0);
}