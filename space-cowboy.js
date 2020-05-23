'use strict';

var DEBUG_SCALE = 0.3;

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
    constructor(container) {
        this.container = container;
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
    draw(ctx, t, dt, debug) {}
}

class ElementView extends View {
    constructor(container, name) {
        super(container);
        this.el = document.createElement(name);
        container.appendChild(this.el);
    }
}

class Canvas extends ElementView {
    constructor(container) {
        super(container, 'canvas');

        this.el.style.zIndex = -1;
        this.el.style.position = 'absolute';
        this.el.style.left = '0px';
        this.el.style.top = '0px';
        this.background = [0.0, 0.0, 0.0];
        this.light = [1.0, 1.0, 1.0];
        this.debug = false;

        this.properties['debug'] = v => this.debug = v;
        this.properties['background'] = v => {
            this.background = v;
            this.updateUniforms();
        };
        this.properties['light'] = v => {
            this.light = v;
            this.updateUniforms();
        };
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

        this.quad = ctx.createVertexArray();
        ctx.bindVertexArray(this.quad);

        var quadv = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, quadv);
        ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
            1.0, 1.0, 0.0,
            1.0, -1.0, 0.0,
            -1.0, -1.0, 0.0,
            -1.0, 1.0, 0.0
        ]), ctx.STATIC_DRAW);

        this.shader = new Shader(ctx, [
            'attribute vec3 pos;',
            'varying float f;',
            'uniform float debugscale;',
            'void main(void) {',
            '  gl_Position = vec4(pos * debugscale, 1.0);',
            '  f = (pos.y + 1.0) * 0.5;',
            '}'
        ], [
            'precision mediump float;',
            'varying float f;',
            'uniform vec3 background;',
            'uniform vec3 light;',
            'void main(void) {',
            '  vec3 c = background * f + light * (1.0 - f);',
            '  gl_FragColor = vec4(c, 1.0);',
            '}'
        ]);

        ctx.vertexAttribPointer(this.shader.pos, 3, ctx.FLOAT, false, 0, 0);
        ctx.enableVertexAttribArray(this.shader.pos);
        ctx.bindVertexArray(null);

        this.updateUniforms();
    }

    updateUniforms() {
        if (this.shader) {
            this.shader.use(this.ctx);
            this.ctx.uniform3fv(this.shader.background, this.background);
            this.ctx.uniform3fv(this.shader.light, this.light);
        }
    }

    draw(ctx, t, dt, debug) {
        // clear with gradient
        ctx.bindVertexArray(this.quad);
        this.shader.use(ctx);
        ctx.uniform1f(this.shader.debugscale, debug ? DEBUG_SCALE : 1.0);
        ctx.blendFunc(ctx.ONE, ctx.ZERO);
        ctx.drawArrays(ctx.TRIANGLE_FAN, 0, 4);
    }
}

