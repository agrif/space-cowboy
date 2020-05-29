'use strict';

// lots of useful distributions!
class Random {
    constructor(fn) {
        this.generate = fn
    }

    static unit() {
        return new Random(() => Math.random())
    }

    static uniform(a, b) {
        var size = b - a;
        return new Random(() => Math.random() * size + a);
    }

    static normalPairs(mean, stddev) {
        return new Random(() => {
            var r = Math.sqrt(-2 * Math.log(Math.random()));
            var t = 2 * Math.PI * Math.random();
            var x = r * Math.cos(t) * stddev + mean;
            var y = r * Math.sin(t) * stddev + mean;
            return [x, y];
        });
    }

    static normal(mean, stddev) {
        return Random.normalPairs(mean, stddev).map(pt => pt[0]);
    }

    static exponential(beta) {
        // beta = expectation value = time between events
        // beta = 1 / lambda
        return new Random(() => Math.log(Math.random()) * -beta);
    }

    static poisson(lambda) {
        // lambda = expectation value = event rate per unit time
        // lambda = 1 / beta
        var L = Math.exp(-lambda);
        // via Knuth
        return new Random(() => {
            var k = 0;
            var p = 1;
            do {
                k = k + 1;
                p = p * Math.random();
            } while (p > L);
            return k - 1;
        });
    }

    static discPolar(radius) {
        return new Random(() => {
            var r = Math.sqrt(Math.random()) * radius;
            var theta = 2 * Math.PI * Math.random();
            return [r, theta];
        });
    }

    static disc(radius) {
        return Random.discPolar(radius).map(p => [p[0] * Math.cos(p[1]), p[0] * Math.sin(p[1])]);
    }

    static spherePolar() {
        return new Random(() => {
            var theta = 2.0 * Math.PI * Math.random();
            var phi = Math.asin(1 - 2.0 * Math.random());
            return [theta, phi];
        });
    }

    static sphere(radius) {
        if (!radius)
            radius = 1.0;
        return Random.spherePolar().map(p => {
            var c = Math.cos(p[1]);
            var x = c * Math.cos(p[0]);
            var y = c * Math.sin(p[0]);
            var z = Math.sin(p[1]);
            return [x, y, z];
        });
    }

    static traverse(rngs) {
        return new Random(() => {
            var x = new Array(rngs.length);
            for (var i = 0; i < rngs.length; i++) {
                x[i] = rngs[i].generate();
            }
            return x;
        });
    }

    map(f) {
        return new Random(() => f(this.generate()))
    }
}

// color conversion
function hsvToRgb(h, s, v) {
    var r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
    }
    return [r, g, b];
}

// https://stackoverflow.com/a/41451654
function bvToRgb(bv) {
    if (bv < -0.40)
        bv = -0.40;
    if (bv > 2.00)
        bv = 2.00;

    var r = 0.0;
    var g = 0.0;
    var b = 0.0;

    if (-0.40 <= bv < 0.00) {
        var t = (bv + 0.40) / (0.00 + 0.40);
        r= 0.61 + (0.11 * t) + (0.1 * t * t);
    } else if (0.00 <= bv < 0.40) {
        var t = (bv - 0.00) / (0.40 - 0.00);
        r = 0.83 + (0.17 * t);
    } else if (0.40 <= bv < 2.10) {
        var t = (bv - 0.40) / (2.10 - 0.40);
        r = 1.00;
    }
    if (-0.40 <= bv < 0.00) {
        var t = (bv + 0.40) / (0.00 + 0.40);
        g = 0.70 + (0.07 * t) + (0.1 * t * t);
    } else if (0.00 <= bv < 0.40) {
        var t = (bv - 0.00) / (0.40 - 0.00);
        g = 0.87 + (0.11 * t);
    } else if (0.40 <= bv < 1.60) {
        var t = (bv - 0.40) / (1.60 - 0.40);
        g = 0.98 - (0.16 * t);
    } else if (1.60 <= bv < 2.00) {
        var t = (bv - 1.60) / (2.00 - 1.60);
        g = 0.82 - (0.5 * t * t);
    }
    if (-0.40 <= bv < 0.40) {
        var t = (bv + 0.40) / (0.40 + 0.40);
        b = 1.00;
    } else if (0.40 <= bv < 1.50) {
        var t = (bv - 0.40) / (1.50 - 0.40);
        b = 1.00 - (0.47 * t) + (0.1 * t * t);
    } else if (1.50 <= bv < 1.94) {
        var t = (bv - 1.50) / (1.94 - 1.50);
        b = 0.63 - (0.6 * t * t);
    }

    return [r, g, b];
}

// matrices
class Matrix {
    constructor(data) {
        // column-major, just like opengl likes
        if (!data)
            data = Matrix.identity().data;
        if (data.length != 16)
            throw "bad matrix data";
        this.data = data;
    }

    get(r, c) {
        return this.data[4 * c + r];
    }

    dot(other) {
        if (other.length && other.length == 4) {
            var result = [0, 0, 0, 0];
            for (var r = 0; r < 4; r++) {
                for (var i = 0; i < 4; i++) {
                    result[r] += this.data[4 * i + r] * other[i];
                }
            }
            return result;
        }

        var result = new Array(16);
        for (var r = 0; r < 4; r++) {
            for (var c = 0; c < 4; c++) {
                result[4 * c + r] = 0.0;
                for (var i = 0; i < 4; i++) {
                    result[4 * c + r] +=
                        this.data[4 * i + r] * other.data[4 * c + i];
                }
            }
        }
        return new Matrix(result);
    }

