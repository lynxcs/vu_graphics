varying float vAmount;

void main() {
    vec3 snow = smoothstep(0.01, 0.99, vAmount) * vec3(1.0, 1.0, 1.0);

    gl_FragColor = vec4(snow, 1.0);
}