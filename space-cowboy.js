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

class View {
    constructor(container) {
        this.container = container;
        this.properties = {};
    }
    updateSizes(width, height) {
        this.width = width;
        this.height = height;
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
        this.backgroundStyle = 'black';
        this.lightStyle = 'white';
        this.debug = false;

        this.properties['debug'] = v => this.debug = v;
        this.properties['background'] = v => this.backgroundStyle = v;
        this.properties['light'] = v => this.lightStyle = v;
    }

    updateSizes(width, height) {
        super.updateSizes(width, height);

        this.el.width = this.width;
        this.el.height = this.height;
        this.ctx = this.el.getContext('2d');
    }

    draw(ctx, t, dt, debug) {
        // clear
        var grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, this.backgroundStyle);
        grad.addColorStop(1, this.lightStyle);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
        
        // debug shrink and scale
        if (debug) {
            ctx.translate(0.4 * this.width, 0.4 * this.height);
            ctx.scale(0.2, 0.2);
        }
    }
}

class StarBucket {
    constructor(nr, nt) {
        this.totalStars = 0;
        this.usedStars = 0;
        this.nr = nr;
        this.nt = nt;
        this.buckets = [];
        var rinterval = 1.0 / nr;
        var tinterval = 2.0 * Math.PI / nt;
        for (var it = 0; it < nt; it++) {
            var tmin = tinterval * it;
            var tmax = tinterval * (it + 1);
            var cosmin = Math.cos(tmin);
            var sinmin = Math.sin(tmin);
            var cosmax = Math.cos(tmax);
            var sinmax = Math.sin(tmax);
            var tbuckets = [];
            for (var ir = 0; ir < nr; ir++) {
                var rmin = Math.sqrt(rinterval * ir);
                var rmax = Math.sqrt(rinterval * (ir + 1));
                tbuckets[ir] = {
                    rmin: rmin,
                    rmax: rmax,
                    tmin: tmin,
                    tmax: tmax,
                    cosmin: cosmin,
                    sinmin: sinmin,
                    cosmax: cosmax,
                    sinmax: sinmax,
                    used: 0,
                    stars: [],
                };
            }
            this.buckets[it] = {
                tmin: tmin,
                tmax: tmax,
                cosmin: cosmin,
                sinmin: sinmin,
                cosmax: cosmax,
                sinmax: sinmax,
                buckets: tbuckets,
            };
        }
    }

    getBucket(r, theta) {
        for (var it = 0; it < this.nt; it++) {
            var tbucket = this.buckets[it];
            if (theta < tbucket.tmin || theta > tbucket.tmax)
                continue;
            for (var ir = 0; ir < this.nr; ir++) {
                var bucket = tbucket.buckets[ir];
                if (r < bucket.rmin || r > bucket.rmax)
                    continue;
                return bucket;
            }
        }
    }

    setUsedStars(n, starFactory) {
        this.usedStars = n;
        while (this.usedStars > this.totalStars) {
            var star = starFactory();
            var bucket = this.getBucket(star.r, star.theta);
            if (!bucket)
                continue;
            bucket.stars[bucket.stars.length] = star;
            this.totalStars++;
        }

        var usedPercent = this.usedStars / this.totalStars;

        for (var it = 0; it < this.nt; it++) {
            for (var ir = 0; ir < this.nr; ir++) {
                var bucket = this.buckets[it].buckets[ir];
                bucket.used = Math.round(bucket.stars.length * usedPercent);
            }
        }
    }
}