    transpose() {
        var d = this.data;
        return new Matrix([
            d[0], d[4], d[8], d[12],
            d[1], d[5], d[9], d[13],
            d[2], d[6], d[10], d[14],
            d[3], d[7], d[11], d[15],
        ]);
    }

    static identity() {
        return new Matrix([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);
    }

    translate(x, y, z) {
        return new Matrix([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1,
        ]).dot(this);
    }

    scale(x, y, z) {
        if (!y)
            y = x;
        if (!z)
            z = x;
        return new Matrix([
            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1,
        ]).dot(this);
    }

    rotate(x, y, z, theta) {
        var mag = Math.sqrt(x * x + y * y + z * z);
        x /= mag;
        y /= mag;
        z /= mag;
        if (!theta)
            theta = mag;
        var sin = Math.sin(theta);
        var cos = Math.cos(theta)
        var icos = 1.0 - cos;
        return new Matrix([
            cos + x * x * icos, x * y * icos - z * sin, x * z * icos + y * sin, 0,
            y * x * icos + z * sin, cos + y * y * icos, y * z * icos - x * sin, 0,
            z * x * icos - y * sin, z * y * icos + x * sin, cos + z * z * icos, 0,
            0, 0, 0, 1,
        ]).dot(this);
    }

    perspectiveV(width, height, near, far) {
        return new Matrix([
            2 * near / width, 0, 0, 0,
            0, 2 * near / height, 0, 0,
            0, 0, -(far + near) / (far - near), -1,
            0, 0, -2 * far * near / (far - near), 0,
        ]).dot(this);
    }

    perspective(aspect, fov, near, far) {
        var diag = 2.0 * near * Math.tan(fov / 2.0);
        var diagf = Math.sqrt(1.0 + aspect * aspect);
        var width = diag * aspect / diagf;
        var height = diag / diagf;
        return this.perspectiveV(width, height, near, far);
    }
}

// helper for making shaders
class Shader {
    constructor(ctx, vertlines, fraglines, transformRecord) {
        var sources = [
            [ctx.VERTEX_SHADER, vertlines.join("\n")],
            [ctx.FRAGMENT_SHADER, fraglines.join("\n")]
        ];
        var shaders = [];
        for (var i = 0; i < sources.length; i++) {
            var s = ctx.createShader(sources[i][0]);
            ctx.shaderSource(s, sources[i][1]);
            ctx.compileShader(s);
            var msg = ctx.getShaderInfoLog(s);
            if (msg.length > 0)
                console.log(msg);
            if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS))
                throw "failed to compile shader";
            shaders.push(s);
        }

        this.program = ctx.createProgram();
        for (var i = 0; i < shaders.length; i++) {
            ctx.attachShader(this.program, shaders[i]);
        }
        if (transformRecord) {
            ctx.transformFeedbackVaryings(this.program, transformRecord,
                                          ctx.SEPARATE_ATTRIBS);
        }
        ctx.linkProgram(this.program);
        var msg = ctx.getProgramInfoLog(this.program);
        if (msg.length > 0)
            console.log(msg);
        if (!ctx.getProgramParameter(this.program, ctx.LINK_STATUS))
            throw "failed to link shader";

        this.uniforms = {}
        this.attributes = {}
        var nu = ctx.getProgramParameter(this.program, ctx.ACTIVE_UNIFORMS);
        var na = ctx.getProgramParameter(this.program, ctx.ACTIVE_ATTRIBUTES);
        for (var i = 0; i < nu; i++) {
            var info = ctx.getActiveUniform(this.program, i);
            info.location = ctx.getUniformLocation(this.program, info.name);
            this.uniforms[info.name] = info;
            if (!this[info.name])
                this[info.name] = info.location;
        }
        for (var i = 0; i < na; i++) {
            var info = ctx.getActiveAttrib(this.program, i);
            info.location = ctx.getAttribLocation(this.program, info.name);
            this.attributes[info.name] = info;
            if (!this[info.name])
                this[info.name] = info.location;
        }
    }

    use(ctx) {
        ctx.useProgram(this.program);
    }
}

class View {
    constructor(root) {
        this.root = root;
        this.container = root.container;
        this.properties = {};
    }
    updateSizes(width, height) {
        this.width = width;
        this.height = height;
    }
    updateContext(ctx) {
        this.ctx = ctx;
    }
    start() {}
    stop() {}
    draw(ctx, t, dt) {}
}

class ElementView extends View {
    constructor(root, name) {
        super(root);
        this.el = document.createElement(name);
        root.container.appendChild(this.el);
    }
}

class Canvas extends ElementView {
    constructor(root) {
        super(root, 'canvas');

        this.el.style.zIndex = -1;
        this.el.style.position = 'absolute';
        this.el.style.left = '0px';
        this.el.style.top = '0px';
    }

    updateSizes(width, height) {
        super.updateSizes(width, height);

        this.el.width = this.width;
        this.el.height = this.height;
        this.ctx = this.el.getContext('webgl2');
        this.ctx.viewport(0, 0, this.width, this.height);
    }

    updateContext(ctx) {
        super.updateContext(ctx);

        ctx.enable(ctx.BLEND);
        ctx.clearColor(0.0, 0.0, 0.0, 0.0);
    }

    draw(ctx, t, dt) {
        ctx.clear(ctx.COLOR_BUFFER_BIT);
    }
}

class Light extends View {
    constructor(root) {
        super(root);

        this.background = [0.0, 0.0, 0.0];
        this.light = [1.0, 1.0, 1.0];
        this.quant = 255.0;

        this.properties['background'] = v => {
            this.background = v;
            this.updateUniforms();
        };
        this.properties['light'] = v => {
            this.light = v;
            this.updateUniforms();
        };
        this.properties['quant'] = v => {
            this.quant = v;
            this.updateUniforms();
        };
    }

