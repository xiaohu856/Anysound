(function () {
    'use strict';

    if (window.__liquidGlassInstalled) return;

    function smoothStep(a, b, t) {
        t = Math.max(0, Math.min(1, (t - a) / (b - a)));
        return t * t * (3 - 2 * t);
    }
    function len(x, y) { return Math.sqrt(x * x + y * y); }
    function rectSDF(x, y, hw, hh, r) {
        var qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r;
        return Math.min(Math.max(qx, qy), 0) + len(Math.max(qx, 0), Math.max(qy, 0)) - r;
    }
    function circleSDF(x, y, r) { return len(x, y) - r; }

    var uid = 0;
    var instances = [];
    var svgContainer;

    function ensureSvgContainer() {
        if (svgContainer) return svgContainer;
        svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgContainer.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgContainer.setAttribute('width', '0');
        svgContainer.setAttribute('height', '0');
        svgContainer.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:99999;';
        document.body.appendChild(svgContainer);
        return svgContainer;
    }

    function glassFor(el, opts) {
        var id = 'lg' + (++uid);
        var w = Math.round(opts.width), h = Math.round(opts.height);
        if (w < 12 || h < 12) return null;
        var shape = opts.shape || 'rect';
        var cr = opts.cornerRadius || 0.15;
        var dpi = 1;
        var cw = w * dpi, ch = h * dpi;

        var svg = ensureSvgContainer();

        var filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', id + '_f');
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('colorInterpolationFilters', 'sRGB');
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', String(w));
        filter.setAttribute('height', String(h));

        var feImg = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
        feImg.setAttribute('id', id + '_m');
        feImg.setAttribute('width', String(w));
        feImg.setAttribute('height', String(h));

        var feDisp = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
        feDisp.setAttribute('in', 'SourceGraphic');
        feDisp.setAttribute('in2', id + '_m');
        feDisp.setAttribute('xChannelSelector', 'R');
        feDisp.setAttribute('yChannelSelector', 'G');

        filter.appendChild(feImg);
        filter.appendChild(feDisp);
        svg.appendChild(filter);

        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');

        function update() {
            var data = new Uint8ClampedArray(cw * ch * 4);
            var maxV = 0;
            var raw = [];

            for (var i = 0; i < data.length; i += 4) {
                var px = (i / 4) % cw, py = Math.floor(i / 4 / cw);
                var ux = px / cw, uy = py / ch;
                var ix = ux - 0.5, iy = uy - 0.5;

                var dist;
                if (shape === 'circle') {
                    dist = circleSDF(ix, iy, 0.45);
                } else {
                    dist = rectSDF(ix, iy, 0.4, 0.35, cr);
                }

                var d = smoothStep(0.5, 0, dist + 0.02);
                var s = smoothStep(0, 1, d);
                var dx = ix * s + 0.5 - ux;
                var dy = iy * s + 0.5 - uy;
                var absDx = Math.abs(dx * cw), absDy = Math.abs(dy * ch);
                if (absDx > maxV) maxV = absDx;
                if (absDy > maxV) maxV = absDy;
                raw.push(dx, dy);
            }

            maxV *= 0.5;
            if (maxV < 0.5) maxV = 0.5;

            var ri = 0;
            for (var i = 0; i < data.length; i += 4) {
                data[i]     = (raw[ri++] / maxV + 0.5) * 255;
                data[i + 1] = (raw[ri++] / maxV + 0.5) * 255;
                data[i + 2] = 0;
                data[i + 3] = 255;
            }

            ctx.putImageData(new ImageData(data, cw, ch), 0, 0);
            feImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL());
            feDisp.setAttribute('scale', String(Math.round(maxV / dpi)));
        }

        update();

        el.style.setProperty('backdrop-filter', 'url(#' + id + '_f) blur(0.5px) contrast(1.15) brightness(1.04) saturate(1.5)', 'important');
        el.style.setProperty('-webkit-backdrop-filter', 'url(#' + id + '_f) blur(0.5px) contrast(1.15) brightness(1.04) saturate(1.5)', 'important');

        return {
            update: update,
            destroy: function () {
                filter.remove();
                canvas.remove();
            }
        };
    }

    var targets = [
        { sel: '.modal-content',       shape: 'rect',   cr: 0.12 },
        { sel: '.player-container',    shape: 'rect',   cr: 0.08 },
        { sel: '.top-nav',             shape: 'rect',   cr: 0.05 },
        { sel: '.volume-dropdown',     shape: 'rect',   cr: 0.10 },
        { sel: '.nav-search-dropdown', shape: 'rect',   cr: 0.10 },
        { sel: '.toast',               shape: 'rect',   cr: 0.10 },
        { sel: '.btn',                 shape: 'rect',   cr: 0.15 },
        { sel: '.control-btn',         shape: 'circle', cr: 0 },
        { sel: '.play-pause-btn',      shape: 'circle', cr: 0 },
        { sel: '.close-btn',           shape: 'circle', cr: 0 },
        { sel: '.hamburger-menu',      shape: 'circle', cr: 0 },
        { sel: '.player-mode-btn',     shape: 'circle', cr: 0 },
        { sel: '.toggle-slider',       shape: 'rect',   cr: 0.45 },
        { sel: '.tab-buttons',         shape: 'rect',   cr: 0.12 },
        { sel: '.setting-item',        shape: 'rect',   cr: 0.12 },
        { sel: '.sub-settings-panel',  shape: 'rect',   cr: 0.12 },
        { sel: '.fps-customize-panel', shape: 'rect',   cr: 0.12 },
        { sel: '.form-input',          shape: 'rect',   cr: 0.12 },
        { sel: '.nav-search-input',    shape: 'rect',   cr: 0.12 },
        { sel: '.setting-item select', shape: 'rect',   cr: 0.12 },
    ];

    var processed = new WeakSet();

    function installTargets() {
        targets.forEach(function (t) {
            var els = document.querySelectorAll(t.sel);
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (processed.has(el)) continue;
                var rect = el.getBoundingClientRect();
                if (rect.width < 16 || rect.height < 16) continue;
                processed.add(el);
                var inst = glassFor(el, {
                    width: rect.width,
                    height: rect.height,
                    shape: t.shape,
                    cornerRadius: t.cr
                });
                if (inst) instances.push(inst);
            }
        });
    }

    function destroyAll() {
        instances.forEach(function (inst) { inst.destroy(); });
        instances = [];
        processed = new WeakSet();
        if (svgContainer) {
            while (svgContainer.firstChild) svgContainer.removeChild(svgContainer.firstChild);
        }
    }

    function refresh() {
        if (!document.body.classList.contains('liquid-glass-mode')) return;
        destroyAll();
        installTargets();
    }

    function run() {
        if (!document.body) { setTimeout(run, 50); return; }
        if (!document.body.classList.contains('liquid-glass-mode')) {
            setTimeout(run, 300);
            return;
        }
        installTargets();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 600); });
    } else {
        setTimeout(run, 600);
    }

    window.addEventListener('resize', function () {
        clearTimeout(window.__lgResizeTimer);
        window.__lgResizeTimer = setTimeout(refresh, 300);
    });

    window.refreshLiquidGlass = refresh;
    window.__liquidGlassInstalled = true;

    var observer = new MutationObserver(function () {
        if (!document.body.classList.contains('liquid-glass-mode')) {
            destroyAll();
        } else if (instances.length === 0) {
            installTargets();
        }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();