class Starfield extends View {
    constructor(container) {
        super(container);
        
        this.starDistance = 20;
        this.maxStars = 20000 * 100;
        this.starRadius = Random.uniform(2, 5);
        this.starColor = Random.traverse([
            Random.uniform(0, 0.65),
            Random.uniform(0, 0.2),
            Random.uniform(0.0, 1),
        ]).map(v => hsvToRgb(v[0], v[1], v[2]));
        this.shimmerAmount = Random.unit();
        this.omega = 0.01; // radians / second
        this.horizon = 100; // in pixels, from bottom
        this.north = 0.8; // proportional to width, from left
        this.shimmerRate = 10.0; // units of 1/s, leak rate

        this.galaxyAngle = 63 * Math.PI / 180;
        this.galaxyT = Random.normal(0, Math.PI / 6);
        this.galaxyZ = Random.normal(0, 0.07);
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

    updateSizes(width, height) {
        super.updateSizes(width, height);
        this.starFieldRadius = Math.sqrt(Math.max.apply(null, [
            Math.pow(this.north * width, 2) + Math.pow(this.horizon, 2),
            Math.pow(this.north * width, 2) + Math.pow(height - this.horizon, 2),
            Math.pow(width - this.north * width, 2) + Math.pow(height - this.horizon, 2),
            Math.pow(width - this.north * width, 2) + Math.pow(this.horizon, 2),
        ]));

        // get the x/y boundaries
        this.boundaries = {
            xmin: -this.north * this.width,
            xmax: (1 - this.north) * this.width,
            ymin: this.horizon - this.height,
            ymax: this.horizon,
        };

        // figure out how many stars we need to get this distance
        var numStars = Math.PI * Math.pow(this.starFieldRadius, 2) / Math.pow(this.starDistance, 2);
        numStars /= (1.0 - this.galaxyProportion);
        if (numStars > this.maxStars)
            numStars = this.maxStars;

        // make new stars
        var disc = Random.discPolar(1);
        while (this.stars.length < numStars) {
            var pt = disc.generate();
            if (Math.random() < this.galaxyProportion) {
                // oh no it's a galaxy instead
                var theta = this.galaxyT.generate() + Math.PI / 2;
                var z = this.galaxyZ.generate();
                var x = Math.sin(theta) * Math.cos(this.galaxyAngle) - z * Math.sin(this.galaxyAngle);
                var y = Math.cos(theta);
                var t = Math.atan2(y, x);
                if (t < 0)
                    t += 2 * Math.PI;
                pt = [Math.sqrt(x * x + y * y), t];
            }
            this.stars.push({
                x: pt[0] * Math.cos(pt[1]),
                y: pt[0] * Math.sin(pt[1]),
                size: this.starRadius.generate(),
                color: this.starColor.generate(),
                shimmerAmount: this.shimmerAmount.generate(),
            });
        }

        this.used = numStars;
        this.updateArrays();
        this.updateUniforms();
    }

    updateContext(ctx) {
        super.updateContext(ctx);

        this.shader = new Shader(ctx, [
            'precision mediump float;',
            'attribute vec2 pos;',
            'attribute vec3 color;',
            'attribute float size;',
            'attribute float shimmerAmount;',
            'attribute float shimmer;',
            'uniform vec2 theta;',
            'uniform float radius;',
            'uniform float dt;',
            'uniform float shimmerRate;',
            'uniform vec2 offset;',
            'uniform vec2 viewport;',
            'uniform float debugscale;',
            'varying vec3 pointColor;',
            'varying float shimmerOut;',
            // https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
            'float rand(vec2 n) {',
            '  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);',
            '}',
            'void main(void) {',
            '  vec2 p;',
            '  p.x = theta.x * pos.x - theta.y * pos.y;',
            '  p.y = theta.y * pos.x + theta.x * pos.y;',
            '  shimmerOut = shimmer;',
            '  shimmerOut -= dt * shimmerRate *',
            '    (shimmer - 2.0 * rand(p) + 1.0);',
            '  p *= radius;',
            '  p += offset;',
            '  p.x /= viewport.x;',
            '  p.y /= viewport.y;',
            '  p = 2.0 * p - vec2(1.0, 1.0);',
            '  p *= debugscale;',
            '  pointColor = color;',
            '  pointColor *= 1.0 - 0.5 * (shimmer + 1.0) * shimmerAmount;',
            '  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);',
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
                    s.x, s.y,
                    s.size, s.shimmerAmount,
                    s.color[0], s.color[1], s.color[2]
                ]).flat()
            ), ctx.DYNAMIC_DRAW);