    updateContext(ctx) {
        super.updateContext(ctx);

        this.quad = ctx.createVertexArray();
        ctx.bindVertexArray(this.quad);

        var quadv = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, quadv);
        ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
            1.0, 1.0,
            1.0, -1.0,
            -1.0, -1.0,
            -1.0, 1.0
        ]), ctx.STATIC_DRAW);

        this.shader = new Shader(ctx, [
            'attribute vec2 pos;',
            'varying float f;',
            'uniform mat4 viewMatrix;',
            'void main(void) {',
            '  gl_Position = viewMatrix * vec4(pos, 0.0, 1.0);',
            '  f = (pos.y + 1.0) * 0.5;',
            '}'
        ], [
            'precision mediump float;',
            'varying float f;',
            'uniform vec3 background;',
            'uniform vec3 light;',
            'uniform float t;',
            'uniform float quanti;',
            'float rand(vec2 n) {',
            '  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);',
            '}',
            'vec4 rand4(vec2 n) {',
            '  return vec4(',
            '    rand(n + 0.00),',
            '    rand(n + 0.08),',
            '    rand(n + 0.13),',
            '    rand(n + 0.21)',
            '  );',
            '}',
            'vec4 dither(vec2 n, vec4 c, float q) {',
            '  float ti = fract(t);',
            '  vec4 r = rand4(n + ti) + rand4(n + 0.22 + ti) - 1.0;',
            '  return c + r / q;',
            '}',
            'vec4 quant(vec4 c, float q) {',
            '  vec4 scaled = dither(gl_FragCoord.xy, c, q) * q + vec4(0.5);',
            '  vec4 i = floor(scaled);',
            '  return i / q;',
            '}',
            'void main(void) {',
            '  vec3 c = background * f + light * (1.0 - f);',
            '  gl_FragColor = quant(vec4(c, 1.0), quanti);',
            '}'
        ]);

        ctx.vertexAttribPointer(this.shader.pos, 2, ctx.FLOAT, false, 0, 0);
        ctx.enableVertexAttribArray(this.shader.pos);
        ctx.bindVertexArray(null);

        this.updateUniforms();
    }

    updateUniforms() {
        if (this.shader) {
            this.shader.use(this.ctx);
            this.ctx.uniform3fv(this.shader.background, this.background);
            this.ctx.uniform3fv(this.shader.light, this.light);
            this.ctx.uniform1f(this.shader.quanti, this.quant);
            this.ctx.uniformMatrix4fv(this.shader.viewMatrix, false,
                                      this.root.viewMatrices.normalized.data);
        }
    }

    draw(ctx, t, dt) {
        // draw light gradient
        ctx.bindVertexArray(this.quad);
        this.shader.use(ctx);
        this.ctx.uniform1f(this.shader.t, t);
        ctx.blendFunc(ctx.ONE, ctx.ONE);
        ctx.drawArrays(ctx.TRIANGLE_FAN, 0, 4);
    }
}

class Starfield extends View {
    constructor(root) {
        super(root);

        this.generateStars = false;
        this.starDistance = 20;
        this.maxStars = 20000 * 100;
        this.maxStarRadius = 5;
        this.minStarRadius = 2;
        this.referenceMag = 2.0;
        this.magnitudes = Random.exponential(1.2).map(v => 6.0 - v);
        this.colors = Random.normal(0.8, 0.4);
        this.shimmerAmount = Random.unit();
        this.shimmerRate = 10.0; // units of 1/s, leak rate

        this.galaxyAngle = 63 * Math.PI / 180;
        this.galaxySin = Math.sin(this.galaxyAngle);
        this.galaxyCos = Math.cos(this.galaxyAngle);
        this.galaxyT = Random.normal(0, Math.PI / 6);
        this.galaxyP = Random.normal(-0.1, 0.1);
        this.galaxyProportion = 0.3;
        
        this.shimmerNoise = Random.uniform(-1, 1);

        this.stars = [];
        this.used = 0;
        this.buffer = null;
        this.shimmerBufferIn = null;
        this.shimmerBufferOut = null;
        this.bufferLength = 0;
        this.array = null;
        this.transform = null;
    }

    addStars(stars) {
        for (var i = 0; i < stars.length; i++)
            this.addStar(stars[i]);
        if (this.width)
            this.updateSizes(this.width, this.height);
    }

    addStar(star) {
        var brightness = Math.pow(2.512, this.referenceMag - star.mag);
        if (brightness > 1.0)
            brightness = 1.0;
        var radius = Math.sqrt(brightness) * this.maxStarRadius;
        var factor = 1.0;
        if (radius < this.minStarRadius) {
            factor = radius / this.minStarRadius;
            radius = this.minStarRadius;
        }
        var c = bvToRgb(star.color);
        this.stars.push({
            x: star.x,
            y: star.y,
            z: star.z,
            size: radius,
            color: [factor * c[0], factor * c[1], factor * c[2]],
            shimmerAmount: this.shimmerAmount.generate(),
        });
    }