class Starfield extends View {
    constructor(container) {
        super(container);
        
        this.starDistance = 20;
        this.maxStars = 20000;
        this.rBuckets = 10;
        this.tBuckets = 20;
        this.starRadius = Random.uniform(0.001, 0.003);
        this.starStyle = Random.traverse([
            Random.uniform(0, 65),
            Random.uniform(0, 20),
            Random.uniform(50, 100),
        ]).map(v => `hsl(${v[0]}, ${v[1]}%, ${v[2]}%)`);   
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
        this.stars = new StarBucket(this.rBuckets, this.tBuckets);
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

        // figure out corner thetas
        var corners = [['xmin', 'ymin'], ['xmin', 'ymax'], ['xmax', 'ymax'], ['xmax', 'ymin']];
        this.boundaries.corners = [];
        for (var i = 0; i < corners.length; i++) {
            var c = corners[i];
            var x = this.boundaries[c[0]];
            var y = this.boundaries[c[1]];
            var r = Math.sqrt(x * x + y * y);
            var theta = Math.atan2(y, x);
            if (theta < 0)
                theta += 2 * Math.PI;
            this.boundaries.corners[i] = [r, theta];
        }

        // figure out how many stars we need to get this distance
        var numStars = Math.PI * Math.pow(this.starFieldRadius, 2) / Math.pow(this.starDistance, 2);
        numStars /= (1.0 - this.galaxyProportion);
        if (numStars > this.maxStars)
            numStars = this.maxStars;

        // make new stars
        var disc = Random.discPolar(1);
        this.stars.setUsedStars(Math.round(numStars), () => {
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
            return {
                x: pt[0] * Math.cos(pt[1]),
                y: pt[0] * Math.sin(pt[1]),
                r: pt[0],
                theta: pt[1],
                size: this.starRadius.generate(),
                style: this.starStyle.generate(),
                shimmer: 0,
                shimmerAmount: this.shimmerAmount.generate(),
            };
        });
    }