            ctx.vertexAttribPointer(this.shader.pos, 2, ctx.FLOAT,
                                    false, 4 * 7, 4 * 0);
            ctx.vertexAttribPointer(this.shader.size, 1, ctx.FLOAT,
                                    false, 4 * 7, 4 * 2);
            ctx.vertexAttribPointer(this.shader.shimmerAmount, 1, ctx.FLOAT,
                                    false, 4 * 7, 4 * 3);
            ctx.vertexAttribPointer(this.shader.color, 3, ctx.FLOAT,
                                    false, 4 * 7, 4 * 4);
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
            this.ctx.uniform2f(this.shader.offset,
                          -this.boundaries.xmin, -this.boundaries.ymin);
            this.ctx.uniform2f(this.shader.viewport, this.width, this.height);
            this.ctx.uniform1f(this.shader.radius, this.starFieldRadius);
            this.ctx.uniform1f(this.shader.shimmerRate, this.shimmerRate);
        }
    }

    draw(ctx, t, dt, debug) {
        // figure out how much the stars have rotated since last frame
        var theta = -t * this.omega;
        var thetasin = Math.sin(theta);
        var thetacos = Math.cos(theta);

        // draw stars
        this.shader.use(ctx);
        ctx.uniform2f(this.shader.theta, thetacos, thetasin);
        ctx.uniform1f(this.shader.dt, dt);
        ctx.uniform1f(this.shader.debugscale, debug ? DEBUG_SCALE : 1.0);
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
    constructor(container) {
        super(container);
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
            'uniform float debugscale;',
            'uniform vec2 viewport;',
            'uniform vec2 cometPos;',
            'uniform float radius;',
            'uniform vec2 theta;',
            'uniform float tailSize;',
            'uniform vec3 color;',
            'uniform vec3 tailColor;',
            'void main(void) {',
            '  vec2 p;',
            '  p.x = theta.x * pos.x - theta.y * pos.y;',
            '  p.y = theta.y * pos.x + theta.x * pos.y;',
            '  p *= tail * tailSize + (1.0 - tail) * radius;',
            '  p += cometPos;',
            '  p.x /= viewport.x;',
            '  p.y /= viewport.y;',
            '  p = 2.0 * p - vec2(1.0, 1.0);',
            '  p.y *= -1.0;',
            '  c = vec4(tail * tailColor + (1.0 - tail) * color, 1.0);',
            '  gl_Position = vec4(p * debugscale, 0.0, 1.0);',
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
            this.ctx.uniform2f(this.shader.viewport, this.width, this.height);
        }
    }

    draw(ctx, t, dt, debug) {
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
                v: v,
                sint: sint,
                cost: cost,
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
        ctx.uniform1f(this.shader.debugscale, debug ? DEBUG_SCALE : 1.0);
        for (var i = 0; i < this.comets.length; i++) {
            var c = this.comets[i];

            ctx.uniform2f(this.shader.cometPos, c.x, c.y);
            ctx.uniform1f(this.shader.radius, c.radius);
            ctx.uniform2f(this.shader.theta, c.cost, c.sint);
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

class Foreground extends ElementView {
    constructor(container) {
        super(container, 'img');
        this.el.style.position = 'absolute';
        this.el.style.left = '0px';
        this.el.style.right = '0px';
        this.el.style.bottom = '0px';
        this.el.style.width = '100%';

        this.properties['foreground'] = v => this.el.src = v;
    }
}

class Character extends ElementView {
    constructor(container) {
        super(container, 'img');

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
    constructor(container) {
        super(container, 'span');

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
    constructor(container) {
        super(container);

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

class SpaceCowboy {
    constructor(container) {
        this.container = container;
        this.running = false;

        // set up our canvas
        this.canvas = new Canvas(container);
        
        this.views = [
            this.canvas,
            new Starfield(container),
            new Comets(container),
            new Foreground(container),
            new Character(container),
            new Byline(container),
            new Music(container),
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
        var debug = this.canvas.debug;

        // draw all
        for (var i = 0; i < this.views.length; i++)
            this.views[i].draw(ctx, ts, dt, debug);

        // debug frame
        if (debug) {
            //ctx.strokeStyle = 'red';
            //ctx.lineWidth = 5;
            //ctx.strokeRect(0, 0, this.width, this.height);
        }

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

    loadPreset(name) {
        if (name === 'bebop')
            return this.bebop();
        if (name === 'blue')
            return this.blue();
        if (name === 'standby')
            return this.standby();
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

    ttgl() {
        return this.bebop().set({
            byline: 'HMM...',
            music: 'libera-me-from-hell.mp3',
            character: 'kamina.svg',
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
            characterLeft: 0.31,
            characterWidth: 0.10,
            characterBottom: 0.085,
            background: [0.184, 0.141, 0.262],
            light: [0.969, 0.719, 0.668],
        });
    }
}