    updateSizes(width, height) {
        super.updateSizes(width, height);
        this.diagonal = Math.sqrt(width * width + height * height);

        // figure out how many stars we need to get this distance
        var numStars = width * height / Math.pow(this.starDistance, 2);
        numStars *= 4.0 * Math.PI / this.root.viewMatrices.fov;
        numStars /= (1.0 - this.galaxyProportion);
        if (numStars > this.maxStars)
            numStars = this.maxStars;

        // make new stars
        var sphere = Random.sphere();
        while (this.generateStars && this.stars.length < numStars) {
            var pt;
            if (Math.random() < this.galaxyProportion) {
                // oh no it's a galaxy instead
                var theta = this.galaxyT.generate();
                var phi = this.galaxyP.generate();
                var xp = Math.cos(phi) * Math.cos(theta);
                var y = Math.cos(phi) * Math.sin(theta);
                var zp = Math.sin(phi);
                var x = xp * this.galaxyCos - zp * this.galaxySin;
                var z = xp * this.galaxySin + zp * this.galaxyCos;
                pt = [x, y, z];
            } else {
                pt = sphere.generate();
            }
            this.addStar({
                x: pt[0],
                y: pt[1],
                z: pt[2],
                mag: this.magnitudes.generate(),
                color: this.colors.generate(),
            });
        }

        this.used = Math.min(numStars, this.stars.length);
        this.updateArrays();
        this.updateUniforms();
    }

    updateContext(ctx) {
        super.updateContext(ctx);

        this.shader = new Shader(ctx, [
            'precision mediump float;',
            'attribute vec3 pos;',
            'attribute vec3 color;',
            'attribute float size;',
            'attribute float shimmerAmount;',
            'attribute float shimmer;',
            'uniform mat4 viewMatrix;',
            'uniform float dt;',
            'uniform float shimmerRate;',
            'varying vec3 pointColor;',
            'varying float shimmerOut;',
            // https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
            'float rand(vec2 n) {',
            '  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);',
            '}',
            'void main(void) {',
            '  vec4 p = viewMatrix * vec4(pos, 1.0);',
            '  shimmerOut = shimmer;',
            '  shimmerOut -= dt * shimmerRate *',
            '    (shimmer - 2.0 * rand(vec2(p.x, p.y)) + 1.0);',
            '  pointColor = color;',
            '  pointColor *= 1.0 - 0.5 * (shimmer + 1.0) * shimmerAmount;',
            '  gl_Position = p;',
            '  gl_PointSize = size;',
            '}'
        ], [
            'precision mediump float;',
            'varying vec3 pointColor;',
            'void main(void) {',
            '  vec2 pos = 2.0 * gl_PointCoord - vec2(1.0, 1.0);',
            '  float inside = 1.0 - dot(pos, pos);',
            '  inside = (inside - 0.5) * 2.0 + 0.5;',
            '  inside = clamp(inside, 0.0, 1.0);',
            '  gl_FragColor = vec4(pointColor * inside, 1.0);',
            '}'
        ], ['shimmerOut']);

        this.updateArrays();
        this.updateUniforms();
    }

    updateArrays() {
        if (this.shader) {
            if (this.buffer && this.stars.length <= this.bufferLength)
                return;

            var ctx = this.ctx;

            if (!this.buffer) {
                this.array = ctx.createVertexArray();
                this.shimmerBufferIn = ctx.createBuffer();
                this.shimmerBufferOut = ctx.createBuffer();
                this.buffer = ctx.createBuffer();
                this.transform = ctx.createTransformFeedback();
            }

            ctx.bindVertexArray(this.array);
            ctx.bindTransformFeedback(ctx.TRANSFORM_FEEDBACK,
                                      this.transform);

            ctx.bindBuffer(ctx.ARRAY_BUFFER, this.buffer);
            ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(
                this.stars.map(s => [
                    s.x, s.y, s.z,
                    s.size, s.shimmerAmount,
                    s.color[0], s.color[1], s.color[2]
                ]).flat()
            ), ctx.DYNAMIC_DRAW);

            ctx.vertexAttribPointer(this.shader.pos, 3, ctx.FLOAT,
                                    false, 4 * 8, 4 * 0);
            ctx.vertexAttribPointer(this.shader.size, 1, ctx.FLOAT,
                                    false, 4 * 8, 4 * 3);
            ctx.vertexAttribPointer(this.shader.shimmerAmount, 1, ctx.FLOAT,
                                    false, 4 * 8, 4 * 4);
            ctx.vertexAttribPointer(this.shader.color, 3, ctx.FLOAT,
                                    false, 4 * 8, 4 * 5);
            ctx.enableVertexAttribArray(this.shader.pos);
            ctx.enableVertexAttribArray(this.shader.size);
            ctx.enableVertexAttribArray(this.shader.shimmerAmount);
            ctx.enableVertexAttribArray(this.shader.color);

            ctx.bindBuffer(ctx.ARRAY_BUFFER, this.shimmerBufferIn);
            ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(
                this.stars.map(s => 0.0)
            ), ctx.DYNAMIC_DRAW);
            ctx.bindBuffer(ctx.ARRAY_BUFFER, this.shimmerBufferOut);
            ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(
                this.stars.map(s => 0.0)
            ), ctx.DYNAMIC_DRAW);
            ctx.enableVertexAttribArray(this.shader.shimmer);

            ctx.bindVertexArray(null);
            ctx.bindTransformFeedback(ctx.TRANSFORM_FEEDBACK, null);
            this.bufferLength = this.stars.length;
        }
    }

    updateUniforms() {
        if (this.shader) {
            this.shader.use(this.ctx);

            this.ctx.uniform1f(this.shader.shimmerRate, this.shimmerRate);
        }
    }

    draw(ctx, t, dt, debug) {
        this.shader.use(ctx);

        this.ctx.uniformMatrix4fv(this.shader.viewMatrix,
                                  false, this.root.viewMatrices.sky.data);

        // draw stars
        ctx.uniform1f(this.shader.dt, dt);
        ctx.blendFunc(ctx.ONE, ctx.ONE);

        ctx.bindVertexArray(this.array);
        ctx.bindTransformFeedback(ctx.TRANSFORM_FEEDBACK,
                                  this.transform);
        ctx.bindBufferBase(ctx.TRANSFORM_FEEDBACK_BUFFER, 0,
                           this.shimmerBufferOut);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, this.shimmerBufferIn);
        ctx.vertexAttribPointer(this.shader.shimmer, 1, ctx.FLOAT,
                                false, 0.0, 0.0);
        ctx.beginTransformFeedback(ctx.POINTS);
        ctx.drawArrays(ctx.POINTS, 0, this.used);
        ctx.endTransformFeedback();
        ctx.bindBufferBase(ctx.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);

        var tmp = this.shimmerBufferOut;
        this.shimmerBufferOut = this.shimmerBufferIn;
        this.shimmerBufferIn = tmp;
    }
}