    castTheta(tmin, tmax, cosmin, sinmin, cosmax, sinmax) {
        var bounds = this.boundaries;
        var rxmin = Math.max(bounds.xmin / cosmin, bounds.xmax / cosmin);
        var rymin = Math.max(bounds.ymin / sinmin, bounds.ymax / sinmin);
        var rxmax = Math.max(bounds.xmin / cosmax, bounds.xmax / cosmax);
        var rymax = Math.max(bounds.ymin / sinmax, bounds.ymax / sinmax);
        var r = Math.max(Math.min(rxmin, rymin), Math.min(rxmax, rymax));
        // corners are tricksy
        for (var i = 0; i < bounds.corners.length; i++) {
            var c = bounds.corners[i];
            var dt = (c[1] - tmin + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
            if (dt > 0 && dt < tmax - tmin && c[0] > r)
                r = c[0];
        }
        return r;
    }

    drawStar(ctx, dt, s) {
        var starx = s.x * this.starFieldRadius;
        var stary = s.y * this.starFieldRadius;
        ctx.fillStyle = s.style;
        ctx.globalAlpha = 1.0 - 0.5 * (s.shimmer + 1) * s.shimmerAmount;
        var size = s.size * this.starFieldRadius;
        if (size < 1)
            size = 1;
        if (size < 3) {
            ctx.fillRect(starx, stary, size, size);
        } else {
            ctx.beginPath();
            ctx.arc(starx, stary, size / 2, 0, 2 * Math.PI);
            ctx.fill();
        }
        // update shimmer with leaky integrator
        s.shimmer -= dt * this.shimmerRate * (s.shimmer - this.shimmerNoise.generate());
        if (s.shimmer > 1.0)
            s.shimmer = 1.0;
        if (s.shimmer < -1.0)
            s.shimmer = -1.0;

    }

    draw(ctx, t, dt, debug) {
        // figure out how much the stars have rotated since last frame
        var theta = -t * this.omega;
        var thetasin = Math.sin(theta);
        var thetacos = Math.cos(theta);

        // draw stars
        ctx.save();
        ctx.translate(-this.boundaries.xmin, -this.boundaries.ymin);
        ctx.rotate(theta);
        for (var it = 0; it < this.stars.nt; it++) {
            var tbucket = this.stars.buckets[it];
            // precalculate some occlusion fun stuff
            var cosmin = thetacos * tbucket.cosmin - thetasin * tbucket.sinmin;
            var sinmin = thetasin * tbucket.cosmin + thetacos * tbucket.sinmin;
            var cosmax = thetacos * tbucket.cosmax - thetasin * tbucket.sinmax;
            var sinmax = thetasin * tbucket.cosmax + thetacos * tbucket.sinmax;
            var rmax = this.castTheta(tbucket.tmin + theta, tbucket.tmax + theta, cosmin, sinmin, cosmax, sinmax) / this.starFieldRadius;
            // render the buckets!
            for (var ir = 0; ir < this.stars.nr; ir++) {
                var bucket = tbucket.buckets[ir];
                var visible = true;
                // ok, do some occlusion testing on the whole bucket
                if (bucket.rmin > rmax)
                    visible = false;
                if (!visible && !debug)
                    break;
                for (var i = 0; i < bucket.used; i++) {
                    this.drawStar(ctx, dt, bucket.stars[i]);
                }

                if (debug && visible) {
                    // draw sectors
                    ctx.strokeStyle = 'green';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.arc(0, 0, bucket.rmin * this.starFieldRadius, bucket.tmin, bucket.tmax, false);
                    ctx.arc(0, 0, bucket.rmax * this.starFieldRadius, bucket.tmax, bucket.tmin, true);
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }
}

class Comets extends View {
    constructor(container) {
        super(container);
        this.comets = [];

        this.cometStyle = '#fff';
        this.cometRadius = Random.exponential(2).map((v) => (v + 2) / 1500);
        this.cometRate = 0.05; // comets / second
        this.cometSpeed = 2; // screens / second
        this.tailSize = 1.0; // in seconds
        this.tailStyle = `#630`;
        this.cometAngle = Random.uniform(1 * Math.PI / 8, 3 * Math.PI / 8);
        this.cometPosition = Random.normalPairs(0.5, 0.3);
    }

    updateSizes(width, height) {
        super.updateSizes(width, height);
        this.diagonal = Math.sqrt(width * width + height * height);
    }

    draw(ctx, t, dt, debug) {
        // generate any comets we need
        var numComets = Random.poisson(this.cometRate * dt).generate();
        for (var i = 0; i < numComets; i++) {
            var vt = this.cometAngle.generate();
            var cost = Math.cos(vt);
            var sint = Math.sin(vt);
            var radius = this.cometRadius.generate() * this.diagonal;
            var vx = cost * this.cometSpeed * this.diagonal;
            var vy = sint * this.cometSpeed * this.diagonal;
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
                px: sint * radius,
                py: -cost * radius,
                style: this.cometStyle,
                tailStyle: this.tailStyle,
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
        for (var i = 0; i < this.comets.length; i++) {
            var c = this.comets[i];
            // comet tail
            var tailx = c.x - c.vx * this.tailSize;
            var taily = c.y - c.vy * this.tailSize;
            var grad = ctx.createLinearGradient(c.x, c.y, tailx, taily);
            grad.addColorStop(0, c.style);
            grad.addColorStop(1, c.tailStyle);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(tailx, taily);
            ctx.lineTo(c.x - c.px, c.y - c.py);
            ctx.lineTo(c.x + c.px, c.y + c.py);
            ctx.closePath();
            ctx.fill();
            // comet head
            ctx.fillStyle = c.style;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.radius, 0, 2 * Math.PI);
            ctx.fill();
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
        this.el.style.fontFamily = 'Bookman, serif';
        this.el.style.fontStyle = 'italic';
        this.el.style.padding = '4pt';
        this.el.style.fontSize = '16pt';
        this.el.style.color = 'white';
        this.el.style.textAlign = 'right';

        this.properties['byline'] = v => this.el.innerHTML = v;
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
        ctx.save();
        for (var i = 0; i < this.views.length; i++)
            this.views[i].draw(ctx, ts, dt, debug);

        // debug frame
        if (debug) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 5;
            ctx.strokeRect(0, 0, this.width, this.height);
        }

        ctx.restore();

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
        return this;
    }

    defaults() {
        return this.set({
            debug: false,
            background: '#222',
            light: '#320',
            foreground: 'foreground.svg',
        });
    }

    bebop() {
        return this.defaults().set({
            byline: 'SEE YOU SPACE COWBOY...',
            music: 'space-lion.mp3',
            character: 'spike.svg',
            characterLeft: 0.05,
            characterWidth: 0.05,
            characterBottom: 0.12,
        });
    }

    blue() {
        return this.defaults().set({
            byline: 'YOU\'RE GONNA CARRY THAT WEIGHT.',
            music: 'blue.mp3',
            character: 'spike.svg',
            characterLeft: 0.05,
            characterWidth: 0.05,
            characterBottom: 0.12,
            light: '#005',
        });
    }

    standby() {
        return this.defaults().set({
            byline: 'PLEASE STAND BY.',
            character: 'spike.svg',
            characterLeft: 0.05,
            characterWidth: 0.05,
            characterBottom: 0.12,
            light: '#005',
        });
    }

    ttgl() {
        return this.defaults().set({
            byline: 'HMM...',
            music: 'libera-me-from-hell.mp3',
            character: 'kamina.svg',
            characterLeft: 0.025,
            characterWidth: 0.10,
            characterBottom: 0.12,
        });
    }
}