class Comets extends View {
    constructor(root) {
        super(root);
        this.comets = [];

        this.cometColor = [1.0, 1.0, 1.0];
        this.cometVertices = 10;
        this.cometRadius = Random.exponential(2).map((v) => (v + 2) / 1500);
        this.cometRate = 0.05; // comets / second
        this.cometSpeed = 2; // screens / second
        this.tailSize = 1.0; // in seconds
        this.tailColor = [0.375, 0.1875, 0.0];
        this.cometAngle = Random.uniform(1 * Math.PI / 8, 3 * Math.PI / 8);
        this.cometPosition = Random.normalPairs(0.5, 0.3);
    }

    updateSizes(width, height) {
        super.updateSizes(width, height);
        this.diagonal = Math.sqrt(width * width + height * height);
        this.updateUniforms();
    }

    updateContext(ctx) {
        super.updateContext(ctx);

        this.array = ctx.createVertexArray();
        ctx.bindVertexArray(this.array);

        var cometvs = [-1.0, 0.0, 1.0];
        this.nvertices = 1 + this.cometVertices;
        for (var i = 0; i < this.cometVertices; i++) {
            var p = i / (this.cometVertices - 1.0);
            var theta = -Math.PI / 2.0 + Math.PI * p;
            cometvs.push(Math.cos(theta));
            cometvs.push(Math.sin(theta));
            cometvs.push(0.0);
        }

        var vs = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, vs);
        ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(cometvs),
                       ctx.STATIC_DRAW);

        this.shader = new Shader(ctx, [
            'attribute vec2 pos;',
            'attribute float tail;',
            'varying vec4 c;',
            'uniform mat4 viewMatrix;',
            'uniform mat4 cometMatrix;',
            'uniform float radius;',
            'uniform float tailSize;',
            'uniform vec3 color;',
            'uniform vec3 tailColor;',
            'void main(void) {',
            '  vec2 p = pos;',
            '  p *= tail * tailSize + (1.0 - tail) * radius;',
            '  c = vec4(tail * tailColor + (1.0 - tail) * color, 1.0);',
            '  gl_Position = viewMatrix * cometMatrix * vec4(p, 0.0, 1.0);',
            '}'
        ], [
            'precision mediump float;',
            'varying vec4 c;',
            'void main(void) {',
            '  gl_FragColor = c;',
            '}'
        ]);

        ctx.vertexAttribPointer(this.shader.pos, 2, ctx.FLOAT,
                                false, 4 * 3, 4 * 0);
        ctx.vertexAttribPointer(this.shader.tail, 1, ctx.FLOAT,
                                false, 4 * 3, 4 * 2);
        ctx.enableVertexAttribArray(this.shader.pos);
        ctx.enableVertexAttribArray(this.shader.tail);
        ctx.bindVertexArray(null);

        this.updateUniforms();
    }

    updateUniforms() {
        if (this.shader) {
            this.shader.use(this.ctx);
            this.ctx.uniformMatrix4fv(this.shader.viewMatrix, false,
                                      this.root.viewMatrices.viewport.data);
        }
    }

    draw(ctx, t, dt) {
        // generate any comets we need
        var numComets = Random.poisson(this.cometRate * dt).generate();
        for (var i = 0; i < numComets; i++) {
            var vt = this.cometAngle.generate();
            var cost = Math.cos(vt);
            var sint = Math.sin(vt);
            var radius = this.cometRadius.generate() * this.diagonal;
            var v = this.cometSpeed * this.diagonal;
            var vx = cost * v;
            var vy = sint * v;
            // some hullabaloo to be sure that the meteor density
            // along the diagonal is about gaussian
            var startdiag = this.cometPosition.generate();
            var startdiagx = this.width * startdiag[0];
            var startdiagy = this.height * startdiag[1];
            if (vx > 0)
                startdiagy = this.height - startdiagy;
            var tx = startdiagx / vx;
            if (vx < 0)
                tx = -1.0 * (this.width - startdiagx) / vx;
            var ty = startdiagy / vy;
            var tmin = Math.min(tx, ty);
            this.comets.push({
                x: startdiagx - tmin * vx,
                y: startdiagy - tmin * vy,
                radius: radius,
                vx: vx,
                vy: vy,
                matrix: new Matrix().rotate(0, 0, -vt),
                color: this.cometColor,
                tailColor: this.tailColor,
                tailSize: v * this.tailSize
            });
        }

        // remove any comets off-screen
        var margin = this.cometSpeed * this.tailSize * this.diagonal;
        this.comets = this.comets.filter(c => {
            if (c.x < -margin || c.x > this.width + margin)
                return false;
            if (c.y < -margin || c.y > this.height + margin)
                return false;
            return true;
        });

        // draw comets
        ctx.bindVertexArray(this.array);
        ctx.blendFunc(ctx.ONE, ctx.ONE);
        this.shader.use(ctx);
        for (var i = 0; i < this.comets.length; i++) {
            var c = this.comets[i];

            ctx.uniformMatrix4fv(this.shader.cometMatrix, false,
                                 c.matrix.translate(c.x, c.y, 0.0).data);
            ctx.uniform1f(this.shader.radius, c.radius);
            ctx.uniform3fv(this.shader.color, c.color);
            ctx.uniform3fv(this.shader.tailColor, c.tailColor);
            ctx.uniform1f(this.shader.tailSize, c.tailSize);

            ctx.drawArrays(ctx.TRIANGLE_FAN, 0, this.nvertices);

            // update comet position
            c.x += dt * c.vx;
            c.y += dt * c.vy;
        }
    }
}

class Planet extends View {
    constructor(root) {
        super(root);

        this.hdiv = 100;
        this.vdiv = 100;
        this.distance = 363104; // in same units as radius
        this.radius = 1737.1;
        this.fudge = 5; // turns out moons are VERY SMALL
        this.direction = [1.0, 1.0, 0.8];
        this.lightdir = [2.0, 0.0, -4.0];
        this.roughness = 0.5;
        this.textureUrl = 'moon.jpg';
        this.enable = false;

        this.properties['moonSize'] = v => {
            this.fudge = v;
            this.updateUniforms();
        };

        this.properties['moonTexture'] = v => {
            this.textureUrl = v;
            this.loadTexture();
        };

        this.properties['planet'] = v => {
            this.enable = v;
            this.loadTexture();
        };

        this.generate();
    }

    generate() {
        this.vertices = [];
        this.indices = [];

        var hstep = 2.0 * Math.PI / this.hdiv;
        var vstep = Math.PI / this.vdiv;

        // UV sphere vertices
        for (var i = 0; i <= this.vdiv; i++) {
            var vangle = 0.5 * Math.PI - i * vstep;
            var xy = Math.cos(vangle);
            var z = Math.sin(vangle);

            for (var j = 0; j <= this.hdiv; j++) {
                var hangle = j * hstep;

                var x = xy * Math.cos(hangle);
                var y = xy * Math.sin(hangle);

                var s = j / this.hdiv;
                var t = i / this.vdiv;

                this.vertices.push({
                    x: x, y: y, z: z,
                    s: s, t: t,
                });
            }
        }

        // indices
        for (var i = 0; i < this.vdiv; i++) {
            var k1 = i * (this.hdiv + 1);
            var k2 = k1 + this.hdiv + 1;

            for (var j = 0; j < this.hdiv; j++, k1++, k2++) {
                if (i != 0) {
                    this.indices.push(k1);
                    this.indices.push(k2);
                    this.indices.push(k1 + 1);
                }
                if (i != this.vdiv - 1) {
                    this.indices.push(k1 + 1);
                    this.indices.push(k2);
                    this.indices.push(k2 + 1);
                }
            }
        }
    }

    updateContext(ctx) {
        super.updateContext(ctx);

        this.tex = ctx.createTexture();
        ctx.bindTexture(ctx.TEXTURE_2D, this.tex);
        // placeholder
        ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, 1, 1, 0,
                       ctx.RGBA, ctx.UNSIGNED_BYTE,
                       new Uint8Array([255, 255, 255, 255]));
        ctx.bindTexture(ctx.TEXTURE_2D, null);

        this.loadTexture();

        this.sphere = ctx.createVertexArray();
        ctx.bindVertexArray(this.sphere);

        var spherev = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, spherev);
        ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(
            this.vertices.map(v => [
                v.x, v.y, v.z,
                v.s, v.t,
            ]).flat()
        ), ctx.STATIC_DRAW);

        var spherei = ctx.createBuffer();
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, spherei);
        ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices),
                       ctx.STATIC_DRAW);

        this.shader = new Shader(ctx, [
            'attribute vec3 pos;',
            'attribute vec2 texcoord;',
            'varying vec3 normal;',
            'varying vec3 eye;',
            'varying vec2 tc;',
            'uniform mat4 viewMatrix;',
            'uniform mat4 modelMatrix;',
            'void main(void) {',
            '  tc = texcoord;',
            '  normal = normalize((modelMatrix * vec4(pos, 0.0)).xyz);',
            '  eye = normalize(-(modelMatrix * vec4(pos, 1.0)).xyz);',
            '  gl_Position = viewMatrix * modelMatrix * vec4(pos, 1.0);',
            '}'
        ], [
            'precision mediump float;',
            'uniform sampler2D tex;',
            'uniform vec3 lightdir;',
            'uniform float A;',
            'uniform float B;',
            'varying vec3 normal;',
            'varying vec3 eye;',
            'varying vec2 tc;',
            'void main(void) {',
            '  float cosi = dot(normal, normalize(lightdir));',
            '  float cosr = dot(normal, eye);',
            '  float sini = sqrt(1.0 - cosi * cosi);',
            '  float sinr = sqrt(1.0 - cosr * cosr);',
            '  float sina = max(sini, sinr);',
            '  float tanb = min(sini / cosi, sinr / cosr);',
            '  float cosir = max(0.0, cosi * cosr + sini * sinr);',
            '  float l = max(0.0, cosi) * (A + B * cosir * sina * tanb);',
            '  vec3 color = texture2D(tex, tc).rgb;',
            '  gl_FragColor = vec4(color.rgb * l, 1.0);',
            '}'
        ]);

        ctx.vertexAttribPointer(this.shader.pos, 3, ctx.FLOAT,
                                false, 4 * 5, 4 * 0);
        ctx.vertexAttribPointer(this.shader.texcoord, 2, ctx.FLOAT,
                                false, 4 * 5, 4 * 3);
        ctx.enableVertexAttribArray(this.shader.pos);
        ctx.enableVertexAttribArray(this.shader.texcoord);

        ctx.bindVertexArray(null);

        this.updateUniforms();
    }

    loadTexture() {
        if (this.ctx && this.enable) {
            var ctx = this.ctx;
            var tex = this.tex;
            var image = new Image();
            image.onload = function() {
                ctx.bindTexture(ctx.TEXTURE_2D, tex);
                ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA,
                               ctx.RGBA, ctx.UNSIGNED_BYTE, image);
                ctx.generateMipmap(ctx.TEXTURE_2D);
                ctx.bindTexture(ctx.TEXTURE_2D, null);
            };

            image.src = this.textureUrl;
        }
    }

    updateUniforms() {
        if (this.shader) {
            this.shader.use(this.ctx);
            this.ctx.uniform3fv(this.shader.lightdir, this.lightdir);
            this.ctx.uniform1i(this.shader.tex, 0);

            var d = this.direction;
            var len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
            d = d.map(v => 2 * v / len);

            var pos = new Matrix().scale(2 * this.radius * this.fudge / this.distance)
                .rotate(Math.PI / 2, 1.0, 0.0) // should be a look-at
                .translate(d[0], d[1], d[2]);
            this.ctx.uniformMatrix4fv(this.shader.modelMatrix, false,
                                      pos.data);

            // oren-nayar stuff
            var s = this.roughness * this.roughness;
            var A = 1.0 - 0.5 * s  / (s + 0.33);
            var B = 0.45 * s / (s + 0.09);
            this.ctx.uniform1f(this.shader.A, A);
            this.ctx.uniform1f(this.shader.B, B);
        }
    }

    draw(ctx, t, dt) {
        if (!this.enable)
            return;
        ctx.bindVertexArray(this.sphere);
        this.shader.use(ctx);
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, this.tex);
        ctx.uniformMatrix4fv(this.shader.viewMatrix, false,
                             this.root.viewMatrices.sky.data);
        ctx.blendFunc(ctx.ONE, ctx.ZERO);
        ctx.enable(ctx.DEPTH_TEST);
        ctx.clear(ctx.DEPTH_BUFFER_BIT);
        ctx.drawElements(ctx.TRIANGLES, this.indices.length,
                         ctx.UNSIGNED_SHORT, 0);
        ctx.disable(ctx.DEPTH_TEST);
    }
}

class Foreground extends ElementView {
    constructor(root) {
        super(root, 'img');
        this.el.style.position = 'absolute';
        this.el.style.left = '0px';
        this.el.style.right = '0px';
        this.el.style.bottom = '0px';
        this.el.style.width = '100%';

        this.properties['foreground'] = v => this.el.src = v;
    }
}

class Character extends ElementView {
    constructor(root) {
        super(root, 'img');

        this.el.style.position = 'absolute';
        this.bottom = 0;

        this.properties['character'] = v => this.el.src = v;
        this.properties['characterLeft'] = l => this.el.style.left = `${l * 100}%`;
        this.properties['characterWidth'] = w => this.el.style.width = `${w * 100}%`;
        this.properties['characterBottom'] = b => {
            this.bottom = b;
            this.updateSizes(this.width, this.height);
        }
    }

    updateSizes(width, height) {
        super.updateSizes(width, height);
        this.el.style.bottom = `${this.bottom * this.width}px`;
    }
}

class Byline extends ElementView {
    constructor(root) {
        super(root, 'span');

        this.el.style.position = 'absolute';
        this.el.style.right = '0px';
        this.el.style.bottom = '0px';
        this.el.style.color = '#ddd';
        this.el.style.padding = '4pt';
        this.el.style.fontSize = '16pt';
        this.el.style.color = 'white';
        this.el.style.textAlign = 'right';

        this.properties['byline'] = v => this.el.innerHTML = v;
        this.properties['bylineFontStyle'] = v => this.el.style.fontStyle = v;
        this.properties['bylineFontFamily'] = v => this.el.style.fontFamily = v;
    }
}

class Music extends View {
    constructor(root) {
        super(root);

        this.music = new Audio();
        this.music.loop = true;
        this.container.addEventListener('click', () => {
            if (this.music.paused)
                this.music.play();
            else
                this.music.pause();
        });

        this.properties['music'] = v => this.music.src = v;
    }

    start() {
        this.music.play();
    }

    stop() {
        this.music.stop();
    }
}

class ViewMatrices extends View {
    constructor(root) {
        super(root);

        this.omega = 0.02; // radians / second
        this.fov = 90 * Math.PI / 180;
        this.horizon = 200; // in pixels, from bottom
        this.north = 0.8; // proportional to width, from left

        this.debug = false;
        this.properties['debug'] = v => {
            this.debug = v;
            this.updateSizes(this.width, this.height);
        }

        this.skyBase = null;
        this.sky = null;
    }

    updateSizes(width, height) {
        super.updateSizes(width, height);

        var debugscale = this.debug ? 0.3 : 1.0;

        // re-orient view
        var diagonal = Math.sqrt(width * width + height * height);
        var ld = Math.tan(this.fov / 2.0);
        var lx = ld * width / diagonal;
        var ly = ld * height / diagonal;
        
        var horizont = Math.atan(ly * (2.0 * this.horizon / this.height - 1.0))
        var northt = Math.atan(lx * (2.0 * this.north - 1.0));
        this.skyBase = new Matrix().rotate(0, Math.PI, 0)
            .rotate(-horizont, 0, 0).rotate(0, northt, 0)
            .perspective(this.width / this.height, this.fov, 0.1, 10.0)
            .scale(debugscale, debugscale, 1.0);

        this.viewport = new Matrix().scale(2.0 / width, 2.0 / height, 1.0)
            .translate(-1.0, -1.0, 0.0)
            .scale(debugscale, -debugscale, 1.0);

        this.normalized = new Matrix().scale(debugscale, debugscale, 1.0);
    }

    draw(ctx, t, dt, debug) {
        var theta = t * this.omega;
        this.sky = this.skyBase.dot(new Matrix().rotate(0.0, 0.0, theta));
    }
}

class SpaceCowboy {
    constructor(container) {
        this.container = container;
        this.running = false;

        // set up our canvas
        this.canvas = new Canvas(this);
        this.starfield = new Starfield(this);
        this.viewMatrices = new ViewMatrices(this);
        
        this.views = [
            this.viewMatrices,
            this.canvas,

            // stuff in space
            this.starfield,
            new Planet(this),
            new Comets(this),

            // stuff not in space
            new Light(this),
            new Foreground(this),
            new Character(this),
            new Byline(this),
            new Music(this),
        ];
        
        // default
        this.bebop();
    }

    start() {
        if (this.running)
            return;
        
        this.resizeListener = event => this.updateSizes();
        window.addEventListener('resize', this.resizeListener);
        this.updateSizes();
        this.updateContext();

        for (var i = 0; i < this.views.length; i++)
            this.views[i].start();
        
        this.running = true;
        this.lastFrame = false;
        window.requestAnimationFrame(t => this.draw(t));
    }

    stop() {
        if (!this.running)
            return;
        window.removeEventListener('resize', this.resizeListener);
        for (var i = 0; i < this.views.length; i++)
            this.views[i].stop();
        this.running = false;
    }

    updateSizes() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        for (var i = 0; i < this.views.length; i++)
            this.views[i].updateSizes(this.width, this.height);        
    }

    updateContext() {
        for (var i = 0; i < this.views.length; i++)
            this.views[i].updateContext(this.canvas.ctx);
    }

    draw(t) {
        if (!this.running)
            return;

        // our times
        var ts = t / 1000.0;
        var dt = 0.0;
        if (this.lastFrame !== false)
            dt = (t - this.lastFrame) / 1000.0;

        var ctx = this.canvas.ctx;

        // draw all
        for (var i = 0; i < this.views.length; i++)
            this.views[i].draw(ctx, ts, dt);

        // reschedule
        this.lastFrame = t;
        window.requestAnimationFrame((t) => this.draw(t));
    }

    set(props) {
        for (var name in props) {
            var set = false;
            for (var i = 0; i < this.views.length; i++) {
                var v = this.views[i];
                if (name in v.properties) {
                    v.properties[name](props[name]);
                    set = true;
                }
            }
            //if (!set)
            //    throw `Bad setting for SpaceCowboy: ${name}`;
        }
        return this;
    }

    addStars(stars) {
        this.starfield.addStars(stars);
    }

    loadPreset(name) {
        if (name === 'bebop')
            return this.bebop();
        if (name === 'blue')
            return this.blue();
        if (name === 'standby')
            return this.standby();
        if (name === 'grain')
            return this.grain();
        if (name === 'planet')
            return this.planet();
        if (name === 'ttgl')
            return this.ttgl();
        if (name === 'exhale')
            return this.exhale();
        return this;
    }

    defaults() {
        return this.set({
            debug: false,
            background: [0.125, 0.125, 0.125],
            light: [0.1875, 0.125, 0.0],
            foreground: 'foreground.svg',
        });
    }

    bebop() {
        return this.defaults().set({
            byline: 'SEE YOU SPACE COWBOY...',
            bylineFontFamily: 'Bookman, serif',
            bylineFontStyle: 'italic',
            music: 'space-lion.mp3',
            character: 'spike.svg',
            moonSize: 50,
            moonTexture: 'jupiter.jpg',
            characterLeft: 0.05,
            characterWidth: 0.05,
            characterBottom: 0.12,
        });
    }

    blue() {
        return this.bebop().set({
            byline: 'YOU\'RE GONNA CARRY THAT WEIGHT.',
            music: 'blue.mp3',
            light: [0.0, 0.0, 0.3125],
        });
    }

    standby() {
        return this.set({
            byline: 'PLEASE STAND BY.',
            music: null,
        });
    }

    grain() {
        return this.set({
            quant: 15.0,
        });
    }

    planet() {
        return this.set({
            planet: true,
        });
    }

    ttgl() {
        return this.bebop().set({
            byline: 'HMM...',
            music: 'libera-me-from-hell.mp3',
            character: 'kamina.svg',
            moonSize: 5,
            moonTexture: 'moon.jpg',
            characterLeft: 0.025,
            characterWidth: 0.10,
            characterBottom: 0.12,
        });
    }

    exhale() {
        return this.defaults().set({
            byline: 'Just breathe.',
            bylineFontFamily: 'Renogare, sans-serif',
            bylineFontStyle: 'normal',
            music: 'exhale.mp3',
            character: 'madeline.svg',
            moonSize: 5,
            moonTexture: 'moon.jpg',
            characterLeft: 0.31,
            characterWidth: 0.10,
            characterBottom: 0.085,
            background: [0.184, 0.141, 0.262],
            light: [0.969, 0.719, 0.668],
        });
    }
}
