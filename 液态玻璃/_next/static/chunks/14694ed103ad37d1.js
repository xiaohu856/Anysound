(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,52683,e=>{"use strict";var t,r=e.i(43476),a=e.i(71645);let i=`
// Corner style: 0 = circular (standard arc), 1 = continuous (squircle/superellipse).
// Declared here (in SDF_GLSL) because sdShape references it, and SDF_GLSL is
// included by multiple shaders (element, shadow, highlight, plain-rect).
uniform float uCornerStyle;

// --- Continuous-curvature SDF texture (capsule shape) ---
// When uUseContinuousSdf > 0.5, sdShape() dispatches to sdContinuousCurvature
// which samples a precomputed SDF texture (generated from the G2-continuous
// Bezier path in continuous-curve.ts). Only the dialog card sets this to 1;
// other shaders that include SDF_GLSL leave it at the default 0 — sdShape
// falls through to the analytic sdRoundedRect / sdContinuousRoundedRect path.
uniform sampler2D uContinuousSdf;
uniform float uUseContinuousSdf;        // 0 or 1
uniform vec2  uContinuousSdfTexSize;    // SDF texture size in px (256, 256)
uniform vec2  uContinuousSdfElementSize; // element's original w,h in px

// radiusAt — picks the corner radius from cornerRadii based on which
// quadrant 'coord' is in. For uniform radii (the catalog case) this
// always returns the same value.
float radiusAt(vec2 coord, vec4 radii) {
    if (coord.x >= 0.0) {
        if (coord.y <= 0.0) return radii.y;
        else return radii.z;
    } else {
        if (coord.y <= 0.0) return radii.x;
        else return radii.w;
    }
}

// sdRoundedRect — signed distance to a rounded-rect boundary.
// Negative inside, positive outside, zero on the edge.
// Uses standard circular arcs for the corners.
float sdRoundedRect(vec2 coord, vec2 halfSize, float radius) {
    vec2 cornerCoord = abs(coord) - (halfSize - vec2(radius));
    float outside = length(max(cornerCoord, 0.0)) - radius;
    float inside = min(max(cornerCoord.x, cornerCoord.y), 0.0);
    return outside + inside;
}

// sdContinuousRoundedRect — continuous-curvature rounded rect.
// The original uses G2-continuous Bezier corners (ContinuousCurvatureRoundedRectangleCornerBuilder).
// The visual difference between Continuous and Circular is very subtle (only
// curvature continuity at the tangent points). For the SDF-based renderer,
// the circular arc SDF (sdRoundedRect) is a close enough approximation — the
// Bezier corners deviate from the arc by <0.5% of the radius, which is
// sub-pixel at typical element sizes.
//
// When uCornerStyle=1 (continuous), we use sdRoundedRect directly. The
// difference from the original is imperceptible. A future upgrade could
// implement exact Bezier SDF for pixel-perfect matching.
float sdContinuousRoundedRect(vec2 coord, vec2 halfSize, float radius) {
    return sdRoundedRect(coord, halfSize, radius);
}

// sampleClipMask — sample R channel (coverage) from the mask texture.
// Returns browser-native AA coverage [0,1] for clip + edgeAlpha.
float sampleClipMask(vec2 coord, vec2 halfSize, float radius) {
    float maxDim = max(max(uContinuousSdfElementSize.x, uContinuousSdfElementSize.y), 1e-4);
    float aspectW = uContinuousSdfElementSize.x / maxDim;
    float margin = 4.0;
    float drawW = (uContinuousSdfTexSize.x - 2.0 * margin) * aspectW;
    float scale = drawW / max(uContinuousSdfElementSize.x, 1e-4);
    vec2 tex = uContinuousSdfTexSize * 0.5 + coord * scale;
    vec2 uv = tex / uContinuousSdfTexSize;
    return texture2D(uContinuousSdf, uv).r;  // R = coverage [0,1]
}

// sampleClipSdf — sample G channel (SDF) from the mask texture.
// Returns signed distance: negative inside, positive outside, 0 at edge.
// Same shape as sampleClipMask (both from the same Bezier path), so clip
// and stroke shapes are always identical.
float sampleClipSdf(vec2 coord, vec2 halfSize, float radius) {
    float maxDim = max(max(uContinuousSdfElementSize.x, uContinuousSdfElementSize.y), 1e-4);
    float aspectW = uContinuousSdfElementSize.x / maxDim;
    float margin = 4.0;
    float drawW = (uContinuousSdfTexSize.x - 2.0 * margin) * aspectW;
    float scale = drawW / max(uContinuousSdfElementSize.x, 1e-4);
    vec2 tex = uContinuousSdfTexSize * 0.5 + coord * scale;
    vec2 uv = tex / uContinuousSdfTexSize;
    float g = texture2D(uContinuousSdf, uv).g;  // G = SDF [0,1]
    return (g * 2.0 - 1.0) * radius;  // decode to element-space distance
}

// sdClipShape — SDF for clip/discard when uUseContinuousSdf is OFF.
float sdClipShape(vec2 coord, vec2 halfSize, float radius) {
    return sdRoundedRect(coord, halfSize, radius);
}

// sdShape — SDF for refraction/highlight internal calculations.
// When uUseContinuousSdf=1, uses sampleClipSdf (same shape as clip mask).
// Otherwise uses sdRoundedRect.
float sdShape(vec2 coord, vec2 halfSize, float radius) {
    if (uUseContinuousSdf > 0.5) {
        return sampleClipSdf(coord, halfSize, radius);
    }
    return sdRoundedRect(coord, halfSize, radius);
}

// gradSdRoundedRect — gradient of the SDF (points outward from edge).
// Used both for refraction direction and highlight specular.
vec2 gradSdRoundedRect(vec2 coord, vec2 halfSize, float radius) {
    vec2 cornerCoord = abs(coord) - (halfSize - vec2(radius));
    if (cornerCoord.x >= 0.0 || cornerCoord.y >= 0.0) {
        vec2 v = max(cornerCoord, vec2(0.0));
        // Guard against normalize(0,0) -> NaN
        float len = length(v);
        if (len < 1e-6) return vec2(0.0);
        return sign(coord) * (v / len);
    } else {
        float gradX = step(cornerCoord.y, cornerCoord.x);
        return sign(coord) * vec2(gradX, 1.0 - gradX);
    }
}

// rotateBy — rotate a 2D vector by angle (radians). Used to un-rotate the
// sample coord into the element's local space (so the SDF shape appears
// rotated by +uElementRotation), and to rotate refraction offsets back to
// screen space.
vec2 rotateBy(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

// erfApprox — error function approximation (Abramowitz & Stegun 7.1.26).
// Max error < 2.5e-5. Used by inner shadow to model BlurMaskFilter's
// Gaussian convolution of a ring shape. erf(x) ∈ [-1, 1].
float erfApprox(float x) {
    float a = abs(x);
    float t = 1.0 / (1.0 + 0.47047 * a);
    float y = 1.0 - (((0.3480242 * t - 0.0958798) * t + 0.7478556) * t * exp(-a * a));
    return sign(x) * y;
}
`,o=`
// Returns wallpaper UV for a canvas pixel coordinate (top-left origin).
vec2 coverUv(vec2 canvasPx) {
    float canvasAspect = uCanvasSize.x / uCanvasSize.y;
    float wpAspect = uWallpaperSize.x / uWallpaperSize.y;
    vec2 uv = canvasPx / uCanvasSize;
    if (wpAspect > canvasAspect) {
        // Wallpaper is wider than canvas — crop horizontally.
        float s = canvasAspect / wpAspect;
        uv.x = (uv.x - 0.5) * s + 0.5;
    } else {
        // Wallpaper is taller than canvas — crop vertically.
        float s = wpAspect / canvasAspect;
        uv.y = (uv.y - 0.5) * s + 0.5;
    }
    return uv;
}

// Per-axis scale: 1 canvas pixel in wallpaper UV units.
// Used to convert a blur radius (in canvas px) into UV-space offsets
// for poisson-disc sampling.
vec2 canvasPxToUvScale() {
    float canvasAspect = uCanvasSize.x / uCanvasSize.y;
    float wpAspect = uWallpaperSize.x / uWallpaperSize.y;
    if (wpAspect > canvasAspect) {
        return vec2(canvasAspect / wpAspect, 1.0) / uCanvasSize;
    } else {
        return vec2(1.0, wpAspect / canvasAspect) / uCanvasSize;
    }
}
`,n=`
uniform sampler2D uBackdrop;
uniform sampler2D uWallpaperSampler;  // wallpaper texture (unscaled backdrop for toggle knobs)
uniform sampler2D uTabsBackdropSampler;  // tabsBackdrop FBO (tinted scene for indicator CombinedBackdrop)
uniform vec2  uCanvasSize;        // canvas size in px
uniform vec2  uWallpaperSize;     // UNUSED — kept for uniform-set compatibility
uniform vec2  uElementOffset;     // element top-left in canvas px (SCALED rect — where the quad is drawn)
uniform vec2  uElementSize;       // element size in px (SCALED — includes graphicsLayer scaleX/scaleY)
uniform vec4  uCornerRadii;       // (topLeft, topRight, bottomRight, bottomLeft) in px (ORIGINAL, unscaled)
uniform float uRefractionHeight;  // px (ORIGINAL space — NOT scaled by layerScale, faithful to AGSL)
uniform float uRefractionAmount;  // px (ORIGINAL space — NOT scaled, faithful to AGSL)
// --- Layer transform (faithful to graphicsLayer { scaleX, scaleY }) ---
// The original applies the refraction shader at the ORIGINAL element size, THEN
// scales the entire rendered layer by (scaleX, scaleY) via graphicsLayer. To
// replicate this in a single-pass shader, we compute the SDF/refraction in
// ORIGINAL space (by dividing the screen-space centered coord by uLayerScale),
// then map the refraction offset back to screen space for backdrop sampling.
// This keeps the SDF shape correct (not stretched) while covering the scaled rect.
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled by graphicsLayer)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer — maps original→screen
uniform float uElementRotation;    // rotation in radians (graphicsLayer rotationZ) — 0 = none
uniform float uDepthEffect;       // 0 or 1
uniform float uChromaticAberration; // 0 or 1
uniform float uBlurRadius;        // px
uniform float uSaturation;        // vibrancy = 1.5
uniform float uBrightness;        // brightness offset (0 for vibrancy)
uniform float uContrast;          // 1.0 for vibrancy
uniform vec4  uTintColor;         // rgba; alpha 0 = no tint
uniform vec4  uSurfaceColor;      // rgba; alpha 0 = no surface
uniform vec4  uHighlightColor;    // rgb + 1.0 (alpha handled by uHighlightAlpha)
uniform float uHighlightAngle;    // radians
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;     // 0=default, 1=ambient, 2=plain
uniform float uHighlightStrokeWidth; // px (full stroke width, matching paint.strokeWidth)
uniform float uHighlightBlur;     // px (BlurMaskFilter radius)
// Content scale (non-uniform, faithful to LiquidToggle.kt / LiquidSlider.kt):
//   scale(scaleX, scaleY) { drawBackdrop() }
// Toggle: X lerp(2/3, 0.75, p), Y lerp(0, 0.75, p)
// Slider: X lerp(2/3, 1, p),    Y lerp(0, 1, p)
// At rest Y=0 → backdrop sampled from a single horizontal line (degenerate),
// but the white overlay (alpha=1) hides it. When pressed, scales to full.
uniform float uContentScaleX;
uniform float uContentScaleY;
// --- Toggle knob CombinedBackdrop effect (faithful to LiquidToggle.kt) ---
// The knob's backdrop is a CombinedBackdrop of:
//   1. Outer backdrop (LayerBackdrop wallpaper OR CanvasBackdrop solid color)
//   2. Scaled trackBackdrop (track color rect, scaled by lerp(2/3,0.75) x lerp(0,0.75))
// uUseToggleBackdrop = 1.0 → sample outer backdrop + composite scaled track color
// uUseToggleBackdrop = 0.0 → sample scene (uBackdrop) as before
//
// uUseSolidBackdrop = 1.0 → outer backdrop is solid color (uSolidBackdropColor)
// uUseSolidBackdrop = 0.0 → outer backdrop is wallpaper texture (uWallpaperSampler)
// Faithful to ToggleContent.kt:
//   - t1 (on wallpaper): backdrop = LayerBackdrop → sample wallpaper texture
//   - t2 (on card):      backdrop = rememberCanvasBackdrop { drawRect(color) } → solid color
uniform float uUseToggleBackdrop;
uniform float uUseSolidBackdrop;
uniform vec4  uSolidBackdropColor;  // rgba 0..1; used when uUseSolidBackdrop = 1.0
uniform vec4  uTrackColor;        // rgba 0..1; alpha 0 = no track color
uniform vec4  uTrackRect;         // (centerX, centerY, halfW, halfH) in canvas px (dpr-scaled)
uniform float uTrackCornerRadius; // canvas px (dpr-scaled)
// --- Bottom tab 指示器 CombinedBackdrop (faithful to LiquidBottomTabs.kt) ---
// The 指示器's backdrop = CombinedBackdrop(wallpaper, 内层背景板) where
// 内层背景板 (tabsBackdrop) is a hidden Row with ColorFilter.tint(accentColor). Only the
// opaque 标签内容 (icons/labels) becomes blue after tint — the glass part
// is transparent. We pass up to 8 tab content rects; pixels inside any rect
// (clipped to the 容器 capsule) are tinted accentColor.
uniform float uIndicatorBackdrop;    // 0 or 1
uniform vec4  uContainerRect;        // (centerX, centerY, halfW, halfH) in canvas px (dpr-scaled)
uniform float uContainerCornerRadius; // canvas px (dpr-scaled)
uniform vec4  uIndicatorAccent;      // (r, g, b, a) — accentColor + unused
uniform float uInsetPx;              // indicator backdrop inset in device px (4dp * dpr)
uniform float uIndicatorPressProgress; // 0..1 press progress (for 2nd-layer scale)
uniform float uIndicatorPanelOffset; // panel offset in device px (2nd-layer x translation)
uniform float uDpr;                 // device pixel ratio (for dp→px conversion)
uniform vec2  uContainerCenter;      // container center (scale origin) in canvas px (dpr-scaled)
uniform float uContainerScale;       // container layerBlock scale (1 + 16dp/width * pressProgress)
// Tab content fgTextures (icon+label alpha masks) for blue tint. Up to 8 tabs.
// Only opaque icon/label pixels become blue — the container glass stays natural.
uniform sampler2D uTabContentTex0;
uniform sampler2D uTabContentTex1;
uniform sampler2D uTabContentTex2;
uniform sampler2D uTabContentTex3;
uniform sampler2D uTabContentTex4;
uniform sampler2D uTabContentTex5;
uniform sampler2D uTabContentTex6;
uniform sampler2D uTabContentTex7;
uniform vec4  uTabContentRects[8];   // (centerX, centerY, halfW, halfH) per tab, canvas px (dpr-scaled)
uniform float uTabContentCount;      // number of valid tab rects (0..8)
uniform sampler2D uTabsGlassLayer;   // scene snapshot BEFORE tab-content (wallpaper+glass only, no text)
// --- SDF texture glass (faithful to SdfShader.kt) ---
uniform sampler2D uSdfTexSampler;   // clock_sdf texture (R=SDF, GB=normal, A=shape alpha)
uniform float uUseSdfTexture;       // 0 or 1
uniform vec2  uSdfTexSize;          // texture natural dimensions (px)
uniform float uSdfLightAngle;       // bevel light angle (degrees)
uniform float uEnterAlpha;          // global element alpha (enterProgress, 0..1)
// When 1.0, skip applyColorControls in the element shader (colorControls was
// already applied as a fullscreen pass BEFORE the 2-pass blur on the backdrop
// FBO, matching the original's colorControls→blur→lens order). Used by
// backdropFbo + useSeparableBlur elements (dialog card).
uniform float uSkipColorControls;   // 0 or 1
// --- Magnifier glass (faithful to MagnifierContent.kt) ---
uniform float uUseMagnifier;        // 0 or 1
uniform float uMagnifierZoom;       // zoom factor (1.5)
uniform float uMagnifierOffsetY;    // sample Y offset to cursor (80dp, device px)
// --- Sample wallpaper directly (bypass scene FBO) ---
// When 1.0, sampleBackdrop uses coverUv + uWallpaperSampler (clean wallpaper)
// instead of sceneUv + uBackdrop (scene FBO). Used by elements that sit over
// a scrim/dim (Dialog card, ControlCenter tiles) so the glass refracts the
// clean wallpaper instead of the alpha-decayed scene FBO. Faithful to the
// original where LayerBackdrop captures the wallpaper Image (alpha=1).
uniform float uSampleWallpaper;     // 0 or 1
// --- Scrim color (applied to the wallpaper BEFORE colorControls/blur/lens) ---
// Faithful to DialogContent.kt / ControlCenterContent.kt where the scrim
// (drawRect(dimColor)) is painted onto the wallpaper Image (via
// BackdropDemoScaffold's modifier = drawWithContent { drawContent(); drawRect(dimColor) }),
// so the LayerBackdrop captures wallpaper+scrim as one opaque layer.
// In the port, when uSampleWallpaper=1 (clean wallpaper), we apply the scrim
// here in the shader to replicate that composited backdrop. uScrimColor.a=0
// means no scrim. Applied as SrcOver: backdrop.rgb = scrim.rgb*scrim.a + backdrop.rgb*(1-scrim.a).
uniform vec4 uScrimColor;           // rgba 0..1; a=0 = no scrim
// --- 内层背景板 rim highlight stroke mask (Canvas2D, same approach as outer rim) ---
// When uIndicatorBackdrop=1, the inner backdrop plate's rim highlight is sampled
// from this pre-rasterized Canvas2D stroke mask instead of computed analytically.
// The mask is drawn for the 内层背景板 capsule shape (uContainerRect dimensions)
// with clip(stroke) + BlurMaskFilter, giving browser-native Skia AA.
uniform sampler2D uInnerStrokeMask;   // Canvas2D stroke mask texture for inner backdrop highlight
uniform vec2  uInnerStrokeMaskOffset; // margin (strokeMargin) in device px — UV offset
uniform vec2  uInnerStrokeMaskSize;   // (maskW, maskH) in device px — total mask texture size
`;function s(e,t,r,a){if(1===e.length)return`    return texture2D(${t}, ${r});
`;let i="";for(let o of e){let e=o.x.toFixed(6),n=o.y.toFixed(6),s=o.w.toFixed(8);i+=`    sum += texture2D(${t}, ${r} + vec2(${e}, ${n}) * ${a}) * ${s};
`}return i}let l=function(e=16){let t=function(e=16){let t=function(e){let t=[];if(e<=1)return t.push({x:0,y:0,w:1}),t;let r=Math.PI*(3-Math.sqrt(5)),a=0;for(let i=0;i<e;i++){let o=3*Math.sqrt((i+.5)/e),n=i*r,s=o*Math.cos(n),l=o*Math.sin(n),u=Math.exp(-.5*(s*s+l*l));t.push({x:s,y:l,w:u}),a+=u}if(a>0)for(let e of t)e.w/=a;return t}(e),r=s(t,"uBackdrop","uv","pxToUv"),a=s(t,"uWallpaperSampler","uv","pxToUv");return`
// Forward declarations — blendHue/rgb2hsv/hsv2rgb are defined later but used
// by sampleIndicatorBackdrop (which must come before sampleToggleBackdrop in
// the file for readability). GLSL ES 1.00 requires declaration before use.
vec3 rgb2hsv(vec3 c);
vec3 hsv2rgb(vec3 c);
vec3 blendHue(vec3 dst, vec3 src);

float circleMap(float x) {
    return 1.0 - sqrt(1.0 - x * x);
}

// SDF-texture glass sampling (faithful to SdfShader.kt).
// Samples the clock_sdf texture at element-local coords.
// Returns vec4(intensity, maskAlpha, normalX, normalY); zeroes if outside.
vec4 sampleSdfTexture(vec2 localPx) {
    vec2 uv = vec2(localPx.x / uOriginalSize.x,
                   localPx.y / uOriginalSize.y);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
        return vec4(0.0);
    }
    vec4 v = texture2D(uSdfTexSampler, uv);
    float sd = v.r * 2.0 - 1.0;
    float mask = smoothstep(0.5, 1.0, v.a);
    if (mask <= 0.0) return vec4(0.0);
    if (mask < 1.0) sd = 0.0;
    vec2 normal = normalize(v.gb * 2.0 - 1.0);
    float intensity = circleMap(1.0 - min(1.0, -sd * 1.5));
    return vec4(intensity, mask, normal.x, normal.y);
}

// Convert a canvas-pixel coordinate (top-left origin) to scene-texture UV.
// The scene texture is the same size as the canvas, and is rendered with
// gl_FragCoord (bottom-left origin). So UV = (canvasPx.x / canvasW, 1 -
// canvasPx.y / canvasH). The Y flip happens here so the rest of the shader
// can work in top-left-origin canvas px.
vec2 sceneUv(vec2 canvasPx) {
    return vec2(canvasPx.x / uCanvasSize.x, 1.0 - canvasPx.y / uCanvasSize.y);
}

// Gaussian disc blur — ${e} taps, dynamically generated in JS.
// Offsets are in units of radius (sigma = radius), scaled at runtime.
// radius < 0.5 falls back to single tap (no visible blur).
//
// When uSampleWallpaper > 0.5, samples the CLEAN wallpaper (uWallpaperSampler
// via coverUv) instead of the scene FBO (uBackdrop via sceneUv), AND applies
// the scrim (uScrimColor) to replicate the original's wallpaper+scrim composited
// LayerBackdrop. The scrim is applied INSIDE sampleBackdrop so EVERY sampling
// site — the initial backdrop sample, the refraction re-sample, and each
// chromatic-aberration channel — gets the same wallpaper+scrim composite.
// This fixes the "scrim not applied at edges" bug where the refraction band
// re-sampled the clean wallpaper (without scrim), making the edge brighter
// than the interior.
vec4 sampleBackdrop(vec2 canvasPx, float radius) {
    if (uSampleWallpaper > 0.5) {
        vec2 uv = coverUv(canvasPx);
        vec4 c;
        if (radius < 0.5) {
            c = texture2D(uWallpaperSampler, uv);
        } else {
            vec2 pxToUv = radius * canvasPxToUvScale();
            vec4 sum = vec4(0.0);
${a}            c = sum;
        }
        // Apply scrim (SrcOver) so the backdrop = wallpaper+scrim, opaque.
        if (uScrimColor.a > 0.001) {
            c.rgb = uScrimColor.rgb * uScrimColor.a + c.rgb * (1.0 - uScrimColor.a);
            c.a = 1.0;
        }
        return c;
    }
    vec2 uv = sceneUv(canvasPx);
    if (radius < 0.5) {
        return texture2D(uBackdrop, uv);
    }
    vec2 pxToUv = radius / uCanvasSize;
    vec4 sum = vec4(0.0);
${r}    return sum;
}

// Gaussian disc blur of the WALLPAPER (uWallpaperSampler via coverUv).
// Used by the SDF-texture glass path (LockScreen) — faithful to the original's
// blur(2dp) effect applied before the SDF shader.
vec4 sampleWallpaperBlurred(vec2 canvasPx, float radius) {
    vec2 uv = coverUv(canvasPx);
    if (radius < 0.5) {
        return texture2D(uWallpaperSampler, uv);
    }
    vec2 pxToUv = radius * canvasPxToUvScale();
    vec4 sum = vec4(0.0);
${a}    return sum;
}

// --- Toggle knob CombinedBackdrop sampling (faithful to LiquidToggle.kt) ---
// The knob's backdrop is a CombinedBackdrop of:
//   1. Outer backdrop:
//      - LayerBackdrop (wallpaper) for t1 → sample uWallpaperSampler
//      - CanvasBackdrop (solid color) for t2 → use uSolidBackdropColor
//   2. Scaled trackBackdrop (track color rect, clipped to Capsule, scaled
//      by lerp(2/3, 0.75, pressProgress) x lerp(0, 0.75, pressProgress)
//      around the knob's center)
//
// This function samples the outer backdrop (wallpaper OR solid color) with blur,
// then composites the scaled track color on top using a rounded-rect SDF
// at the uTrackRect position (center + half-size + corner radius).
//
// The track color SDF is also blurred by approximating the blur as a
// smoothstep over uBlurRadius — this matches the original where the blur
// effect is applied to the CombinedBackdrop (outer + track color).
vec4 sampleToggleBackdrop(vec2 canvasPx, float radius) {
    // 1. Sample outer backdrop with blur.
    vec4 wp;
    if (uUseSolidBackdrop > 0.5) {
        // CanvasBackdrop case (t2): solid color fills the entire knob area.
        // Faithful to: rememberCanvasBackdrop { drawRect(backgroundColor) }
        // The drawRect fills the DrawScope (knob's bounds) with the color,
        // so every pixel of the knob's backdrop is the solid color.
        wp = uSolidBackdropColor;
    } else if (radius < 0.5) {
        // LayerBackdrop case (t1): sample wallpaper texture unscaled.
        // IMPORTANT: use coverUv (cover-fit) to match the wallpaper background
        // pass (WALLPAPER_FRAGMENT_SHADER). Using sceneUv (raw normalization)
        // here would sample the wrong texel when the wallpaper aspect ratio
        // differs from the canvas — causing the knob to see a shifted/misaligned
        // wallpaper that doesn't match what's displayed behind it.
        vec2 uv = coverUv(canvasPx);
        wp = texture2D(uWallpaperSampler, uv);
    } else {
        // LayerBackdrop case (t1) with blur: 9-tap poisson disc on wallpaper.
        // Use coverUv for the center sample, and convert the blur radius from
        // canvas px to UV-space using canvasPxToUvScale() (which accounts for
        // the cover-fit aspect ratio cropping).
        vec2 uv = coverUv(canvasPx);
        vec2 pxToUv = radius * canvasPxToUvScale();
        vec4 sum = vec4(0.0);
        float total = 0.0;
        sum += texture2D(uWallpaperSampler, uv) * 0.25; total += 0.25;
        sum += texture2D(uWallpaperSampler, uv + vec2( 1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2(-1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000,  1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000, -1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        wp = sum / total;
    }

    // 2. Composite scaled track color on top.
    // The track rect is centered at uTrackRect.xy with half-size uTrackRect.zw,
    // and corner radius uTrackCornerRadius. We compute the SDF of this
    // rounded rect at canvasPx, then apply a smoothstep for edge AA + blur.
    // If uTrackColor.a == 0.0 OR the track rect is degenerate (halfW or
    // halfH < 0.5px, which happens at rest when scaleY=0), skip compositing.
    // Faithful to original: scale(scaleX, 0) { drawRect() } draws nothing.
    if (uTrackColor.a > 0.001 && uTrackRect.z > 0.5 && uTrackRect.w > 0.5) {
        vec2 trackCenter = uTrackRect.xy;
        vec2 trackHalf = uTrackRect.zw;
        vec2 trackLocal = canvasPx - trackCenter;
        // sdRoundedRect expects centered coord (relative to center).
        // Use uniform corner radius = uTrackCornerRadius.
        float tr = uTrackCornerRadius;
        // Approximate the rounded-rect SDF (matches sdRoundedRect from SDF_GLSL).
        vec2 q = abs(trackLocal) - trackHalf + vec2(tr);
        float trackSd = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - tr;
        // Blur the edge by uBlurRadius (approximate Gaussian edge feather).
        // Inside (trackSd < -radius) → mask=1; outside (trackSd > radius) → mask=0.
        // Use max(radius, 1.0) to guarantee at least 1px smoothstep for AA
        // — when fully pressed, blurRadius=0, but edges must still be smooth.
        float aaRadius = max(radius, 1.0);
        float mask = 1.0 - smoothstep(-aaRadius, aaRadius, trackSd);
        // Composite: srcOver (track color over outer backdrop).
        float a = mask * uTrackColor.a;
        wp.rgb = mix(wp.rgb, uTrackColor.rgb, a);
        wp.a = mix(wp.a, 1.0, a);
    }
    return wp;
}

// sampleIndicatorBackdrop — faithful to LiquidBottomTabs.kt indicator.
//
// Naming convention (used throughout the bottom-tabs code):
//   - 容器 (Container)  = outer visible glass bar (64dp), Container Row in Kotlin
//   - 指示器 (Indicator) = selected sliding glass capsule (56dp), Indicator Box in Kotlin
//   - 内层背景板 (Inner backdrop) = hidden 56dp glass captured by tabsBackdrop,
//     tinted blue by ColorFilter.tint(accentColor), sampled by the indicator
//   - 标签内容 (Tab content) = icon + label inside each tab slot
//
// Original: indicator.drawBackdrop(backdrop = rememberCombinedBackdrop(backdrop, tabsBackdrop))
//   - backdrop (outer) = LayerBackdrop = wallpaper (sampled via coverUv)
//   - tabsBackdrop (inner) = hidden Row's 56dp glass, inset 4dp from the
//     indicator's draw area on all sides.
//
// Implementation (mirrors sampleToggleBackdrop):
//   1. Sample wallpaper (outer backdrop) with blur — same as toggle's outer.
//   2. Composite the scene FBO (uBackdrop = container glass + content)
//      inside an INSET capsule SDF (containerRect shrunk 4dp each side).
//      This is the "smaller background plate" refracted inside the indicator.
vec4 sampleIndicatorBackdrop(vec2 canvasPx, float radius) {
    // 1. Sample wallpaper (outer LayerBackdrop) via coverUv (cover-fit).
    vec4 wp;
    if (radius < 0.5) {
        vec2 uv = coverUv(canvasPx);
        wp = texture2D(uWallpaperSampler, uv);
    } else {
        vec2 uv = coverUv(canvasPx);
        vec2 pxToUv = radius * canvasPxToUvScale();
        vec4 sum = vec4(0.0);
        float total = 0.0;
        sum += texture2D(uWallpaperSampler, uv) * 0.25; total += 0.25;
        sum += texture2D(uWallpaperSampler, uv + vec2( 1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2(-1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000,  1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000, -1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        wp = sum / total;
    }

    // 2. 内层背景板 (Inner backdrop) SDF — the hidden Row's 56dp glass capsule.
    //    Faithful to LiquidBottomTabs.kt: the hidden Row has NO layerBlock,
    //    so its glass does NOT scale with the container. Only panelOffset
    //    shifts it (translationX = panelOffset).
    vec2 capsuleHalf = max(uContainerRect.zw, vec2(0.0));
    float cr = max(uContainerCornerRadius, 0.0);
    // Center = rectCenter + panelOffset (NO container scale).
    vec2 scaledCenter = uContainerRect.xy + vec2(uIndicatorPanelOffset, 0.0);
    vec2 capsuleLocal = canvasPx - scaledCenter;
    vec2 cq = abs(capsuleLocal) - capsuleHalf + vec2(cr);
    float capsuleSd = length(max(cq, vec2(0.0))) + min(max(cq.x, cq.y), 0.0) - cr;
    // Mask: interpolate between 1.0 (at rest) and smoothstep (when pressed).
    // At rest (progress=0): mask=1.0 — no separate smoothstep transition at
    // the containerRect boundary, because it overlaps with the indicator's own
    // edge (both 56dp capsules). A second smoothstep here would reveal raw
    // wallpaper at the indicator edge, causing jagged aliasing. With mask=1.0,
    // the indicator always shows the glass scene inside its shape, and edgeAlpha
    // smoothly fades to transparent — matching the container glass behind it.
    // When pressed (progress=1): restore the original smoothstep mask for the
    // CombinedBackdrop clipping. Refraction displaces samples away from the
    // shared edge, so the smoothstep no longer causes jaggies; and the inner
    // backdrop capsule clip preserves the correct CombinedBackdrop visual
    // (scene inside capsule, wallpaper outside).
    float indicatorAaRadius = max(radius, 1.0);
    float smoothstepMask = 1.0 - smoothstep(-indicatorAaRadius, indicatorAaRadius, capsuleSd);
    float mask = mix(1.0, smoothstepMask, uIndicatorPressProgress);

    // 2b. 内层背景板 shadow (Shadow.Default) — faithful to LiquidBottomTabs.kt
    //     hidden Row's drawBackdrop: shadow defaults to Shadow.Default when not specified.
    //     Shadow.Default: radius=24dp, offset=DpOffset(0, radius/6=4dp), color=Black@0.1, alpha=1.
    //     In the CombinedBackdrop, the shadow is composited between wallpaper (outer)
    //     and glass body (inner). Through the semi-transparent glass body, this shadow
    //     bleeds through near the capsule edges — most visible near the top edge where
    //     the shadow offset (0, +4dp) makes those pixels "outside" the shadow capsule
    //     (shadow capsule top = original top + 4dp, so original top is outside it).
    //     Implementation mirrors ShadowModifier.kt:
    //       1. Shift capsule by shadow offset → shadow shape SDF
    //       2. Gaussian falloff (MaskFilter.makeBlur sigma = radius directly)
    //       3. Mask inside original capsule (ShadowMaskPaint BlendMode.Clear)
    //       4. Darken wallpaper by Black@0.1 \xd7 shadowIntensity
    float shadowOffsetYpx = (24.0 / 6.0) * uDpr; // DpOffset(0, radius/6) in device px
    vec2 shadowLocal = capsuleLocal - vec2(0.0, shadowOffsetYpx);
    vec2 shadowCq2 = abs(shadowLocal) - capsuleHalf + vec2(cr);
    float shadowSd = length(max(shadowCq2, vec2(0.0))) + min(max(shadowCq2.x, shadowCq2.y), 0.0) - cr;
    // Shadow intensity: Gaussian falloff from shadow shape edge.
    // MaskFilter.makeBlur(FilterBlurMode.NORMAL, radius) takes sigma = radius directly.
    float shadowSigma = max(24.0 * uDpr, 1.0); // sigma = 24dp in device px
    float shadowIntensity = 0.5 * exp(-shadowSd * shadowSd / (2.0 * shadowSigma * shadowSigma));
    // Mask shadow inside the original capsule (ShadowMaskPaint BlendMode.Clear
    // removes shadow where the shape itself is drawn, so shadow only appears outside).
    shadowIntensity *= smoothstep(-1.0, 1.0, capsuleSd);
    // Darken wallpaper by Black@0.1 \xd7 shadowIntensity (SrcOver compositing).
    wp.rgb *= (1.0 - shadowIntensity * 0.1);

    // 3. Sample the GLASS LAYER FBO (wallpaper + container glass, NO tab text).
    //    This is a snapshot taken after the container glass is rendered but
    //    before tab-content is drawn — so it has no white/black text to bleed
    //    through. The blue tab text is drawn on top via fgTexture (step 4).
    vec2 sceneUv2 = sceneUv(canvasPx - vec2(uIndicatorPanelOffset, 0.0));
    vec4 scene = texture2D(uTabsGlassLayer, sceneUv2);

    // 4. Draw blue 标签内容 (tab content: icons/labels) on top of the glass layer.
    //    Use each tab's fgTexture alpha as a hard mask (step) — pixels inside
    //    the icon/label shape become blue, everything else stays the glass
    //    layer's natural color. No white edges (hard replace, no mix).
    //    Faithful to LiquidBottomTabs.kt: the hidden Row's tab content gets
    //    LocalLiquidBottomTabScale = lerp(1, 1.2, pressProgress) + panelOffset
    //    (NOT the container scale — the hidden Row is a sibling of the
    //    container, not a child, so the container layerBlock doesn't apply).
    float contentScale = 1.0 + 0.2 * uIndicatorPressProgress;
    float tabMask = 0.0;
    for (int i = 0; i < 8; i++) {
        if (float(i) >= uTabContentCount) break;
        vec4 r = uTabContentRects[i];
        if (r.z > 0.5 && r.w > 0.5) {
            // Tab content scales around its OWN center (not container center)
            // by contentScale, then shifts by panelOffset.
            vec2 tabCenter = r.xy + vec2(uIndicatorPanelOffset, 0.0);
            vec2 scaledHalf = r.zw * contentScale;
            vec2 localPx = canvasPx - (tabCenter - scaledHalf);
            vec2 uv = localPx / (scaledHalf * 2.0);
            if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
                float a = 0.0;
                if (i == 0) a = texture2D(uTabContentTex0, uv).a;
                else if (i == 1) a = texture2D(uTabContentTex1, uv).a;
                else if (i == 2) a = texture2D(uTabContentTex2, uv).a;
                else if (i == 3) a = texture2D(uTabContentTex3, uv).a;
                else if (i == 4) a = texture2D(uTabContentTex4, uv).a;
                else if (i == 5) a = texture2D(uTabContentTex5, uv).a;
                else if (i == 6) a = texture2D(uTabContentTex6, uv).a;
                else if (i == 7) a = texture2D(uTabContentTex7, uv).a;
                tabMask = max(tabMask, a);
            }
        }
    }
    // Use fgTexture alpha directly as the blue compositing factor. fgTexture
    // is LINEAR-filtered so its alpha has smooth AA edges — no smoothstep
    // threshold needed (which caused jaggies by hard-clipping the AA gradient).
    vec3 sceneColor = mix(scene.rgb, uIndicatorAccent.rgb, tabMask);

    // 5. Composite scene over wallpaper (SrcOver).
    //    At rest (mask≈1.0): a ≈ scene.a — glass scene composited at natural opacity.
    //    When pressed (mask=smoothstep): a = scene.a * mask — CombinedBackdrop clip.
    float a = scene.a * mask;
    vec3 resultRgb = mix(wp.rgb, sceneColor, a);

    // 6. 内层背景板 rim highlight — faithful to LiquidBottomTabs.kt hidden Row:
    //    highlight = { Highlight.Default.copy(alpha = progress) }
    //    The HighlightModifier draws a STROKE (width=0.5dp, strokeWidth=2px)
    //    blurred by 0.25dp, clipped inside the capsule, colored by the
    //    DefaultHighlightShaderString AGSL shader:
    //      float2 grad = gradSdRoundedRect(centeredCoord, halfSize, gradRadius);
    //      float2 normal = float2(cos(angle), sin(angle));
    //      float d = dot(grad, normal);
    //      float intensity = pow(abs(d), falloff);
    //      return color * intensity;   // color = White(1.0), alpha=1*progress
    //    with angle=45\xb0, falloff=1, gradRadius = min(radius*1.5, min(halfW, halfH)).
    //    The stroke's outward half (capsuleSd > 0) is clipped, leaving the inner
    //    half. Final contribution = White(1.0) * intensity * strokeMask * progress,
    //    added with Plus blend (additive).
    //    NOTE: this is the SAME as the 指示器's own rim highlight (step 2f in
    //    post-passes) — both use Highlight.Default. The only difference is the
    //    SDF: here it's the 内层背景板 capsule (inset 4dp), there it's the
    //    指示器's own capsule. The shader math is identical.
    //
    //    The stroke mask is now sampled from a pre-rasterized Canvas2D texture
    //    (uInnerStrokeMask) instead of computed analytically (65-tap Gaussian
    //    convolution of a hard-edge stroke band). This gives browser-native Skia
    //    hardware coverage AA — identical quality to the outer indicator rim
    //    highlight. The Canvas2D pipeline does ctx.clip(path) → ctx.stroke(path)
    //    → ctx.filter=blur, which naturally removes the outer half and provides
    //    sub-pixel AA. No per-pixel SDF loops, no smoothstep clipAA needed.
    float highlightAlpha = uIndicatorPressProgress;
    if (highlightAlpha > 0.001) {
        // SDF gradient + Default highlight intensity (angle=45\xb0, falloff=1).
        // This part is identical to the AGSL DefaultHighlightShaderString.
        float indRadius = max(cr, 0.0);
        float indHalfMin = min(capsuleHalf.x, capsuleHalf.y);
        float gradRadius = min(indRadius * 1.5, indHalfMin);
        vec2 grad = gradSdRoundedRect(capsuleLocal, capsuleHalf, gradRadius);
        vec2 normal = vec2(0.70710678, 0.70710678); // cos(45\xb0), sin(45\xb0)
        float d = dot(grad, normal);
        float intensity = pow(abs(d), 1.0);

        // Sample the pre-rasterized Canvas2D stroke mask texture.
        // UV mapping: capsuleLocal (centered, -halfW..+halfW) → element-local
        // (0..2*halfW) by adding capsuleHalf → add margin offset → divide
        // by maskSize. This is the same convention as the outer indicator
        // stroke mask (STROKE_MASK_COMPOSITE_FRAGMENT_SHADER).
        vec2 innerLocal = capsuleLocal + capsuleHalf;
        vec2 innerMaskUv = (innerLocal + uInnerStrokeMaskOffset) / uInnerStrokeMaskSize;
        // Bounds check — discard samples outside the mask texture.
        float innerMask = 0.0;
        if (innerMaskUv.x >= 0.0 && innerMaskUv.x <= 1.0 &&
            innerMaskUv.y >= 0.0 && innerMaskUv.y <= 1.0) {
            innerMask = texture2D(uInnerStrokeMask, innerMaskUv).a;
        }

        // White(0.5) * intensity * innerMask * progress, Plus blend (additive).
        // Faithful to HighlightStyle.Default: color = White.copy(alpha=0.5f).
        // The AGSL shader uses this 0.5 alpha, NOT color.copy(alpha=1f).
        // Same fix as DEFAULT_HIGHLIGHT.alpha = 0.5 (was previously 1.0).
        // No clipAA needed — the Canvas2D clip(path) before stroke already removes
        // the outer half, and Skia hardware coverage provides AA.
        resultRgb += vec3(0.5) * intensity * innerMask * highlightAlpha;
    }

    return vec4(resultRgb, 1.0);
}

// Magnifier backdrop sampling — faithful to MagnifierContent.kt's
// onDrawBackdrop: withTransform({ scale(1.5); translate(top=-80dp) }, drawBackdrop).
// Zoom around the magnifier center, then offset Y toward cursor.
vec4 sampleMagnifier(vec2 canvasPx, float radius) {
    vec2 magCenter = uElementOffset + uElementSize * 0.5;
    vec2 zoomedCoord = magCenter + (canvasPx - magCenter) / uMagnifierZoom;
    vec2 cursorCoord = vec2(zoomedCoord.x, zoomedCoord.y + uMagnifierOffsetY);
    return sampleBackdrop(cursorCoord, radius);
}

// colorControls — exact port of ColorFilter.kt colorControlsColorFilter.
// saturation 1.5, brightness 0, contrast 1 -> pure saturation boost.
vec3 applyColorControls(vec3 c, float brightness, float contrast, float saturation) {
    float invSat = 1.0 - saturation;
    float r = 0.213 * invSat;
    float g = 0.715 * invSat;
    float b = 0.072 * invSat;
    float t = (0.5 - contrast * 0.5 + brightness) * 255.0;
    float cs = contrast * saturation;
    float cr = contrast * r;
    float cg = contrast * g;
    float cb = contrast * b;
    vec3 outc;
    outc.r = (cr + cs) * c.r + cg * c.g + cb * c.b + t / 255.0;
    outc.g = cr * c.r + (cg + cs) * c.g + cb * c.b + t / 255.0;
    outc.b = cr * c.r + cg * c.g + (cb + cs) * c.b + t / 255.0;
    return outc;
}

// --- HSV conversion + BlendMode.Hue ---------------------------
// Faithful port of Skia's BlendMode.Hue (non-separable blend).
// Hue blend: result takes hue from src, saturation+value from dst.
// Used by drawRect(tint, BlendMode.Hue) in onDrawSurface.
vec3 rgb2hsv(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float delta = maxC - minC;
    float v = maxC;
    float s = maxC < 1e-6 ? 0.0 : delta / maxC;
    float h = 0.0;
    if (delta > 1e-6) {
        if (maxC == c.r) {
            h = mod((c.g - c.b) / delta, 6.0);
        } else if (maxC == c.g) {
            h = (c.b - c.r) / delta + 2.0;
        } else {
            h = (c.r - c.g) / delta + 4.0;
        }
        h *= 60.0;
        if (h < 0.0) h += 360.0;
    }
    return vec3(h / 360.0, s, v);
}

vec3 hsv2rgb(vec3 c) {
    float h = c.x * 6.0;
    float s = c.y;
    float v = c.z;
    float i = floor(h);
    float f = h - i;
    float p = v * (1.0 - s);
    float q = v * (1.0 - s * f);
    float t = v * (1.0 - s * (1.0 - f));
    i = mod(i, 6.0);
    if (i < 1.0) return vec3(v, t, p);
    if (i < 2.0) return vec3(q, v, p);
    if (i < 3.0) return vec3(p, v, t);
    if (i < 4.0) return vec3(p, q, v);
    if (i < 5.0) return vec3(t, p, v);
    return vec3(v, p, q);
}

// BlendMode.Hue: take hue from src, sat+val from dst.
vec3 blendHue(vec3 dst, vec3 src) {
    vec3 dh = rgb2hsv(dst);
    vec3 sh = rgb2hsv(src);
    return hsv2rgb(vec3(sh.x, dh.y, dh.z));
}
`}(e);return`
precision highp float;

${n}

${i}

${o}

${t}

void main() {
    // gl_FragCoord origin is bottom-left in WebGL; flip to top-left.
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    // Content scale (non-uniform): when < 1.0, compress the backdrop UV toward
    // the element center. Faithful to LiquidToggle.kt / LiquidSlider.kt:
    //   scale(scaleX, scaleY) { drawBackdrop() }
    // At rest (progress=0), Y scale = 0 → degenerate (single horizontal line),
    // but the white overlay hides it. When pressed, scales to full.
    vec2 contentScale = vec2(uContentScaleX, uContentScaleY);
    vec2 sampleCoord = screenCoord;
    if (uContentScaleX < 0.999 || uContentScaleY < 0.999) {
        vec2 elementCenter = uElementOffset + uElementSize * 0.5;
        sampleCoord = elementCenter + (screenCoord - elementCenter) * contentScale;
    }

    // --- ORIGINAL-SPACE SDF (faithful to graphicsLayer { scaleX, scaleY }) ---
    // The original applies the refraction shader at the ORIGINAL element size,
    // THEN scales the entire rendered layer by (scaleX, scaleY). To replicate
    // this in a single-pass shader, we:
    //   1. Compute the centered coord in SCREEN space (relative to element center)
    //   2. Divide by uLayerScale to map back to ORIGINAL space
    //   3. Compute SDF/refraction in ORIGINAL space (shape is correct, not stretched)
    //   4. Map the refraction offset back to SCREEN space for backdrop sampling
    //      (offset_screen = offset_orig * uLayerScale)
    //
    // elementCenter is the SAME for scaled and original rects (scaling is around
    // the center), so uElementOffset + uElementSize*0.5 gives the correct center.
    vec2 elementCenter = uElementOffset + uElementSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    // Map to original space (guard against divide-by-zero).
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    // Apply element rotation (graphicsLayer rotationZ). Un-rotate the sample
    // coord into the element's local space so the SDF shape appears rotated
    // by +rotation. The layer is rotated AFTER shading, so we shade in local
    // (un-rotated) space. Refraction offsets computed in local space are
    // rotated BACK to screen space (by +rotation) before sampling the backdrop.
    float rot = uElementRotation;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -rot);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // --- SDF-texture glass path (faithful to SdfShader.kt) ---
    if (uUseSdfTexture > 0.5) {
        vec2 localPx = centeredOrigRot + uOriginalSize * 0.5;
        vec4 sdfData = sampleSdfTexture(localPx);
        if (sdfData.y <= 0.0) discard;
        float intensity = sdfData.x;
        float sdfMask = sdfData.y;
        vec2 normal = sdfData.zw;

        // Sample the WALLPAPER directly (not the scene FBO) — faithful to
        // LockScreenContent.kt's drawPlainBackdrop which uses the LayerBackdrop
        // (raw wallpaper, before the dark scrim is drawn).
        // The original applies blur(2dp) BEFORE the SDF shader (in the effects
        // block), so 'content' (the SDF shader's input) is already blurred.
        // We replicate by sampling the wallpaper with a 9-tap poisson blur at
        // the refracted coordinate.
        vec2 refractedOffsetOrig = intensity * uRefractionHeight * normal;
        vec2 refractedOffsetScreen = refractedOffsetOrig * layerScale;
        vec2 refractedScreen = screenCoord - refractedOffsetScreen;

        // Faithful to SdfShader.kt: color = content.eval(refractedCoord) * v.a
        // The content is the wallpaper after colorControls + blur(2dp).
        // FAITHFUL ORDERING: the original's onDrawBackdrop draws the wallpaper
        // AND drawRect(White 0.25) into the same buffer, THEN applies the
        // RenderEffect chain (colorControls, blur, SDF shader). So the white
        // overlay is PART of the SDF shader content input, and colorControls
        // is applied to the COMBINED (wallpaper + white) buffer.
        // We replicate: mix white into raw wallpaper FIRST, then apply
        // colorControls — so colorControls darkens the white too (matching
        // the original where contrast=0.75, brightness=-0.1 dims the white).
        vec4 content = sampleWallpaperBlurred(refractedScreen, uBlurRadius);
        vec3 rawContent = content.rgb;
        // Mix in white overlay (White 0.25 SrcOver) on RAW wallpaper first.
        if (uSurfaceColor.a > 0.001) {
            rawContent = uSurfaceColor.rgb * uSurfaceColor.a + rawContent * (1.0 - uSurfaceColor.a);
        }
        // THEN apply colorControls to the combined buffer.
        vec3 contentColor = applyColorControls(rawContent, uBrightness, uContrast, uSaturation);
        // Multiply by sdfMask (v.a) — faithful to content * v.a.
        vec3 color = contentColor * sdfMask;

        // Bevel lighting
        float angleRad = uSdfLightAngle * 3.1415926 / 180.0;
        vec2 lightDir = vec2(cos(angleRad), sin(angleRad));
        float bevel1 = clamp(dot(normal, lightDir), 0.0, 1.0);
        color.rgb *= 1.0 + 0.5 * intensity * bevel1;
        float bevel2 = clamp(dot(normal, -lightDir), 0.0, 1.0);
        color.rgb *= 1.0 + 0.5 * bevel2 * min(1.0, smoothstep(1.0, 0.0, abs(intensity - 0.25) * 6.0));

        gl_FragColor = vec4(color, sdfMask * uEnterAlpha);
        return;
    }

    // SDF for refraction/highlight — always analytic sdRoundedRect.
    float sd = sdShape(centeredOrigRot, origHalfSize, origRadius);
    // Clip + edgeAA: alpha mask (browser-native AA) when capsule enabled.
    float edgeAlpha;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredOrigRot, origHalfSize, origRadius);
        if (mask < 0.01) discard;
        edgeAlpha = mask;
    } else {
        if (sd > 0.5) discard;
        edgeAlpha = 1.0 - smoothstep(-0.5, 0.5, sd);
    }

    // --- 1. Backdrop sample (before refraction) -------------------
    // Use sampleCoord (content-scaled) so the backdrop shrinks inward when
    // uContentScaleX/Y < 1.0 (toggle/slider knob press effect).
    vec4 backdrop;
    if (uIndicatorBackdrop > 0.5) {
        backdrop = sampleIndicatorBackdrop(screenCoord, uBlurRadius);
    } else if (uUseToggleBackdrop > 0.5) {
        backdrop = sampleToggleBackdrop(screenCoord, uBlurRadius);
    } else if (uUseMagnifier > 0.5) {
        backdrop = sampleMagnifier(screenCoord, uBlurRadius);
    } else {
        backdrop = sampleBackdrop(sampleCoord, uBlurRadius);
    }
    // colorControls: for backdropFbo+useSeparableBlur elements, cc was already
    // applied as a fullscreen pass BEFORE the 2-pass blur (uSkipColorControls=1),
    // matching the original's colorControls→blur order. Skip here to avoid
    // double-applying. For inline-blur elements, apply here.
    vec3 color = (uSkipColorControls > 0.5) ? backdrop.rgb : applyColorControls(backdrop.rgb, uBrightness, uContrast, uSaturation);
    // Magnifier glass is always OPAQUE — faithful to the original which
    // samples rememberCombinedBackdrop (wallpaper + content + cursor all
    // composited onto the opaque wallpaper). The port's scene texture may
    // carry partial alpha (e.g. card 0.9), which would make the glass
    // translucent. Force alpha=1 for magnifier.
    float alpha = (uUseMagnifier > 0.5) ? 1.0 : backdrop.a;

    // --- 2. Lens refraction (SDF + circleMap) ---------------------
    // Faithful port of RoundedRectRefractionWithDispersionShaderString.
    // SDF/grad computed in ORIGINAL space; uRefractionHeight/Amount are in
    // original px (NOT scaled by layerScale — the original AGSL shader receives
    // the original size and the graphicsLayer scales the OUTPUT, not the params).
    // Early-out: if we're deeper than refractionHeight from the edge,
    // skip refraction entirely (the lens doesn't reach here).
    if (uRefractionHeight > 0.5 && (-sd) < uRefractionHeight) {
        float sdClamped = min(sd, 0.0);
        float d = circleMap(1.0 - (-sdClamped) / uRefractionHeight) * uRefractionAmount;

        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        // AGSL: normalize(grad + depthEffect * normalize(centeredCoord))
        vec2 depthVec = vec2(0.0);
        if (uDepthEffect > 0.5) {
            float dirLen = length(centeredOrigRot);
            if (dirLen > 1e-6) depthVec = centeredOrigRot / dirLen;
        }
        vec2 gradSum = grad + uDepthEffect * depthVec;
        float gradLen = length(gradSum);
        if (gradLen > 1e-6) grad = gradSum / gradLen;

        // Refraction offset in ORIGINAL space, then map to SCREEN space.
        //   offset_orig = d * grad          (original px)
        //   offset_screen = offset_orig * layerScale  (screen px, for sampling)
        // Faithful to: AGSL computes offset in original space, then graphicsLayer
        // scales the rendered output — so a pixel at original position p samples
        // the backdrop at p + offset_orig, and the result appears at screen
        // position center + p*layerScale. The backdrop sample position in screen
        // space is therefore center + (p + offset_orig)*layerScale
        // = screenCoord + offset_orig * layerScale.
        vec2 refractedOffsetOrig = d * grad;
        // Rotate the local-space offset BACK to screen space (by +rotation),
        // then scale by layerScale. Without the rotation, refraction points
        // in the wrong direction when the element is rotated.
        vec2 refractedOffsetScreen = rotateBy(refractedOffsetOrig, rot) * layerScale;
        vec2 refractedScreen = screenCoord + refractedOffsetScreen;
        vec2 refractedSampleCoord = refractedScreen;
        if (uIndicatorBackdrop < 0.5 && uUseToggleBackdrop < 0.5 &&
            (uContentScaleX < 0.999 || uContentScaleY < 0.999)) {
            refractedSampleCoord = elementCenter + (refractedScreen - elementCenter) * contentScale;
        }

        if (uChromaticAberration > 0.5) {
            // Faithful 7-path chromatic dispersion (ROYGBV + purple).
            // Original AGSL: dispersionIntensity = chromaticAberration * (cx*cy)/(hx*hy)
            //                dispersedCoord = d * grad * dispersionIntensity
            // 7 samples at dispersedCoord * {1, 2/3, 1/3, 0, -1/3, -2/3, -1}
            // with weighted channel accumulation.
            float dispersionIntensity = 1.0 * ((centeredOrigRot.x * centeredOrigRot.y) / (origHalfSize.x * origHalfSize.y));
            vec2 dispersedOffsetOrig = refractedOffsetOrig * dispersionIntensity;
            vec2 dispersedOffsetScreen = rotateBy(dispersedOffsetOrig, rot) * layerScale;

            // Sample helper — pick the right backdrop sampler.
            #define SAMPLE_DISPERSED(offset) \
                (uIndicatorBackdrop > 0.5 ? sampleIndicatorBackdrop(refractedScreen + (offset), uBlurRadius) : \
                 uUseToggleBackdrop > 0.5 ? sampleToggleBackdrop(refractedScreen + (offset), uBlurRadius) : \
                 uUseMagnifier > 0.5 ? sampleMagnifier(refractedScreen + (offset), uBlurRadius) : \
                 sampleBackdrop(refractedSampleCoord + (offset), uBlurRadius))

            vec4 sRed    = SAMPLE_DISPERSED(+dispersedOffsetScreen);
            vec4 sOrange = SAMPLE_DISPERSED(+dispersedOffsetScreen * (2.0 / 3.0));
            vec4 sYellow = SAMPLE_DISPERSED(+dispersedOffsetScreen * (1.0 / 3.0));
            vec4 sGreen  = SAMPLE_DISPERSED(vec2(0.0));
            vec4 sCyan   = SAMPLE_DISPERSED(-dispersedOffsetScreen * (1.0 / 3.0));
            vec4 sBlue   = SAMPLE_DISPERSED(-dispersedOffsetScreen * (2.0 / 3.0));
            vec4 sPurple = SAMPLE_DISPERSED(-dispersedOffsetScreen);

            #undef SAMPLE_DISPERSED

            // Faithful channel weighting from the original AGSL shader.
            vec3 dispColor = vec3(0.0);
            float dispAlpha = 0.0;
            // red
            dispColor.r += sRed.r / 3.5;
            dispAlpha  += sRed.a / 7.0;
            // orange
            dispColor.r += sOrange.r / 3.5;
            dispColor.g += sOrange.g / 7.0;
            dispAlpha  += sOrange.a / 7.0;
            // yellow
            dispColor.r += sYellow.r / 3.5;
            dispColor.g += sYellow.g / 3.5;
            dispAlpha  += sYellow.a / 7.0;
            // green
            dispColor.g += sGreen.g / 3.5;
            dispAlpha  += sGreen.a / 7.0;
            // cyan
            dispColor.g += sCyan.g / 3.5;
            dispColor.b += sCyan.b / 3.0;
            dispAlpha  += sCyan.a / 7.0;
            // blue
            dispColor.b += sBlue.b / 3.0;
            dispAlpha  += sBlue.a / 7.0;
            // purple
            dispColor.r += sPurple.r / 7.0;
            dispColor.b += sPurple.b / 3.0;
            dispAlpha  += sPurple.a / 7.0;

            color = (uSkipColorControls > 0.5) ? dispColor : applyColorControls(dispColor, uBrightness, uContrast, uSaturation);
            // Magnifier chromatic aberration also forces opaque.
            alpha = (uUseMagnifier > 0.5) ? 1.0 : dispAlpha;
        } else {
            vec4 refracted;
            if (uIndicatorBackdrop > 0.5) {
                refracted = sampleIndicatorBackdrop(refractedScreen, uBlurRadius);
            } else if (uUseToggleBackdrop > 0.5) {
                refracted = sampleToggleBackdrop(refractedScreen, uBlurRadius);
            } else if (uUseMagnifier > 0.5) {
                refracted = sampleMagnifier(refractedScreen, uBlurRadius);
            } else {
                refracted = sampleBackdrop(refractedSampleCoord, uBlurRadius);
            }
            color = (uSkipColorControls > 0.5) ? refracted.rgb : applyColorControls(refracted.rgb, uBrightness, uContrast, uSaturation);
            // Magnifier refraction also forces opaque (see backdrop sample above).
            alpha = (uUseMagnifier > 0.5) ? 1.0 : refracted.a;
        }
    }

    // --- 3. onDrawSurface: tint (BlendMode.Hue + 0.75 alpha) -----
    // Faithful port of LiquidButton.kt onDrawSurface:
    //   drawRect(tint, blendMode = BlendMode.Hue)
    //   drawRect(tint.copy(alpha = 0.75f))
    // First pass: replace backdrop hue with tint hue (Hue blend, alpha = tint.a).
    // Second pass: overlay tint color at 0.75*alpha (SrcOver blend).
    if (uTintColor.a > 0.001) {
        vec3 hueBlended = blendHue(color, uTintColor.rgb);
        color = mix(color, hueBlended, uTintColor.a);
        color = mix(color, uTintColor.rgb, 0.75 * uTintColor.a);
    }

    // --- 4. onDrawSurface: surfaceColor (drawRect(surfaceColor)) --
    if (uSurfaceColor.a > 0.001) {
        color = mix(color, uSurfaceColor.rgb, uSurfaceColor.a);
    }

    // --- 5. Highlight (edge specular) -----------------------------
    // NOTE: The rim highlight is drawn as a SEPARATE pass (see
    // RIM_HIGHLIGHT_FRAGMENT_SHADER) with true Plus/SrcOver blend,
    // matching the original HighlightModifier.kt which records a separate
    // graphics layer. Doing it inline here would dim the highlight via the
    // element's edge AA, which is wrong — the highlight layer is composited
    // on top with its own blend mode.

    // --- 7. Edge anti-aliasing -----------------------------------
    // edgeAlpha was computed earlier (mask mode: direct coverage, analytic: smoothstep).
    gl_FragColor = vec4(color, alpha * edgeAlpha * uEnterAlpha);
}
`}(16),u=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uElementOffset;   // SCALED rect top-left (where the quad is drawn)
uniform vec2  uElementSize;     // SCALED size (includes graphicsLayer scale)
uniform vec4  uCornerRadii;     // SCALED corner radii
uniform float uShadowRadius;    // ORIGINAL px (NOT scaled — faithful to BlurMaskFilter at original size)
uniform vec2  uShadowOffset;    // ORIGINAL px (offsetX, offsetY; +Y = downward)
uniform vec4  uShadowColor;     // rgba
// --- ORIGINAL-SPACE SDF (faithful to graphicsLayer { scaleX, scaleY }) ---
// Same approach as the element shader: compute the shadow SDF in ORIGINAL
// space (shape is a correct capsule, not stretched), then the graphicsLayer
// scales the entire shadow layer by (scaleX, scaleY). The shadow offset is
// in ORIGINAL px; we multiply by uLayerScale to map it to screen space for
// the SDF evaluation (offset_screen = offset_orig * layerScale). The shadow
// radius (blur sigma) stays in ORIGINAL px because the Gaussian falloff is
// computed in original space — the graphicsLayer then stretches the blurred
// result, which is the faithful behavior (BlurMaskFilter blurs at original
// resolution, then graphicsLayer scales the blurred pixels).
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer
uniform float uElementRotation;     // rotation in radians (graphicsLayer rotationZ)

${i}

void main() {
    // Flip gl_FragCoord (bottom-left origin) to top-left origin, so +Y
    // points downward — matching CSS convention.
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    // elementCenter is the SAME for scaled and original rects (scaling is
    // around the center), so uElementOffset + uElementSize*0.5 gives the
    // correct center.
    vec2 elementCenter = uElementOffset + uElementSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    // Map to ORIGINAL space (guard against divide-by-zero).
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    // Un-rotate into local space so the shadow shape rotates with the element.
    // Also rotate the shadow offset into local space so it stays consistent.
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);
    vec2 shadowOffsetRot = rotateBy(uShadowOffset, -uElementRotation);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // Shadow offset: defined in ORIGINAL px, applied in screen space.
    // The original draws the shadow at original size with this offset, then
    // graphicsLayer scales the whole layer — so the offset effectively
    // becomes offset_orig * layerScale in screen space. We map it back to
    // original space for the SDF: offset_orig = offset_screen / layerScale,
    // which cancels — so we use uShadowOffset directly in original space.
    vec2 shadowCenteredOrig = centeredOrigRot - shadowOffsetRot;
    float sd = sdShape(shadowCenteredOrig, origHalfSize, origRadius);
    // SDF of the element itself (not offset) — used to mask the shadow
    // inside the element so it doesn't bleed through the AA edge.
    float elementSd = sdShape(centeredOrigRot, origHalfSize, origRadius);

    // Shadow intensity: Gaussian falloff from the shadow shape's edge.
    // uShadowRadius is in ORIGINAL px (faithful to BlurMaskFilter at original
    // size). sigma = radius/3 matches the BlurMaskFilter spread.
    float sigma = max(uShadowRadius / 3.0, 1.0);
    float shadow = 0.5 * exp(-sd * sd / (2.0 * sigma * sigma));
    // Mask out the shadow inside the element (the element covers it).
    shadow *= smoothstep(-1.0, 1.0, elementSd);

    gl_FragColor = vec4(uShadowColor.rgb, uShadowColor.a * shadow);
}
`,c=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;       // element top-left in canvas px (top-left origin) — SCALED rect
uniform vec2  uSize;         // element size in canvas px — SCALED
uniform vec4  uCornerRadii;  // capsule radii (topLeft, topRight, bottomRight, bottomLeft) in px — SCALED
uniform vec4  uColor;        // rgba; usually white * (alpha = 0.15 * progress)
uniform float uRadius;       // glow radius in canvas px (= minDim * 1.5, SCALED space)
uniform vec2  uPosition;     // finger position in element-local px (top-left origin, SCALED space)
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
// The press glow (InteractiveHighlight) is drawn INSIDE the graphicsLayer, so
// it is clipped to the ORIGINAL capsule shape, then scaled with the layer.
// The glow position + radius are in SCALED space (they track the finger in
// screen px), but the clip SDF is in original space so the capsule clip stays
// correct when the button is stretched.
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;

    // --- Capsule clip in ORIGINAL space (faithful to graphicsLayer clip) ---
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 origHalfSize = uOriginalSize * 0.5;
    float sd = sdShape(rotateBy(centeredOrig, -uElementRotation), origHalfSize, uOriginalCornerRadius);
    if (sd > 0.5) discard;
    float clipAlpha = 1.0 - smoothstep(-0.5, 0.5, sd);

    // Faithful AGSL port: smoothstep(radius, radius*0.5, dist) means
    // intensity = 1 at dist <= radius*0.5, fading to 0 at dist >= radius.
    // dist + uPosition are in SCALED local space (finger tracks screen px).
    float dist = distance(localCoord, uPosition);
    float intensity = smoothstep(uRadius, uRadius * 0.5, dist);

    // Premultiplied Plus-blend contribution. Renderer uses blendFunc(ONE, ONE)
    // so result.rgb = contribution + dst.rgb (clamped to 1).
    vec3 contribution = uColor.rgb * uColor.a * intensity * clipAlpha;
    gl_FragColor = vec4(contribution, 1.0);
}
`,h=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform vec4  uColor;
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
// The white overlay (onDrawSurface drawRect) is drawn INSIDE the graphicsLayer,
// so it is clipped to the ORIGINAL capsule shape, then scaled with the layer.
// Computing the clip SDF in original space keeps the capsule clip correct when
// the button is stretched (no corner bleed, no stretched-clip artifacts).
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 origHalfSize = uOriginalSize * 0.5;
    float sd = sdShape(rotateBy(centeredOrig, -uElementRotation), origHalfSize, uOriginalCornerRadius);
    if (sd > 0.5) discard;
    float clipAlpha = 1.0 - smoothstep(-0.5, 0.5, sd);

    gl_FragColor = vec4(uColor.rgb, uColor.a * clipAlpha);
}
`,d=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;          // element top-left in canvas px (top-left origin) — SCALED rect
uniform vec2  uSize;            // element size in canvas px — SCALED (includes graphicsLayer scale)
uniform vec4  uCornerRadii;     // (topLeft, topRight, bottomRight, bottomLeft) in px — SCALED
uniform vec4  uHighlightColor;  // rgb + 1.0
uniform float uHighlightAngle;  // radians
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;     // 0=Default, 1=Ambient, 2=Plain
uniform float uHighlightStrokeWidth;
uniform float uHighlightBlur;
// --- ORIGINAL-SPACE SDF (faithful to graphicsLayer { scaleX, scaleY }) ---
// Same approach as the element shader: compute SDF/stroke in ORIGINAL space
// (shape is correct, not stretched), so the highlight clip + stroke remain a
// correct capsule shape that is then scaled by graphicsLayer. Without this,
// a horizontally-stretched button would stretch the highlight clip too,
// making the stroke band uneven. See element.ts for the full rationale.
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer
uniform float uElementRotation;     // rotation in radians (graphicsLayer rotationZ)

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    // elementCenter is the SAME for scaled and original rects (scaling is
    // around the center), so uOffset + uSize*0.5 gives the correct center.
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    // Map to ORIGINAL space (guard against divide-by-zero).
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    // Un-rotate into the element's local space so the SDF shape rotates.
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // SDF for stroke — analytic sdRoundedRect (matches the pre-capsule
    // highlight implementation). When capsule is OFF, this is the exact
    // shape. When capsule is ON, this is a close approximation (circular
    // arc vs G2 Bezier — the difference is sub-pixel within the 2px stroke
    // band, invisible in the highlight).
    float sd = sdRoundedRect(centeredOrigRot, origHalfSize, origRadius);

    // Outside the shape — clip (hard discard, matching pre-capsule behavior).
    if (sd > 0.0) discard;

    // Stroke mask — faithful to HighlightModifier.kt:
    //   paint.style = Stroke
    //   paint.strokeWidth = ceil(width.toPx()) * 2     // full stroke, centered on edge
    //   paint.blur(blurRadius.toPx())                   // BlurMaskFilter, Blur.NORMAL
    //   canvas.clipOutline(outline)                     // clip to inside the shape
    //   canvas.drawOutline(outline, paint)              // stroke centered on edge
    //
    // Implementation: first compute a HARD-EDGE stroke mask (1.0 inside the
    // stroke band, 0.0 outside), then convolve it with a Gaussian kernel by
    // sampling the SDF at multiple offsets along the gradient direction.
    // This mirrors the original's two-step process (draw stroke → blur),
    // rather than using an analytic erf approximation.
    //
    // The hard stroke band: sd in [-strokeHalf, +strokeHalf].
    // After clip (sd > 0 discarded by the outer if), only [-strokeHalf, 0] shows.
    //
    // Faithful to the original BlurMaskFilter:
    //   paint.blur(blurRadius.toPx())  →  BlurMaskFilter(NORMAL, sigma=blurRadius_px)
    // In Skia/Android, BlurMaskFilter's radius param IS the Gaussian sigma
    // (not radius/3). blurRadius = width/2 = 0.25dp, so sigma = 0.25*dpr px.
    // uHighlightBlur is already in device px (set by the renderer as widthDp*dpr*0.5).
    float strokeHalf = uHighlightStrokeWidth * 0.5;
    float sigma = max(uHighlightBlur, 0.1);

    // Gaussian convolution of the hard stroke mask — 3-tap (σ-spaced).
    // The original's BlurMaskFilter has σ = blurRadius = 0.25dp → 0.25px at
    // dpr=1. At this sub-pixel sigma, only 3 taps (at -σ, 0, +σ) are needed
    // — the Gaussian weight at \xb12σ is exp(-2) ≈ 0.14, negligible. This
    // replaces the old 65-tap loop (which computed 65 exp() calls per pixel,
    // ~650 cycles — the single biggest shader cost). 3 taps = 3 exp() = ~30
    // cycles, a 20\xd7 reduction with identical visual result at σ=0.25.
    //   hardMask(sd) = 1.0 if |sd| < strokeHalf, else 0.0
    //   blurred(sd) = Σ hardMask(sd - offset_k) * gauss(offset_k, σ)
    // CLIP HALVING: the stroke is centered on sd=0; clip removes sd>0 (outer
    // half), so peak ≈ 0.5. We halve to match.
    float strokeMask = 0.0;
    float wSum = 0.0;
    for (int i = -1; i <= 1; i++) {
        float offset = float(i) * sigma;  // taps at -σ, 0, +σ
        float sampleSd = sd - offset;
        float hard = (abs(sampleSd) < strokeHalf) ? 1.0 : 0.0;
        float w = exp(-0.5 * (offset * offset) / (sigma * sigma));
        strokeMask += hard * w;
        wSum += w;
    }
    strokeMask /= wSum;
    strokeMask *= 0.5;  // clip halves the symmetric stroke at the edge

    if (uHighlightMode < 0.5) {
        // Default — shader returns color * intensity, Plus blend.
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        float d = dot(grad, normal);
        float intensity = pow(abs(d), uHighlightFalloff);
        vec3 c = uHighlightColor.rgb * intensity * strokeMask * uHighlightAlpha;
        gl_FragColor = vec4(c, 1.0);
    } else if (uHighlightMode < 1.5) {
        // Ambient — premultiplied SrcOver blend (renderer uses ONE, ONE_MINUS_SRC_ALPHA).
        // Faithful to AmbientHighlightShaderString:
        //   float d = dot(grad, normal);
        //   float intensity = pow(abs(d), falloff);
        //   float t = step(0.0, d);  ← half-black-half-white split
        //   return half4(t, t, t, 1.0) * intensity;
        // Output is premultiplied: vec4(color.rgb * t * i, i).
        // Bright side: adds white light. Dark side: dims scene → 3D sphere.
        // paint.color(0.38) is overridden by shader; alpha = 1.0 not 0.38.
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        float d = dot(grad, normal);
        float intensity = pow(abs(d), uHighlightFalloff);
        float t = step(0.0, d);  // 0 on dark side (d<0), 1 on bright side (d>=0)
        float i = intensity * strokeMask * uHighlightAlpha;
        gl_FragColor = vec4(uHighlightColor.rgb * t * i, i);
    } else {
        // Plain — even stroke, paint.color, Plus blend.
        vec3 c = uHighlightColor.rgb * strokeMask * uHighlightAlpha;
        gl_FragColor = vec4(c, 1.0);
    }
}
`,f=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;          // element top-left (top-left origin) — SCALED
uniform vec2  uSize;            // element size — SCALED
uniform vec4  uCornerRadii;     // SCALED
uniform float uHighlightStrokeWidth;  // ceil(width*dpr)*2, device px
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;
// uCornerStyle, uUseContinuousSdf, uContinuousSdf, uContinuousSdfTexSize,
// uContinuousSdfElementSize are declared in SDF_GLSL (do NOT redeclare here).

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    float sd = sdShape(centeredOrigRot, origHalfSize, origRadius);

    // clipOutline — clip to INSIDE the shape. Outside (sd > 0) is discarded.
    float edgeAA;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredOrigRot, origHalfSize, origRadius);
        if (mask < 0.01) discard;
        edgeAA = mask;
    } else {
        if (sd > 0.0) discard;
        edgeAA = 1.0 - smoothstep(-0.5, 0.5, sd);
    }

    // Stroke band centered on the edge (sd = 0), with 0.5px coverage AA on
    // the inner boundary. The outer boundary (sd = +strokeHalf) is clipped
    // away by edgeAA above. Faithful to Skia Paint.Stroke's coverage AA.
    // The BlurMaskFilter pass (when sigma >= 0.5px) softens this further;
    // at sub-pixel sigma (0.25px) the blur is skipped and this 0.5px AA
    // is what matches the original's look (Skia's 0.25px blur is negligibly
    // soft — essentially just AA).
    float strokeHalf = uHighlightStrokeWidth * 0.5;
    float strokeAA = 1.0 - smoothstep(strokeHalf - 0.5, strokeHalf, abs(sd));

    gl_FragColor = vec4(0.0, 0.0, 0.0, strokeAA * edgeAA);
}
`,g=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform sampler2D uBlurredMask;   // the 2-pass-blurred stroke mask FBO
uniform vec2  uMaskTexSize;       // size of the mask FBO (= canvas size)
uniform vec4  uHighlightColor;    // rgb + 1.0
uniform float uHighlightAngle;
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;     // 0=Default, 1=Ambient, 2=Plain
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;
// uCornerStyle, uUseContinuousSdf, uContinuousSdf, uContinuousSdfTexSize,
// uContinuousSdfElementSize are declared in SDF_GLSL (do NOT redeclare here).

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);

    // Sample the blurred stroke mask at this pixel. The mask FBO covers the
    // full canvas (same size), so UV = gl_FragCoord / maskTexSize.
    // Mask FBO is Y-down (top-left origin, like our scene FBOs), so flip Y
    // to match the screenCoord convention.
    vec2 maskUv = vec2(gl_FragCoord.x / uMaskTexSize.x, gl_FragCoord.y / uMaskTexSize.y);
    float mask = texture2D(uBlurredMask, maskUv).a;
    if (mask < 0.001) discard;

    // Compute intensity from the SDF gradient (AGSL DefaultHighlightShaderString).
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);
    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // Faithful clip-after-blur: the original does clipOutline → stroke(blur),
    // but Skia applies clip at the canvas level AFTER the BlurMaskFilter
    // spreads alpha. So alpha that blurred OUTSIDE the shape is clipped away.
    // Our stroke shader clips before blur (discard sd>0), then blur spreads
    // alpha back outside — we must clip AGAIN here to match. Without this,
    // the highlight "leaks" outside the shape, making it brighter than the
    // original (which has zero contribution outside the clip region).
    float sd = sdShape(centeredOrigRot, origHalfSize, origRadius);
    float clipAA;
    if (uUseContinuousSdf > 0.5) {
        clipAA = sampleClipMask(centeredOrigRot, origHalfSize, origRadius);
    } else {
        clipAA = 1.0 - smoothstep(-0.5, 0.5, sd);
    }
    mask *= clipAA;
    if (mask < 0.001) discard;

    // Compute d (with sign) for Default + Ambient modes — needed for
    // Ambient's step(0,d) half-black-half-white split.
    float d = 0.0;  // signed dot(grad, normal) — 0 for Plain mode
    float intensity;
    if (uHighlightMode < 1.5) {
        // Default + Ambient use the SDF gradient \xb7 normal.
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        d = dot(grad, normal);
        intensity = pow(abs(d), uHighlightFalloff);
    } else {
        // Plain — no directional intensity (even stroke).
        intensity = 1.0;
    }

    float a = mask * uHighlightAlpha;

    if (uHighlightMode < 0.5) {
        // Default — Plus blend. Output premultiplied rgb (alpha=1 so blendFunc
        // (ONE, ONE) adds rgb directly).
        vec3 c = uHighlightColor.rgb * intensity * a;
        gl_FragColor = vec4(c, 1.0);
    } else if (uHighlightMode < 1.5) {
        // Ambient — PREMULTIPLIED SrcOver blend (renderer uses ONE, ONE_MINUS_SRC_ALPHA).
        // Faithful to AmbientHighlightShaderString:
        //   float t = step(0.0, d);  ← half-black-half-white split
        // Bright side (d>=0): t=1 → white highlight. Dark side (d<0): t=0 →
        // black overlay that reduces scene brightness via premultiplied SrcOver → 3D sphere.
        // Output is premultiplied: vec4(color.rgb * t * i, i).
        // IMPORTANT: paint.color = White(0.38) is overridden by the shader.
        // The 0.38 does NOT scale the output; layer alpha (Highlight.alpha) is the
        // only modulation. For Ambient highlight, alpha = 1.0 (not 0.38).
        float t = step(0.0, d);
        float i = intensity * a;
        gl_FragColor = vec4(uHighlightColor.rgb * t * i, i);
    } else {
        // Plain — Plus blend, no intensity.
        vec3 c = uHighlightColor.rgb * a;
        gl_FragColor = vec4(c, 1.0);
    }
}
`,p=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform sampler2D uStrokeMask;
uniform vec2  uMaskOffset;
uniform vec2  uMaskSize;
uniform vec4  uHighlightColor;
uniform float uHighlightAngle;
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);

    // Map screen coord → element-local ORIGINAL space (un-scale, un-rotate).
    // The stroke mask is drawn in original space (origSizeX \xd7 origSizeY + margin).
    // elementCenter is the same in scaled and original space (scaling is around center).
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    // Mask UV: map original-space coord → mask texture UV.
    // The mask was drawn with translate(margin, margin), so mask (0,0) =
    // element-local (-margin). Element-local coord 0..origSize maps to
    // mask UV (0+margin)/maskSize .. (origSize+margin)/maskSize.
    // uMaskOffset = margin (scalar, passed as vec2 for convenience).
    // uMaskSize = (origSize + 2*margin).
    vec2 origHalfSize = uOriginalSize * 0.5;
    vec2 maskTexCoord = centeredOrigRot + origHalfSize;  // 0..origSize (element-local)
    vec2 maskUv = (maskTexCoord + uMaskOffset) / uMaskSize;
    if (maskUv.x < 0.0 || maskUv.x > 1.0 || maskUv.y < 0.0 || maskUv.y > 1.0) discard;
    float mask = texture2D(uStrokeMask, maskUv).a;
    if (mask < 0.001) discard;

    float origRadius = uOriginalCornerRadius;

    // Compute d (with sign) for Default + Ambient modes — needed for
    // Ambient's step(0,d) half-black-half-white split.
    float d = 0.0;  // signed dot(grad, normal) — 0 for Plain mode
    float intensity;
    if (uHighlightMode < 1.5) {
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        d = dot(grad, normal);
        intensity = pow(abs(d), uHighlightFalloff);
    } else {
        intensity = 1.0;
    }

    float a = mask * uHighlightAlpha;
    if (uHighlightMode < 0.5) {
        gl_FragColor = vec4(uHighlightColor.rgb * intensity * a, 1.0);
    } else if (uHighlightMode < 1.5) {
        // Ambient — premultiplied SrcOver (renderer uses ONE, ONE_MINUS_SRC_ALPHA).
        // Faithful to AmbientHighlightShaderString:
        //   float t = step(0.0, d);  ← bright/dark split
        // Bright side: t=1 → white highlight. Dark side: t=0 → dims scene.
        // Output is premultiplied: vec4(color.rgb * t * i, i).
        // paint.color(0.38) is overridden by shader; alpha should be 1.0 not 0.38.
        float t = step(0.0, d);
        float i = intensity * a;
        gl_FragColor = vec4(uHighlightColor.rgb * t * i, i);
    } else {
        gl_FragColor = vec4(uHighlightColor.rgb * a, 1.0);
    }
}
`,m=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;           // element top-left in canvas px (top-left origin) — SCALED rect
uniform vec2  uSize;             // element size in canvas px — SCALED
uniform vec4  uCornerRadii;      // (topLeft, topRight, bottomRight, bottomLeft) — SCALED
uniform sampler2D uInnerShadowMask; // Canvas2D-generated blurred ring mask
uniform vec2  uMaskOffset;       // margin in device px (for UV mapping: element-local → mask UV)
uniform vec2  uMaskSize;         // total mask size in device px (w+2*margin, h+2*margin)
uniform vec3  uInnerShadowColor; // shadow color RGB
uniform float uInnerShadowAlpha; // shadow alpha
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer
uniform float uElementRotation;     // rotation in radians (graphicsLayer rotationZ)

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);

    // Map screen coord → element-local ORIGINAL space (un-scale, un-rotate).
    // The inner shadow mask is drawn in original space (origSize + margin).
    // elementCenter is the same in scaled and original space (scaling is
    // around center).
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    // SDF for shape clip — faithful to InnerShadowModifier.kt's final
    // clipOutline call before drawLayer. The original uses Skia's
    // geometric clip with smooth AA (sub-pixel transition).
    // We replicate with smoothstep — NO hard discard.
    vec2 origHalfSize = uOriginalSize * 0.5;
    float sd = sdShape(centeredOrigRot, origHalfSize, uOriginalCornerRadius);

    // Smooth clipAlpha: 1.0 fully inside (sd ≤ 0), smoothly fading
    // across the boundary (sd 0→1.5), 0.0 outside (sd ≥ 1.5).
    // The 1.5px transition width matches Skia's clipOutline AA behavior
    // — pixels at the exact boundary (sd=0) retain FULL intensity, with
    // a gentle fade that removes outward blur leakage smoothly.
    // This is NOT a hard discard — it's a smooth clip that matches the
    // original's geometric clipOutline exactly.
    float clipAlpha = 1.0 - smoothstep(0.0, 1.5, sd);

    // Skip truly invisible pixels for performance (not a visual clip)
    if (clipAlpha < 0.004) discard;

    // Map to mask UV: original-space coord → mask texture UV.
    vec2 maskTexCoord = centeredOrigRot + origHalfSize;  // 0..origSize (element-local)
    vec2 maskUv = (maskTexCoord + uMaskOffset) / uMaskSize;

    // Sample the mask texture. CLAMP_TO_EDGE wrapping handles UV values
    // slightly outside (0..1) gracefully — returns transparent at edges.
    float mask = texture2D(uInnerShadowMask, maskUv).a;

    // Skip truly invisible pixels for performance (not a visual clip)
    // Threshold is very low to avoid cutting off faint but visible shadow edges.
    if (mask < 0.003) discard;

    // Premultiplied SrcOver composite: shadowColor \xd7 mask \xd7 shadowAlpha \xd7 clipAlpha.
    // clipAlpha provides smooth shape-boundary transition (faithful to original's
    // clipOutline AA). Output is premultiplied (rgb = color * alpha).
    // Renderer uses gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA) — premultiplied SrcOver.
    float a = mask * uInnerShadowAlpha * clipAlpha;
    gl_FragColor = vec4(uInnerShadowColor * a, a);
}
`,b=`
attribute vec2 aPos;
void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`,S=`
precision highp float;

uniform sampler2D uBackdrop;
uniform vec2 uCanvasSize;
uniform vec2 uWallpaperSize;

${o}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 uv = coverUv(screenCoord);
    gl_FragColor = texture2D(uBackdrop, uv);
}
`,v=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uCanvasSize;

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uCanvasSize.x, gl_FragCoord.y / uCanvasSize.y);
    gl_FragColor = texture2D(uTexture, uv);
}
`,x=`
precision highp float;

uniform vec4 uColor;

void main() {
    gl_FragColor = uColor;
}
`,C=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uTexSize;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uTexSize.x, gl_FragCoord.y / uTexSize.y);
    vec4 c = texture2D(uTexture, uv);
    float invSat = 1.0 - uSaturation;
    float r = 0.213 * invSat;
    float g = 0.715 * invSat;
    float b = 0.072 * invSat;
    float t = (0.5 - uContrast * 0.5 + uBrightness);
    float cs = uContrast * uSaturation;
    float cr = uContrast * r;
    float cg = uContrast * g;
    float cb = uContrast * b;
    vec3 outc;
    outc.r = (cr + cs) * c.r + cg * c.g + cb * c.b + t;
    outc.g = cr * c.r + (cg + cs) * c.g + cb * c.b + t;
    outc.b = cr * c.r + cg * c.g + (cb + cs) * c.b + t;
    gl_FragColor = vec4(outc, c.a);
}
`,T=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uCanvasSize;
uniform vec3 uTintColor;   // rgb 0..1 (accentColor)

// ColorFilter.tint(color, blendMode = BlendMode.SrcIn):
//   result.rgb = src.rgb (the tint color)
//   result.a   = dst.a * src.a
// SrcIn replaces the destination's RGB with the tint color while
// preserving its alpha — opaque content becomes solid tint, transparent
// areas stay transparent. This matches Compose's ColorFilter.tint default.
void main() {
    vec2 uv = vec2(gl_FragCoord.x / uCanvasSize.x, gl_FragCoord.y / uCanvasSize.y);
    vec4 src = texture2D(uTexture, uv);
    gl_FragColor = vec4(uTintColor, src.a);
}
`,y=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uCanvasSize;
uniform vec2 uOffset;   // foreground texture top-left in canvas px (top-left origin) — SCALED rect
uniform vec2 uSize;     // foreground texture size in canvas px — SCALED
uniform vec4 uCornerRadii;  // capsule radii (topLeft, topRight, bottomRight, bottomLeft) in px — SCALED
uniform float uAlpha;   // global alpha multiplier (used for press fade)
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
// The original wraps everything (text included) in a graphicsLayer clipped to
// the capsule shape, THEN scales the layer. So the clip shape is the ORIGINAL
// capsule, not the stretched one. We compute the clip SDF in original space so
// a stretched button keeps correct capsule clipping (no corner bleed). The
// texture UV still uses the scaled rect (uOffset/uSize) since the foreground
// texture is rendered at the element's scaled on-screen size.
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer

${i}

void main() {
    // gl_FragCoord is bottom-left origin in WebGL framebuffer space.
    // Flip Y to get top-left origin (matching CSS / 2D canvas convention).
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;
    // Scissor to the (scaled) foreground rectangle.
    if (localCoord.x < 0.0 || localCoord.x > uSize.x ||
        localCoord.y < 0.0 || localCoord.y > uSize.y) {
        discard;
    }

    // --- Capsule clip in ORIGINAL space (faithful to graphicsLayer clip) ---
    // elementCenter is the SAME for scaled and original rects (scaling is
    // around the center). Map screen coord → original space for the SDF so
    // the clip shape is the original capsule, not the stretched one.
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 origHalfSize = uOriginalSize * 0.5;
    float clipAlpha;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredOrig, origHalfSize, uOriginalCornerRadius);
        if (mask < 0.01) discard;
        clipAlpha = mask;
    } else {
        float sdClip = sdClipShape(centeredOrig, origHalfSize, uOriginalCornerRadius);
        if (sdClip > 0.5) discard;
        clipAlpha = 1.0 - smoothstep(-0.5, 0.5, sdClip);
    }

    // The texture is uploaded from a 2D canvas with UNPACK_FLIP_Y_WEBGL=false,
    // so texture row 0 (= v=0) is the TOP row of the source canvas. Combined
    // with the Y flip above, uv.y=0 corresponds to the top of the button rect
    // (which is what we want — text drawn at the middle of the source canvas
    // appears at the middle of the button).
    //
    // The texture is uploaded with UNPACK_PREMULTIPLY_ALPHA_WEBGL=true, so
    // c is already in premultiplied form (c.rgb <= c.a). We scale both
    // rgb and a by uAlpha * clipAlpha and output premultiplied rgba, paired
    // with blendFunc(ONE, ONE_MINUS_SRC_ALPHA) at the draw site.
    vec2 uv = localCoord / uSize;
    vec4 c = texture2D(uTexture, uv);
    float a = c.a * uAlpha * clipAlpha;
    gl_FragColor = vec4(c.rgb * uAlpha * clipAlpha, a);
}
`,R=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform vec4  uColor;       // rgba (premultiplied not required; alpha used as-is)

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;
    vec2 halfSize = uSize * 0.5;
    vec2 centeredCoord = localCoord - halfSize;

    float radius = radiusAt(centeredCoord, uCornerRadii);
    float alpha;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredCoord, halfSize, radius);
        if (mask < 0.01) discard;
        alpha = mask;
    } else {
        float sdClip = sdClipShape(centeredCoord, halfSize, radius);
        if (sdClip > 0.5) discard;
        alpha = 1.0 - smoothstep(-0.5, 0.5, sdClip);
    }
    gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
}
`,k=`
precision highp float;

uniform sampler2D uBackdrop;
uniform vec2  uCanvasSize;
uniform vec2  uWallpaperSize;
uniform vec2  uOffset;          // band top-left in canvas px (top-left origin)
uniform vec2  uSize;            // band size in canvas px
uniform float uBlurRadius;      // px in canvas space
uniform vec4  uTintColor;       // rgba
uniform float uTintIntensity;   // 0..1

${o}

// 9-tap poisson disc — offsets are inlined because GLSL ES 1.00 (WebGL 1)
// does not support array constructors or const-array initializers.
// The offsets are normalized (unit disc), multiplied by step (radius in UV).
vec4 sampleBackdrop(vec2 canvasPx, float radius) {
    vec2 uvScale = canvasPxToUvScale();
    vec2 uv = coverUv(canvasPx);
    vec2 st = radius * uvScale;
    vec4 sum = vec4(0.0);
    sum += texture2D(uBackdrop, uv + vec2( 0.0000,  0.0000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.5000,  0.0000) * st);
    sum += texture2D(uBackdrop, uv + vec2(-0.5000,  0.0000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.0000,  0.5000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.0000, -0.5000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.3536,  0.3536) * st);
    sum += texture2D(uBackdrop, uv + vec2(-0.3536,  0.3536) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.3536, -0.3536) * st);
    sum += texture2D(uBackdrop, uv + vec2(-0.3536, -0.3536) * st);
    return sum / 9.0;
}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;
    // Outside the band — nothing to draw.
    if (localCoord.x < 0.0 || localCoord.x > uSize.x ||
        localCoord.y < 0.0 || localCoord.y > uSize.y) {
        discard;
    }

    // Alpha mask: opaque at top (coord.y = size.y, i.e. BOTTOM in top-left
    // origin = size.y in AGSL coord), transparent at bottom. Matches the
    // Kotlin smoothstep(size.y, size.y * 0.5, coord.y).
    float a = smoothstep(uSize.y, uSize.y * 0.5, localCoord.y);

    // Sample the (cover-fit) backdrop at the canvas pixel, blurred.
    vec4 blurred = sampleBackdrop(screenCoord, uBlurRadius);

    // Faithful to AlphaMask shader: mix(content * blurAlpha, tint * tintAlpha, tintIntensity)
    // This is PREMULTIPLIED (rgb already scaled by alpha). The renderer uses
    // premultiplied alpha blending for the progressive blur pass, so we output
    // premultiplied rgb with the mask alpha.
    vec3 premulRgb = mix(blurred.rgb * a, uTintColor.rgb * a, uTintIntensity);
    gl_FragColor = vec4(premulRgb, a);
}
`;function w(e,t){let r=function(e){if(e<=1)return[{offset:0,weight:1}];let t=[],r=Math.floor(e/2),a=0;for(let i=0;i<e;i++){let o=(e%2==1?i-r:i-r+.5)/r*3,n=Math.exp(-.5*o*o);t.push({offset:o,weight:n}),a+=n}if(a>0)for(let e of t)e.weight/=a;return t}(e),a="horizontal"===t?"vec2(1.0, 0.0)":"vec2(0.0, 1.0)",i="";if(1===r.length)i=`    gl_FragColor = texture2D(uTexture, uv);
`;else{for(let e of(i=`    vec3 rgbSum = vec3(0.0);
    float rgbW = 0.0;
`,r)){let t=e.offset.toFixed(6),r=e.weight.toFixed(8);i+=`    { vec4 s = texture2D(uTexture, uv + ${a} * ${t} * pxToUv); float aw = s.a * ${r}; rgbSum += s.rgb * aw; rgbW += aw; }
`}i+=`    float origA = texture2D(uTexture, uv).a;
    gl_FragColor = vec4(rgbW > 0.001 ? rgbSum / rgbW : vec3(0.0), origA);
`}return`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uTexSize;
uniform float uRadius;

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uTexSize.x, gl_FragCoord.y / uTexSize.y);
    if (uRadius < 0.5) {
        gl_FragColor = texture2D(uTexture, uv);
        return;
    }
    vec2 pxToUv = vec2(uRadius / uTexSize.x, uRadius / uTexSize.y);
${i}}
`}function A(e,t){let r=function(e){if(e<=1)return[{offset:0,weight:1}];let t=[],r=Math.floor(e/2),a=0;for(let i=0;i<e;i++){let e=i-r,o=Math.exp(-.5*e*e);t.push({offset:e,weight:o}),a+=o}if(a>0)for(let e of t)e.weight/=a;return t}(e),a="horizontal"===t?"vec2(1.0, 0.0)":"vec2(0.0, 1.0)",i="";if(1===r.length)i=`    gl_FragColor = texture2D(uTexture, uv);
`;else{for(let e of(i=`    float aSum = 0.0;
`,r)){let t=e.offset.toFixed(6),r=e.weight.toFixed(8);i+=`    aSum += texture2D(uTexture, uv + ${a} * ${t} * pxToUv).a * ${r};
`}i+=`    gl_FragColor = vec4(0.0, 0.0, 0.0, aSum);
`}return`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uTexSize;
uniform float uRadius;  // Gaussian sigma in pixels (Android BlurMaskFilter semantics)

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uTexSize.x, gl_FragCoord.y / uTexSize.y);
    if (uRadius < 0.01) {
        gl_FragColor = texture2D(uTexture, uv);
        return;
    }
    // pxToUv converts a pixel offset to a UV offset. offset (in σ units) *
    // sigma_px = pixel offset; / uTexSize = UV offset.
    vec2 pxToUv = vec2(uRadius / uTexSize.x, uRadius / uTexSize.y);
${i}}
`}function E(e,t,r){let a=e.createShader(t);if(e.shaderSource(a,r),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(a);throw e.deleteShader(a),Error("Shader compile error: "+t)}return a}function P(e,t,r){let a=E(e,e.VERTEX_SHADER,t),i=E(e,e.FRAGMENT_SHADER,r),o=e.createProgram();if(e.attachShader(o,a),e.attachShader(o,i),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS)){let t=e.getProgramInfoLog(o);throw e.deleteProgram(o),Error("Program link error: "+t)}return o}function M(e,t,r){let a=t.split(/\s+/),i=[],o="";for(let t of a){let a=o?o+" "+t:t;e.measureText(a).width<=r||!o?o=a:(i.push(o),o=t)}return o&&i.push(o),i}function F(e){if(e<=0)return 0;if(e>=1)return 1;let t=e;for(let r=0;r<8;r++){let r=3*(1-t)*(1-t)*t*.42+3*(1-t)*t*t*1+t*t*t,a=3*(1-t)*(1-t)*.42+6*(1-t)*t*.5800000000000001+3*t*t*0;if(.001>Math.abs(r-e)||1e-6>Math.abs(a))break;t-=(r-e)/a,t=Math.max(0,Math.min(1,t))}return 3*(1-t)*(1-t)*t*0+3*(1-t)*t*t*1+t*t*t}function _(e,t,r,a){let i=(3*r/e-t*t/(e*e))/3,o=(2*t*t*t/(e*e*e)-9*t*r/(e*e)+27*a/e)/27,n=Math.sqrt(o*o/4+i*i*i/27);return Math.cbrt(-o/2+n)+Math.cbrt(-o/2-n)-t/(3*e)}class B{extendedFraction;arcFraction;theta;cos;sin;cot;cos2;sin2;cos3;sin3;k0;k1;k2;k3;constructor(e=2/3,t=.5){this.extendedFraction=e,this.arcFraction=t,this.theta=(1-t)*.7853981633974483,this.cos=Math.cos(this.theta),this.sin=Math.sin(this.theta),this.cot=1/Math.tan(this.theta),this.cos2=this.cos*this.cos,this.sin2=this.sin*this.sin,this.cos3=this.cos2*this.cos,this.sin3=this.sin2*this.sin;const r=this.cos,a=this.sin,i=this.cot,o=this.cos2,n=this.sin2,s=this.cos3,l=this.sin3;this.k0=27*(1.4142135623730951-6*r+8.485281374238571*o-4*s)*i+2*a*(-9+2*(1.4142135623730951-2*a)*l+2.8284271247461903*r*(9+n)-2*o*(9+2*n)),this.k1=-81*(-.5857864376269049+4*.41421356237309515*r+-2*.5857864376269049*o)*i-4*a*(3.727922061357857+1.4142135623730951*l+-.5857864376269049*r*(9+n)),this.k2=9*(9*(-4+4.242640687119286+(-6+5.656854249492381)*r)*i+(-6+5.656854249492381)*a),this.k3=27*(10-9.899494936611665)*i}buildEvenCornerBezierPoints(e){let t=this.extendedFraction*e,r=_(this.k3,this.k2,this.k1+-(8*t)*this.sin3*this.sin,this.k0),a=.7071067811865476+(-.7071067811865476+this.sin)/r,i=.2928932188134524+(.7071067811865476-this.cos)/r,o=a-i*this.cot,n=o-1.5*r*i*i/this.sin3,s=-t,l=1-i,u=1-a,c=1.5*r,h=this.cos2-this.sin2,d=(-h+Math.sqrt(h*h- -(4*c*(this.cos*(u-i)-this.sin*(l-a)))))/(2*c),f=a+d*this.cos,g=i+d*this.sin;return[s,0,n,0,o,0,a,i,f,g,l-d*this.sin,u-d*this.cos,l,u,1,1-o,1,1-n,1,1-s]}buildUnevenCornerBezierPoints(e,t){var r,a,i;let o,n,s,l,u,c,h=this.extendedFraction*e,d=this.extendedFraction*t,f=_(this.k3,this.k2,this.k1+-(8*h)*this.sin3*this.sin,this.k0),g=_(this.k3,this.k2,this.k1+-(8*d)*this.sin3*this.sin,this.k0),p=.7071067811865476+(-.7071067811865476+this.sin)/f,m=.2928932188134524+(.7071067811865476-this.cos)/f,b=p-m*this.cot,S=b-1.5*f*m*m/this.sin3,v=.7071067811865476+(-.7071067811865476+this.sin)/g,x=.2928932188134524+(.7071067811865476-this.cos)/g,C=v-x*this.cot,T=C-1.5*g*x*x/this.sin3,y=1-x,R=1-v,k=1.5*f,w=1.5*g,A=this.cos2-this.sin2,E=y-p,P=R-m,M=-(this.cos*P-this.sin*E),F=this.sin*P-this.cos*E,B=(r=F/w*2,a=A*A*A/(k*w*w),i=(k*F*F+M*A*A)/(k*w*w),o=-r/2,s=(3*(n=-i)-o*o)/3,l=Math.acos(-((2*o*o*o-9*o*n+27*(i*r/2-a*a/8))/27)/(2*Math.sqrt(-s*s*s/27))),((c=Math.sqrt(2*(u=2*Math.sqrt(-s/3)*Math.cos(l/3)-o/3)-r))-Math.sqrt(c*c-4*(u+a/(2*c))))/2),D=(-F-w*B*B)/A,z=p+D*this.cos,L=m+D*this.sin;return[-h,0,S,0,b,0,p,m,z,L,y-B*this.sin,R-B*this.cos,y,R,1,1-C,1,1-T,1,1- -d]}getCornerBezierPoints(e,t){let r=0===e?0:1===e?1:-1,a=0===t?0:1===t?1:-1;return r>=0&&a>=0?0===r&&0===a?this.buildEvenCornerBezierPoints(0):1===r&&1===a?this.buildEvenCornerBezierPoints(1):this.buildUnevenCornerBezierPoints(+(1===r),+(1===a)):this.buildUnevenCornerBezierPoints(Math.max(0,Math.min(1,e)),Math.max(0,Math.min(1,t)))}}function D(e,t,r,a){let i=new B,o=Math.max(0,Math.min(1,(.5*t-a)/a)),n=Math.max(0,Math.min(1,(.5*r-a)/a)),s=i.getCornerBezierPoints(o,n);if(s.length<20)return new Path2D;let l=new Path2D,u=t-a,c=0;return l.moveTo(u+s[0]*a,c+s[1]*a),l.bezierCurveTo(u+s[2]*a,c+s[3]*a,u+s[4]*a,c+s[5]*a,u+s[6]*a,c+s[7]*a),l.bezierCurveTo(u+s[8]*a,c+s[9]*a,u+s[10]*a,c+s[11]*a,u+s[12]*a,c+s[13]*a),l.bezierCurveTo(u+s[14]*a,c+s[15]*a,u+s[16]*a,c+s[17]*a,u+s[18]*a,c+s[19]*a),u=t-a,c=r,l.lineTo(u+s[18]*a,c-s[19]*a),l.bezierCurveTo(u+s[16]*a,c-s[17]*a,u+s[14]*a,c-s[15]*a,u+s[12]*a,c-s[13]*a),l.bezierCurveTo(u+s[10]*a,c-s[11]*a,u+s[8]*a,c-s[9]*a,u+s[6]*a,c-s[7]*a),l.bezierCurveTo(u+s[4]*a,c-s[5]*a,u+s[2]*a,c-s[3]*a,u+s[0]*a,c-s[1]*a),u=a,c=r,l.lineTo(u-s[0]*a,c-s[1]*a),l.bezierCurveTo(u-s[2]*a,c-s[3]*a,u-s[4]*a,c-s[5]*a,u-s[6]*a,c-s[7]*a),l.bezierCurveTo(u-s[8]*a,c-s[9]*a,u-s[10]*a,c-s[11]*a,u-s[12]*a,c-s[13]*a),l.bezierCurveTo(u-s[14]*a,c-s[15]*a,u-s[16]*a,c-s[17]*a,u-s[18]*a,c-s[19]*a),u=a,c=0,l.lineTo(u-s[18]*a,c+s[19]*a),l.bezierCurveTo(u-s[16]*a,c+s[17]*a,u-s[14]*a,c+s[15]*a,u-s[12]*a,c+s[13]*a),l.bezierCurveTo(u-s[10]*a,c+s[11]*a,u-s[8]*a,c+s[9]*a,u-s[6]*a,c+s[7]*a),l.bezierCurveTo(u-s[4]*a,c+s[5]*a,u-s[2]*a,c+s[3]*a,u-s[0]*a,c+s[1]*a),l.closePath(),l}let z=new Map;class L{samples=[];resetTracking(){this.samples.length=0}addPosition(e,t){this.samples.push({t:e,p:t}),this.samples.length>20&&this.samples.shift()}calculateVelocity(e=100){let t=this.samples;if(t.length<2)return 0;let r=t[t.length-1].t,a=r-e,i=0,o=0,n=0,s=0,l=0;for(let e=t.length-1;e>=0;e--){let u=t[e];if(u.t<a)break;let c=(u.t-r)/1e3;o+=c,n+=u.p,s+=c*c,l+=c*u.p,i++}if(i<2)return 0;let u=i*s-o*o;return 1e-9>Math.abs(u)?0:(i*l-o*n)/u}}let O=Math.sqrt(300),I=O*Math.sqrt(.75),H=Math.sqrt(1e3),U=Math.sqrt(250),W=Math.sqrt(250),N=Math.sqrt(300);function X(e,t,r,a){let i=e-r,o=Math.exp(-.5*O*a),n=Math.cos(I*a),s=Math.sin(I*a),l=i*o*n+(t+.5*O*i)/I*o*s,u=-.5*O*l+o*(-i*I*s+(t+.5*O*i)/I*I*n);return{current:r+l,velocity:u}}function G(e,t,r,a,i){let o=e-r,n=Math.exp(-i*a);return{current:r+(o*n+(t+i*o)*a*n),velocity:-i*o*n+(t+i*o)*(n-i*a*n)}}function Y(e,t,r,a,i,o){let n=e-r,s=i*Math.sqrt(1-o*o),l=Math.exp(-o*i*a),u=Math.cos(s*a),c=Math.sin(s*a),h=n*l*u+(t+o*i*n)/s*l*c,d=-o*i*h+l*(-n*s*c+(t+o*i*n)/s*s*u);return{current:r+h,velocity:d}}function V(e,t){let r=new OffscreenCanvas(e,t),a=r.getContext("2d",{alpha:!0});return{canvas:r,ctx:a}}class q{gl;elementProgram;shadowProgram;wallpaperProgram;foregroundProgram;highlightProgram;tintProgram;rimHighlightProgram;highlightStrokeProgram;highlightCompositeProgram;strokeMaskCompositeProgram;innerShadowMaskCompositeProgram;plainRectProgram;progressiveBlurProgram;copyProgram;solidFillProgram;colorControlsProgram;sceneTintProgram;quadBuffer;wallpaperTexture=null;wallpaperReady=!1;wallpaperSize=[1,1];canvas;dpr=0;buttonConfigs=[];buttonStates=new Map;toggleStates=new Map;scrollY=0;scrollVelocity=0;contentHeight=0;cssWidth=0;cssHeight=0;wheelTarget=null;backgroundColor=null;needsRedraw=!0;fboA=null;fboATex=null;fboB=null;fboBTex=null;fboW=0;fboH=0;tabsBackdropFbo=null;tabsBackdropTex=null;tabsBackdropDirty=!0;gpElementFbo=null;gpElementTex=null;blurFboA=null;blurFboATex=null;blurFboB=null;blurFboBTex=null;highlightMaskFbo=null;highlightMaskTex=null;dialogBackdropFbo=null;dialogBackdropTex=null;dialogBackdropKey=null;blurPrograms=new Map;highlightBlurPrograms=new Map;gravityAngle=45*Math.PI/180;blurTapCap=17;blurDownsample=1;cornerStyle=1;sdfTexture=null;sdfTextureReady=!1;sdfTextureSize=[1,1];continuousSdfPool=new Map;continuousSdfTexture=null;continuousSdfTexSize=[256,256];continuousSdfKey=null;fgCanvas;fgCtx;fgTextures=new Map;fgDirtyIds=new Set;strokeMaskCache=new Map;innerShadowMaskCache=new Map;rafId=null;animRafId=null;aPosLocEl;aPosLocSh;aPosLocWp;aPosLocFg;aPosLocHl;aPosLocTn;aPosLocRm;aPosLocHs;aPosLocHc;aPosLocSm;aPosLocIs;aPosLocPr;aPosLocPb;aPosLocCp;aPosLocSf;aPosLocCc;aPosLocSt;uEl={};uSh={};uWp={};uFg={};uHl={};uTn={};uRm={};uHs={};uHc={};uSm={};uIs={};uPr={};uPb={};uCp={};uSf={};uCc={};uSt={};static TAB_PRESSED_SCALE=78/56;constructor(e){this.canvas=e;const t=e.getContext("webgl",{premultipliedAlpha:!1,alpha:!1,antialias:!0,preserveDrawingBuffer:!1});if(!t)throw Error("WebGL not supported");this.gl=t,this.elementProgram=P(t,b,l),this.shadowProgram=P(t,b,u),this.wallpaperProgram=P(t,b,S),this.foregroundProgram=P(t,b,y),this.highlightProgram=P(t,b,c),this.tintProgram=P(t,b,h),this.rimHighlightProgram=P(t,b,d),this.highlightStrokeProgram=P(t,b,f),this.highlightCompositeProgram=P(t,b,g),this.strokeMaskCompositeProgram=P(t,b,p),this.innerShadowMaskCompositeProgram=P(t,b,m),this.plainRectProgram=P(t,b,R),this.progressiveBlurProgram=P(t,b,k),this.copyProgram=P(t,b,v),this.solidFillProgram=P(t,b,x),this.colorControlsProgram=P(t,b,C),this.sceneTintProgram=P(t,b,T),this.quadBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),t.STATIC_DRAW),this.aPosLocEl=t.getAttribLocation(this.elementProgram,"aPos"),this.aPosLocSh=t.getAttribLocation(this.shadowProgram,"aPos"),this.aPosLocWp=t.getAttribLocation(this.wallpaperProgram,"aPos"),this.aPosLocFg=t.getAttribLocation(this.foregroundProgram,"aPos"),this.aPosLocHl=t.getAttribLocation(this.highlightProgram,"aPos"),this.aPosLocTn=t.getAttribLocation(this.tintProgram,"aPos"),this.aPosLocRm=t.getAttribLocation(this.rimHighlightProgram,"aPos"),this.aPosLocHs=t.getAttribLocation(this.highlightStrokeProgram,"aPos"),this.aPosLocHc=t.getAttribLocation(this.highlightCompositeProgram,"aPos"),this.aPosLocSm=t.getAttribLocation(this.strokeMaskCompositeProgram,"aPos"),this.aPosLocIs=t.getAttribLocation(this.innerShadowMaskCompositeProgram,"aPos"),this.aPosLocPr=t.getAttribLocation(this.plainRectProgram,"aPos"),this.aPosLocPb=t.getAttribLocation(this.progressiveBlurProgram,"aPos"),this.aPosLocCp=t.getAttribLocation(this.copyProgram,"aPos"),this.aPosLocSf=t.getAttribLocation(this.solidFillProgram,"aPos"),this.aPosLocCc=t.getAttribLocation(this.colorControlsProgram,"aPos"),this.aPosLocSt=t.getAttribLocation(this.sceneTintProgram,"aPos"),this.fgCanvas="u">typeof document?document.createElement("canvas"):null;const r=this.fgCanvas?.getContext("2d",{alpha:!0});if(!r)throw Error("2D canvas not supported");this.fgCtx=r,this.cacheUniforms()}cacheUniforms(){let e=this.gl;for(let t of["uBackdrop","uWallpaperSampler","uTabsBackdropSampler","uCanvasSize","uWallpaperSize","uElementOffset","uElementSize","uCornerRadii","uRefractionHeight","uRefractionAmount","uDepthEffect","uChromaticAberration","uBlurRadius","uSaturation","uBrightness","uContrast","uTintColor","uSurfaceColor","uHighlightColor","uHighlightAngle","uHighlightFalloff","uHighlightAlpha","uHighlightMode","uHighlightStrokeWidth","uHighlightBlur","uContentScaleX","uContentScaleY","uUseToggleBackdrop","uUseSolidBackdrop","uSolidBackdropColor","uTrackColor","uTrackRect","uTrackCornerRadius","uOriginalSize","uOriginalCornerRadius","uLayerScale","uIndicatorBackdrop","uContainerRect","uContainerCornerRadius","uIndicatorAccent","uInsetPx","uIndicatorPressProgress","uIndicatorPanelOffset","uDpr","uContainerCenter","uContainerScale","uTabContentTex0","uTabContentTex1","uTabContentTex2","uTabContentTex3","uTabContentTex4","uTabContentTex5","uTabContentTex6","uTabContentTex7","uTabContentRects[0]","uTabContentRects[1]","uTabContentRects[2]","uTabContentRects[3]","uTabContentRects[4]","uTabContentRects[5]","uTabContentRects[6]","uTabContentRects[7]","uTabContentCount","uTabsGlassLayer","uSdfTexSampler","uUseSdfTexture","uSdfTexSize","uSdfLightAngle","uEnterAlpha","uCornerStyle","uSkipColorControls","uUseMagnifier","uMagnifierZoom","uMagnifierOffsetY","uElementRotation","uContinuousSdf","uUseContinuousSdf","uContinuousSdfTexSize","uContinuousSdfElementSize","uInnerStrokeMask","uInnerStrokeMaskOffset","uInnerStrokeMaskSize"])this.uEl[t]=e.getUniformLocation(this.elementProgram,t);for(let t of["uCanvasSize","uElementOffset","uElementSize","uCornerRadii","uShadowRadius","uShadowOffset","uShadowColor","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation","uCornerStyle"])this.uSh[t]=e.getUniformLocation(this.shadowProgram,t);for(let t of["uBackdrop","uCanvasSize","uWallpaperSize"])this.uWp[t]=e.getUniformLocation(this.wallpaperProgram,t);for(let t of["uTexture","uCanvasSize","uOffset","uSize","uCornerRadii","uAlpha","uOriginalSize","uOriginalCornerRadius","uLayerScale","uCornerStyle","uUseContinuousSdf","uContinuousSdf","uContinuousSdfTexSize","uContinuousSdfElementSize"])this.uFg[t]=e.getUniformLocation(this.foregroundProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uColor","uRadius","uPosition","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation","uCornerStyle"])this.uHl[t]=e.getUniformLocation(this.highlightProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uColor","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation","uCornerStyle"])this.uTn[t]=e.getUniformLocation(this.tintProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uHighlightColor","uHighlightAngle","uHighlightFalloff","uHighlightAlpha","uHighlightMode","uHighlightStrokeWidth","uHighlightBlur","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation","uCornerStyle","uUseContinuousSdf","uContinuousSdf","uContinuousSdfTexSize","uContinuousSdfElementSize"])this.uRm[t]=e.getUniformLocation(this.rimHighlightProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uHighlightStrokeWidth","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation","uCornerStyle","uUseContinuousSdf","uContinuousSdf","uContinuousSdfTexSize","uContinuousSdfElementSize"])this.uHs[t]=e.getUniformLocation(this.highlightStrokeProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uBlurredMask","uMaskTexSize","uHighlightColor","uHighlightAngle","uHighlightFalloff","uHighlightAlpha","uHighlightMode","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation","uCornerStyle","uUseContinuousSdf","uContinuousSdf","uContinuousSdfTexSize","uContinuousSdfElementSize"])this.uHc[t]=e.getUniformLocation(this.highlightCompositeProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uStrokeMask","uMaskOffset","uMaskSize","uHighlightColor","uHighlightAngle","uHighlightFalloff","uHighlightAlpha","uHighlightMode","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation"])this.uSm[t]=e.getUniformLocation(this.strokeMaskCompositeProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uInnerShadowMask","uMaskOffset","uMaskSize","uInnerShadowColor","uInnerShadowAlpha","uOriginalSize","uOriginalCornerRadius","uLayerScale","uElementRotation"])this.uIs[t]=e.getUniformLocation(this.innerShadowMaskCompositeProgram,t);for(let t of["uCanvasSize","uOffset","uSize","uCornerRadii","uColor","uCornerStyle","uUseContinuousSdf","uContinuousSdf","uContinuousSdfTexSize","uContinuousSdfElementSize"])this.uPr[t]=e.getUniformLocation(this.plainRectProgram,t);for(let t of["uBackdrop","uCanvasSize","uWallpaperSize","uOffset","uSize","uBlurRadius","uTintColor","uTintIntensity"])this.uPb[t]=e.getUniformLocation(this.progressiveBlurProgram,t);for(let t of["uTexture","uCanvasSize"])this.uCp[t]=e.getUniformLocation(this.copyProgram,t);for(let t of["uColor"])this.uSf[t]=e.getUniformLocation(this.solidFillProgram,t);for(let t of["uTexture","uTexSize","uBrightness","uContrast","uSaturation"])this.uCc[t]=e.getUniformLocation(this.colorControlsProgram,t);for(let t of["uTexture","uCanvasSize","uTintColor"])this.uSt[t]=e.getUniformLocation(this.sceneTintProgram,t)}ensureBlurPrograms(e){if(this.blurPrograms.has(e))return;let t=this.gl,r=E(t,t.FRAGMENT_SHADER,w(e,"horizontal")),a=E(t,t.FRAGMENT_SHADER,w(e,"vertical")),i=r=>{let a=E(t,t.VERTEX_SHADER,b),i=t.createProgram();if(t.attachShader(i,a),t.attachShader(i,r),t.bindAttribLocation(i,0,"aPos"),t.linkProgram(i),t.deleteShader(a),t.deleteShader(r),!t.getProgramParameter(i,t.LINK_STATUS)){let r=t.getProgramInfoLog(i);throw t.deleteProgram(i),Error("Blur program link error (taps="+e+"): "+r)}return i},o=i(r),n=i(a),s={uTexture:t.getUniformLocation(o,"uTexture"),uTexSize:t.getUniformLocation(o,"uTexSize"),uRadius:t.getUniformLocation(o,"uRadius")},l={uTexture:t.getUniformLocation(n,"uTexture"),uTexSize:t.getUniformLocation(n,"uTexSize"),uRadius:t.getUniformLocation(n,"uRadius")};this.blurPrograms.set(e,{hProg:o,vProg:n,uH:s,uV:l,aPosH:0,aPosV:0})}blurTexture(e,t){let r=this.gl,a=this.fboW,i=this.fboH,o=t<.5?1:Math.min(33,Math.max(1,2*Math.ceil(3*(.57735*t+.5))+1));o=Math.min(o,Math.max(1,0|this.blurTapCap)),this.ensureBlurPrograms(o);let n=this.blurPrograms.get(o),s=r.getParameter(r.FRAMEBUFFER_BINDING);return r.disable(r.BLEND),r.bindFramebuffer(r.FRAMEBUFFER,this.blurFboA),r.viewport(0,0,a,i),r.useProgram(n.hProg),r.bindBuffer(r.ARRAY_BUFFER,this.quadBuffer),r.enableVertexAttribArray(n.aPosH),r.vertexAttribPointer(n.aPosH,2,r.FLOAT,!1,0,0),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,e),r.uniform1i(n.uH.uTexture,0),r.uniform2f(n.uH.uTexSize,a,i),r.uniform1f(n.uH.uRadius,t),r.drawArrays(r.TRIANGLES,0,6),r.bindFramebuffer(r.FRAMEBUFFER,this.blurFboB),r.viewport(0,0,a,i),r.useProgram(n.vProg),r.bindBuffer(r.ARRAY_BUFFER,this.quadBuffer),r.enableVertexAttribArray(n.aPosV),r.vertexAttribPointer(n.aPosV,2,r.FLOAT,!1,0,0),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.blurFboATex),r.uniform1i(n.uV.uTexture,0),r.uniform2f(n.uV.uTexSize,a,i),r.uniform1f(n.uV.uRadius,t),r.drawArrays(r.TRIANGLES,0,6),r.bindFramebuffer(r.FRAMEBUFFER,s),r.viewport(0,0,a,i),this.blurFboBTex}ensureHighlightBlurPrograms(e){if(this.highlightBlurPrograms.has(e))return;let t=this.gl,r=E(t,t.FRAGMENT_SHADER,A(e,"horizontal")),a=E(t,t.FRAGMENT_SHADER,A(e,"vertical")),i=r=>{let a=E(t,t.VERTEX_SHADER,b),i=t.createProgram();if(t.attachShader(i,a),t.attachShader(i,r),t.bindAttribLocation(i,0,"aPos"),t.linkProgram(i),t.deleteShader(a),t.deleteShader(r),!t.getProgramParameter(i,t.LINK_STATUS)){let r=t.getProgramInfoLog(i);throw t.deleteProgram(i),Error("Highlight blur program link error (taps="+e+"): "+r)}return i},o=i(r),n=i(a),s={uTexture:t.getUniformLocation(o,"uTexture"),uTexSize:t.getUniformLocation(o,"uTexSize"),uRadius:t.getUniformLocation(o,"uRadius")},l={uTexture:t.getUniformLocation(n,"uTexture"),uTexSize:t.getUniformLocation(n,"uTexSize"),uRadius:t.getUniformLocation(n,"uRadius")};this.highlightBlurPrograms.set(e,{hProg:o,vProg:n,uH:s,uV:l,aPosH:0,aPosV:0})}blurHighlightMask(e,t){let r=this.gl,a=this.fboW,i=this.fboH,o=t<.01?1:Math.min(33,Math.max(3,2*Math.ceil(3*t)+1));o=Math.min(o,Math.max(3,0|this.blurTapCap)),this.ensureHighlightBlurPrograms(o);let n=this.highlightBlurPrograms.get(o),s=r.getParameter(r.FRAMEBUFFER_BINDING);return r.disable(r.BLEND),r.bindFramebuffer(r.FRAMEBUFFER,this.blurFboA),r.viewport(0,0,a,i),r.useProgram(n.hProg),r.bindBuffer(r.ARRAY_BUFFER,this.quadBuffer),r.enableVertexAttribArray(n.aPosH),r.vertexAttribPointer(n.aPosH,2,r.FLOAT,!1,0,0),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,e),r.uniform1i(n.uH.uTexture,0),r.uniform2f(n.uH.uTexSize,a,i),r.uniform1f(n.uH.uRadius,t),r.drawArrays(r.TRIANGLES,0,6),r.bindFramebuffer(r.FRAMEBUFFER,this.blurFboB),r.viewport(0,0,a,i),r.useProgram(n.vProg),r.bindBuffer(r.ARRAY_BUFFER,this.quadBuffer),r.enableVertexAttribArray(n.aPosV),r.vertexAttribPointer(n.aPosV,2,r.FLOAT,!1,0,0),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.blurFboATex),r.uniform1i(n.uV.uTexture,0),r.uniform2f(n.uV.uTexSize,a,i),r.uniform1f(n.uV.uRadius,t),r.drawArrays(r.TRIANGLES,0,6),r.bindFramebuffer(r.FRAMEBUFFER,s),r.viewport(0,0,a,i),this.blurFboBTex}dispose(){null!==this.rafId&&cancelAnimationFrame(this.rafId),this.rafId=null,null!==this.animRafId&&cancelAnimationFrame(this.animRafId),this.animRafId=null;let e=this.gl;for(let t of(this.wallpaperTexture&&e.deleteTexture(this.wallpaperTexture),this.fgTextures.values()))e.deleteTexture(t);for(let t of(this.fgTextures.clear(),this.strokeMaskCache.values()))e.deleteTexture(t.tex);this.strokeMaskCache.clear();var t=this.innerShadowMaskCache;for(let r of t.values())e.deleteTexture(r.tex);for(let{hProg:r,vProg:a}of(t.clear(),this.fboA&&e.deleteFramebuffer(this.fboA),this.fboATex&&e.deleteTexture(this.fboATex),this.fboB&&e.deleteFramebuffer(this.fboB),this.fboBTex&&e.deleteTexture(this.fboBTex),this.fboA=this.fboB=null,this.fboATex=this.fboBTex=null,this.tabsBackdropFbo&&e.deleteFramebuffer(this.tabsBackdropFbo),this.tabsBackdropTex&&e.deleteTexture(this.tabsBackdropTex),this.tabsBackdropFbo=null,this.tabsBackdropTex=null,this.gpElementFbo&&e.deleteFramebuffer(this.gpElementFbo),this.gpElementTex&&e.deleteTexture(this.gpElementTex),this.blurFboA&&e.deleteFramebuffer(this.blurFboA),this.blurFboATex&&e.deleteTexture(this.blurFboATex),this.blurFboB&&e.deleteFramebuffer(this.blurFboB),this.blurFboBTex&&e.deleteTexture(this.blurFboBTex),this.gpElementFbo=this.blurFboA=this.blurFboB=null,this.gpElementTex=this.blurFboATex=this.blurFboBTex=null,this.highlightMaskFbo&&e.deleteFramebuffer(this.highlightMaskFbo),this.highlightMaskTex&&e.deleteTexture(this.highlightMaskTex),this.highlightMaskFbo=null,this.highlightMaskTex=null,this.dialogBackdropFbo&&e.deleteFramebuffer(this.dialogBackdropFbo),this.dialogBackdropTex&&e.deleteTexture(this.dialogBackdropTex),this.dialogBackdropFbo=null,this.dialogBackdropTex=null,this.dialogBackdropKey=null,this.blurPrograms.values()))e.deleteProgram(r),e.deleteProgram(a);for(let{hProg:t,vProg:r}of(this.blurPrograms.clear(),this.highlightBlurPrograms.values()))e.deleteProgram(t),e.deleteProgram(r);for(let{tex:t}of(this.highlightBlurPrograms.clear(),this.sdfTexture&&e.deleteTexture(this.sdfTexture),this.sdfTexture=null,this.continuousSdfPool.values()))e.deleteTexture(t);this.continuousSdfPool.clear(),this.continuousSdfTexture=null,this.continuousSdfKey=null,e.deleteProgram(this.elementProgram),e.deleteProgram(this.shadowProgram),e.deleteProgram(this.wallpaperProgram),e.deleteProgram(this.foregroundProgram),e.deleteProgram(this.highlightProgram),e.deleteProgram(this.tintProgram),e.deleteProgram(this.rimHighlightProgram),e.deleteProgram(this.highlightStrokeProgram),e.deleteProgram(this.highlightCompositeProgram),e.deleteProgram(this.strokeMaskCompositeProgram),e.deleteProgram(this.innerShadowMaskCompositeProgram),e.deleteProgram(this.plainRectProgram),e.deleteProgram(this.progressiveBlurProgram),e.deleteProgram(this.copyProgram),e.deleteProgram(this.solidFillProgram),e.deleteProgram(this.colorControlsProgram),e.deleteProgram(this.sceneTintProgram),e.deleteBuffer(this.quadBuffer)}}Object.assign(q.prototype,{createFBO(e,t){let r=this.gl,a=r.createTexture();r.bindTexture(r.TEXTURE_2D,a),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,e,t,0,r.RGBA,r.UNSIGNED_BYTE,null),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE);let i=r.createFramebuffer();return r.bindFramebuffer(r.FRAMEBUFFER,i),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,a,0),r.bindFramebuffer(r.FRAMEBUFFER,null),{fb:i,tex:a}},resizeFBOs(e,t){if(this.fboW===e&&this.fboH===t&&this.fboA&&this.fboB)return;let r=this.gl;this.fboA&&r.deleteFramebuffer(this.fboA),this.fboATex&&r.deleteTexture(this.fboATex),this.fboB&&r.deleteFramebuffer(this.fboB),this.fboBTex&&r.deleteTexture(this.fboBTex);let a=this.createFBO(e,t),i=this.createFBO(e,t);this.fboA=a.fb,this.fboATex=a.tex,this.fboB=i.fb,this.fboBTex=i.tex,this.tabsBackdropFbo&&r.deleteFramebuffer(this.tabsBackdropFbo),this.tabsBackdropTex&&r.deleteTexture(this.tabsBackdropTex);let o=this.createFBO(e,t);this.tabsBackdropFbo=o.fb,this.tabsBackdropTex=o.tex,this.tabsBackdropDirty=!0,this.gpElementFbo&&r.deleteFramebuffer(this.gpElementFbo),this.gpElementTex&&r.deleteTexture(this.gpElementTex),this.blurFboA&&r.deleteFramebuffer(this.blurFboA),this.blurFboATex&&r.deleteTexture(this.blurFboATex),this.blurFboB&&r.deleteFramebuffer(this.blurFboB),this.blurFboBTex&&r.deleteTexture(this.blurFboBTex);let n=this.createFBO(e,t),s=this.createFBO(e,t),l=this.createFBO(e,t);this.gpElementFbo=n.fb,this.gpElementTex=n.tex,this.blurFboA=s.fb,this.blurFboATex=s.tex,this.blurFboB=l.fb,this.blurFboBTex=l.tex,this.highlightMaskFbo&&r.deleteFramebuffer(this.highlightMaskFbo),this.highlightMaskTex&&r.deleteTexture(this.highlightMaskTex);let u=this.createFBO(e,t);this.highlightMaskFbo=u.fb,this.highlightMaskTex=u.tex,this.dialogBackdropFbo&&r.deleteFramebuffer(this.dialogBackdropFbo),this.dialogBackdropTex&&r.deleteTexture(this.dialogBackdropTex);let c=this.createFBO(e,t);this.dialogBackdropFbo=c.fb,this.dialogBackdropTex=c.tex,this.dialogBackdropKey=null,this.fboW=e,this.fboH=t},bindFBO(e){let t=this.gl;t.bindFramebuffer(t.FRAMEBUFFER,e),t.viewport(0,0,this.fboW,this.fboH)},drawCopy(e){let t=this.gl;t.useProgram(this.copyProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocCp),t.vertexAttribPointer(this.aPosLocCp,2,t.FLOAT,!1,0,0),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,e),t.uniform1i(this.uCp.uTexture,0),t.uniform2f(this.uCp.uCanvasSize,this.fboW,this.fboH),t.disable(t.BLEND),t.drawArrays(t.TRIANGLES,0,6)},drawSolidFill(e,t,r,a){let i=this.gl;i.useProgram(this.solidFillProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocSf),i.vertexAttribPointer(this.aPosLocSf,2,i.FLOAT,!1,0,0),i.uniform4f(this.uSf.uColor,e,t,r,a),i.disable(i.BLEND),i.drawArrays(i.TRIANGLES,0,6)},drawColorControls(e,t,r,a){let i=this.gl;i.useProgram(this.colorControlsProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocCc),i.vertexAttribPointer(this.aPosLocCc,2,i.FLOAT,!1,0,0),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,e),i.uniform1i(this.uCc.uTexture,0),i.uniform2f(this.uCc.uTexSize,this.fboW,this.fboH),i.uniform1f(this.uCc.uBrightness,t),i.uniform1f(this.uCc.uContrast,r),i.uniform1f(this.uCc.uSaturation,a),i.disable(i.BLEND),i.drawArrays(i.TRIANGLES,0,6)}},{async loadWallpaper(e){let t=new Image;t.crossOrigin="anonymous",await new Promise((r,a)=>{t.onload=()=>r(),t.onerror=()=>a(Error("Failed to load wallpaper: "+e)),t.src=e});let r=this.gl;this.wallpaperTexture&&r.deleteTexture(this.wallpaperTexture);let a=r.createTexture();r.bindTexture(r.TEXTURE_2D,a),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!1),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,t);let i=t.naturalWidth,o=t.naturalHeight;(i&i-1)==0&&(o&o-1)==0?(r.generateMipmap(r.TEXTURE_2D),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR_MIPMAP_LINEAR)):r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),this.wallpaperTexture=a,this.wallpaperSize=[i||1,o||1],this.wallpaperReady=!0,this.requestRender()},async loadSdfTexture(e){let t=new Image;t.crossOrigin="anonymous",await new Promise((r,a)=>{t.onload=()=>r(),t.onerror=()=>a(Error("Failed to load SDF texture: "+e)),t.src=e});let r=this.gl;this.sdfTexture&&r.deleteTexture(this.sdfTexture);let a=r.createTexture();r.bindTexture(r.TEXTURE_2D,a),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!1),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,t),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),this.sdfTexture=a,this.sdfTextureSize=[t.naturalWidth||1,t.naturalHeight||1],this.sdfTextureReady=!0,this.requestRender()},loadContinuousSdf(e,t,r){let a=`${e},${t},${r},${this.dpr}`,i=this.continuousSdfPool.get(a);if(!i){let{tex:o,texSize:n}=function(e,t,r,a=1){let i=Math.min(512,Math.max(128,Math.round(Math.max(e,t)*a))),o=`${e},${t},${r},${i}`,n=z.get(o);if(n)return{tex:n.tex,texSize:i};let s=Math.max(e,t),l=e/s,u=t/s,c=document.createElement("canvas");c.width=i,c.height=i;let h=c.getContext("2d");h.clearRect(0,0,i,i);let d=(i-8)*l,f=(i-8)*u,g=(i-d)/2,p=(i-f)/2,m=d/e*r,b=D(h,d,f,m);h.fillStyle="white",h.translate(g,p),h.fill(b),h.translate(-g,-p);let S=h.getImageData(0,0,i,i),v=new Uint8Array(i*i);for(let e=0;e<i*i;e++)v[e]=S.data[4*e+3];let x=new Float32Array(i*i),C=new Float32Array(i*i);for(let e=0;e<i*i;e++)v[e]>128?(x[e]=0,C[e]=1e10):(x[e]=1e10,C[e]=0);for(let e=0;e<i;e++)for(let t=0;t<i;t++){let r=e*i+t;t>0&&e>1&&(x[r]=Math.min(x[r],x[r-i-1-i]+11),C[r]=Math.min(C[r],C[r-i-1-i]+11)),t>0&&(x[r]=Math.min(x[r],x[r-1]+5),C[r]=Math.min(C[r],C[r-1]+5)),t>0&&e>0&&(x[r]=Math.min(x[r],x[r-i-1]+7),C[r]=Math.min(C[r],C[r-i-1]+7)),e>0&&(x[r]=Math.min(x[r],x[r-i]+5),C[r]=Math.min(C[r],C[r-i]+5)),t<i-1&&e>0&&(x[r]=Math.min(x[r],x[r-i+1]+7),C[r]=Math.min(C[r],C[r-i+1]+7)),t<i-2&&e>0&&(x[r]=Math.min(x[r],x[r-i+2]+11),C[r]=Math.min(C[r],C[r-i+2]+11))}for(let e=i-1;e>=0;e--)for(let t=i-1;t>=0;t--){let r=e*i+t;t<i-1&&e<i-2&&(x[r]=Math.min(x[r],x[r+i+1+i]+11),C[r]=Math.min(C[r],C[r+i+1+i]+11)),t<i-1&&(x[r]=Math.min(x[r],x[r+1]+5),C[r]=Math.min(C[r],C[r+1]+5)),t<i-1&&e<i-1&&(x[r]=Math.min(x[r],x[r+i+1]+7),C[r]=Math.min(C[r],C[r+i+1]+7)),e<i-1&&(x[r]=Math.min(x[r],x[r+i]+5),C[r]=Math.min(C[r],C[r+i]+5)),t>0&&e<i-1&&(x[r]=Math.min(x[r],x[r+i-1]+7),C[r]=Math.min(C[r],C[r+i-1]+7)),t>1&&e<i-1&&(x[r]=Math.min(x[r],x[r+i-2]+11),C[r]=Math.min(C[r],C[r+i-2]+11))}let T=new Uint8Array(i*i*4);for(let e=0;e<i*i;e++){T[4*e]=v[e];let t=Math.max(-1,Math.min(1,(x[e]-C[e])/5/m));T[4*e+1]=Math.round((.5*t+.5)*255),T[4*e+2]=0,T[4*e+3]=255}return z.set(o,{tex:T,texSize:i}),{tex:T,texSize:i}}(e,t,r,this.dpr),s=this.gl,l=s.createTexture();if(s.bindTexture(s.TEXTURE_2D,l),s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!0),s.texImage2D(s.TEXTURE_2D,0,s.RGBA,n,n,0,s.RGBA,s.UNSIGNED_BYTE,o),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),i={tex:l,texSize:n},this.continuousSdfPool.set(a,i),this.continuousSdfPool.size>16){let e=this.continuousSdfPool.keys().next().value;if(e){let t=this.continuousSdfPool.get(e);t&&s.deleteTexture(t.tex),this.continuousSdfPool.delete(e)}}}this.continuousSdfTexture=i.tex,this.continuousSdfTexSize=[i.texSize,i.texSize],this.continuousSdfKey=a},resize(e,t){this.dpr<=0&&(this.dpr=Math.min(window.devicePixelRatio||1,1.5));let r=Math.round(e*this.dpr),a=Math.round(t*this.dpr);for(let e of((this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a,this.gl.viewport(0,0,r,a),this.resizeFBOs(r,a)),this.buttonConfigs))this.fgDirtyIds.add(e.id);this.cssWidth=e,this.cssHeight=t,this.requestRender()}},{setContentHeight(e){this.contentHeight=e,this.clampScrollY(),this.requestRender()},setScrollY(e){this.scrollVelocity=0,this.scrollY=this.clampScrollValue(e),this.requestRender()},setScrollVelocity(e){this.scrollVelocity=Math.max(-4e3,Math.min(4e3,e)),this.startAnimation()},getScrollY(){return this.scrollY},getScrollVelocity(){return this.scrollVelocity},clampScrollValue(e){let t=Math.max(0,this.contentHeight-this.cssHeight);return e<0?0:e>t?t:e},clampScrollY(){this.scrollY=this.clampScrollValue(this.scrollY)},setBackgroundColor(e){this.backgroundColor===e||this.backgroundColor&&e&&this.backgroundColor[0]===e[0]&&this.backgroundColor[1]===e[1]&&this.backgroundColor[2]===e[2]||(this.backgroundColor=e,this.requestRender())},setGravityAngle(e){.02>Math.abs(this.gravityAngle-e)||(this.gravityAngle=e,this.requestRender())}},{ensureToggleState(e,t,r=1.5,a=1){let i=this.toggleStates.get(e);return i?(1.5!==r&&(i.pressedScale=r),1!==a&&(i.valueRangeSpan=a)):(i={fraction:t,fractionVelocity:0,targetFraction:t,pressProgress:0,pressVelocity:0,targetPress:0,scaleX:1,scaleXVelocity:0,targetScaleX:1,scaleY:1,scaleYVelocity:0,targetScaleY:1,velocity:0,velocityVelocity:0,targetVelocity:0,isDragging:!1,trackVelocityAfterRelease:!1,velocityTracker:new L,lastFractionForVelocity:t,lastFractionTime:0,pressedScale:r,valueRangeSpan:a,panelOffset:0,panelOffsetVelocity:0,targetPanelOffset:0},this.toggleStates.set(e,i)),i},setToggleTarget(e,t){let r=this.ensureToggleState(e,t);r.isDragging||r.targetFraction!==t&&(r.targetFraction=t,r.trackVelocityAfterRelease=!1,r.targetVelocity=0,r.velocity=0,r.velocityVelocity=0,r.velocityTracker.resetTracking(),0===r.targetPress&&(r.targetPress=1,r.targetScaleX=r.pressedScale,r.targetScaleY=r.pressedScale),this.startAnimation())},beginToggleDrag(e,t){let r=this.ensureToggleState(e,t);r.isDragging=!0,r.targetPress=1,r.targetScaleX=r.pressedScale,r.targetScaleY=r.pressedScale,r.velocityTracker.resetTracking(),r.targetVelocity=0,r.velocity=0,r.velocityVelocity=0,this.startAnimation()},dragToggle(e,t,r,a,i){let o=this.ensureToggleState(e,t);o.isDragging&&(o.targetFraction=Math.max(0,Math.min(1,t+(r-a)/Math.max(1,i))),this.startAnimation())},endToggleDrag(e){let t=this.toggleStates.get(e);if(!t)return 0;t.isDragging=!1;let r=+(t.targetFraction>=.5);return t.targetFraction=r,t.trackVelocityAfterRelease=!0,this.startAnimation(),r},endSliderDrag(e){let t=this.toggleStates.get(e);if(!t)return 0;t.isDragging=!1;let r=t.targetFraction;return t.trackVelocityAfterRelease=!0,this.startAnimation(),r},getToggleFraction(e){return this.toggleStates.get(e)?.fraction??0},setSliderDragPosition(e,t){let r=this.toggleStates.get(e);if(!r)return;let a=Math.max(0,Math.min(1,t));r.targetFraction!==a&&(r.targetFraction=a,this.startAnimation())},getToggleTarget(e){return this.toggleStates.get(e)?.targetFraction??0}},{setTabSelected(e,t,r){let a=this.ensureToggleState(e,t,q.TAB_PRESSED_SCALE,r-1);a.isDragging||a.targetFraction!==t&&(a.targetFraction=t,a.trackVelocityAfterRelease=!1,a.targetVelocity=0,a.velocity=0,a.velocityVelocity=0,a.velocityTracker.resetTracking(),0===a.targetPress&&(a.targetPress=1,a.targetScaleX=a.pressedScale,a.targetScaleY=a.pressedScale),this.startAnimation())},beginTabDrag(e,t,r){let a=this.ensureToggleState(e,t,q.TAB_PRESSED_SCALE,r-1);a.isDragging=!0,a.targetPress=1,a.targetScaleX=a.pressedScale,a.targetScaleY=a.pressedScale,a.velocityTracker.resetTracking(),a.targetVelocity=0,a.velocity=0,a.velocityVelocity=0,this.startAnimation()},dragTab(e,t,r,a,i,o){let n=this.ensureToggleState(e,t,q.TAB_PRESSED_SCALE,o-1);if(!n.isDragging)return;n.targetFraction=Math.max(0,Math.min(o-1,t+(r-a)/Math.max(1,i)));let s=Math.max(-1,Math.min(1,(r-a)/Math.max(1,i*o))),l=1-Math.pow(1-Math.abs(s),2);n.targetPanelOffset=4*Math.sign(s)*l,this.startAnimation()},endTabDrag(e,t){let r=this.toggleStates.get(e);if(!r)return 0;r.isDragging=!1;let a=Math.max(0,Math.min(t-1,Math.round(r.targetFraction)));return r.targetFraction=a,r.velocityTracker.resetTracking(),r.trackVelocityAfterRelease=!1,r.targetVelocity=0,r.targetPanelOffset=0,this.startAnimation(),a},getTabFraction(e){return this.toggleStates.get(e)?.fraction??0},getTabTarget(e){return this.toggleStates.get(e)?.targetFraction??0}},{setElements(e){this.setButtons(e)},setButtons(e){let t=new Set(this.buttonConfigs.map(e=>e.id)),r=new Set(e.map(e=>e.id));for(let e of r)t.has(e)||this.fgDirtyIds.add(e);for(let t of e){let e=this.buttonConfigs.find(e=>e.id===t.id);if(!e)continue;let r=(e,t)=>{if(!e||!t)return e===t;if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(e[r]!==t[r])return!1;return!0},a=e.text?.icon,i=t.text?.icon,o=!!a!=!!i||a&&i&&(a.path!==i.path||a.size!==i.size||!r(a.color,i.color)),n=e.icon,s=t.icon,l=!!n!=!!s||n&&s&&(n.path!==s.path||n.size!==s.size||!r(n.color,s.color)),u=e.text,c=t.text,h=!!u!=!!c||u&&c&&(!r(u.color,c.color)||u.halo!==c.halo||u.fontSizePx!==c.fontSizePx||u.fontWeight!==c.fontWeight||u.align!==c.align||u.wrap!==c.wrap||u.paddingPx!==c.paddingPx||u.valign!==c.valign||u.maxLines!==c.maxLines);(e.label!==t.label||!r(e.labelColor,t.labelColor)||e.showChevron!==t.showChevron||e.rect.w!==t.rect.w||e.rect.h!==t.rect.h||t.text&&e.text&&e.text.content!==t.text.content||t.text&&!e.text||!t.text&&e.text||o||l||h)&&this.fgDirtyIds.add(t.id)}for(let e of t)if(!r.has(e)){this.buttonStates.delete(e);let t=this.fgTextures.get(e);t&&(this.gl.deleteTexture(t),this.fgTextures.delete(e)),this.fgDirtyIds.delete(e)}for(let t of e)this.buttonStates.has(t.id)||this.buttonStates.set(t.id,{pressProgress:0,pressVelocity:0,targetPress:0,dragX:0,dragY:0,dragVx:0,dragVy:0,targetDragX:0,targetDragY:0,startDragX:0,startDragY:0,interactiveValue:0,interactiveVelocity:0,targetInteractiveValue:0});this.buttonConfigs=e,this.requestRender()},setInteractiveValue(e,t){let r=this.buttonStates.get(e);r&&r.targetInteractiveValue!==t&&(r.targetInteractiveValue=t,this.startAnimation(),this.requestRender())},setPressed(e,t,r){let a=this.buttonStates.get(e);if(a){if(t){let t=this.buttonConfigs.find(t=>t.id===e);if(t&&r){let e=r.x-t.rect.x,i=r.y-t.rect.y;0===a.targetPress&&(a.startDragX=e,a.startDragY=i,a.dragX=e,a.dragY=i,a.dragVx=0,a.dragVy=0),a.dragX=e,a.dragY=i,a.dragVx=0,a.dragVy=0,a.targetDragX=e,a.targetDragY=i}a.targetPress=1}else a.targetPress=0,a.targetDragX=a.startDragX,a.targetDragY=a.startDragY;this.startAnimation()}},setDragPosition(e,t){let r=this.buttonStates.get(e);if(!r||0===r.targetPress)return;let a=this.buttonConfigs.find(t=>t.id===e);if(!a)return;let i=t.x-a.rect.x,o=t.y-a.rect.y;r.dragX=i,r.dragY=o,r.dragVx=0,r.dragVy=0,r.targetDragX=i,r.targetDragY=o,this.requestRender()}},{startAnimation(){if(null!==this.animRafId)return;let e=performance.now(),t=()=>{let r=performance.now(),a=Math.min((r-e)/1e3,.05);e=r;let i=!1;for(let e of this.buttonStates.values()){if(Math.abs(e.targetPress-e.pressProgress)>5e-4||Math.abs(e.pressVelocity)>5e-4){let t=X(e.pressProgress,e.pressVelocity,e.targetPress,a);e.pressProgress=t.current,e.pressVelocity=t.velocity,i=!0}else e.pressProgress=e.targetPress,e.pressVelocity=0;if(Math.abs(e.targetDragX-e.dragX)>5e-4||Math.abs(e.dragVx)>5e-4){let t=X(e.dragX,e.dragVx,e.targetDragX,a);e.dragX=t.current,e.dragVx=t.velocity,i=!0}else e.dragX=e.targetDragX,e.dragVx=0;if(Math.abs(e.targetDragY-e.dragY)>5e-4||Math.abs(e.dragVy)>5e-4){let t=X(e.dragY,e.dragVy,e.targetDragY,a);e.dragY=t.current,e.dragVy=t.velocity,i=!0}else e.dragY=e.targetDragY,e.dragVy=0;if(Math.abs(e.targetInteractiveValue-e.interactiveValue)>5e-4||Math.abs(e.interactiveVelocity)>5e-4){let t=X(e.interactiveValue,e.interactiveVelocity,e.targetInteractiveValue,a);e.interactiveValue=t.current,e.interactiveVelocity=t.velocity,i=!0}else e.interactiveValue=e.targetInteractiveValue,e.interactiveVelocity=0}for(let e of this.toggleStates.values()){if(1===e.targetPress&&!e.isDragging&&.02>Math.abs(e.targetFraction-e.fraction)&&(e.targetPress=0,e.targetScaleX=1,e.targetScaleY=1,this.startAnimation()),Math.abs(e.targetFraction-e.fraction)>5e-4||Math.abs(e.fractionVelocity)>5e-4){let t=G(e.fraction,e.fractionVelocity,e.targetFraction,a,H);if(e.fraction=t.current,e.fractionVelocity=t.velocity,e.trackVelocityAfterRelease||e.isDragging){let t=performance.now();e.velocityTracker.addPosition(t,e.fraction);let r=e.velocityTracker.calculateVelocity(),a=e.valueRangeSpan||1;e.targetVelocity=r/a}i=!0}else e.fraction=e.targetFraction,e.fractionVelocity=0,e.isDragging||(e.targetVelocity=0,e.trackVelocityAfterRelease=!1,e.velocityTracker.resetTracking());if(Math.abs(e.targetPress-e.pressProgress)>5e-4||Math.abs(e.pressVelocity)>5e-4){let t=G(e.pressProgress,e.pressVelocity,e.targetPress,a,H);e.pressProgress=t.current,e.pressVelocity=t.velocity,i=!0}else e.pressProgress=e.targetPress,e.pressVelocity=0;if(Math.abs(e.targetScaleX-e.scaleX)>5e-4||Math.abs(e.scaleXVelocity)>5e-4){let t=Y(e.scaleX,e.scaleXVelocity,e.targetScaleX,a,U,.6);e.scaleX=t.current,e.scaleXVelocity=t.velocity,i=!0}else e.scaleX=e.targetScaleX,e.scaleXVelocity=0;if(Math.abs(e.targetScaleY-e.scaleY)>5e-4||Math.abs(e.scaleYVelocity)>5e-4){let t=Y(e.scaleY,e.scaleYVelocity,e.targetScaleY,a,W,.7);e.scaleY=t.current,e.scaleYVelocity=t.velocity,i=!0}else e.scaleY=e.targetScaleY,e.scaleYVelocity=0;if(Math.abs(e.targetVelocity-e.velocity)>5e-4||Math.abs(e.velocityVelocity)>5e-4){let t=Y(e.velocity,e.velocityVelocity,e.targetVelocity,a,N,.5);e.velocity=t.current,e.velocityVelocity=t.velocity,i=!0}else e.velocity=e.targetVelocity,e.velocityVelocity=0;if(Math.abs(e.targetPanelOffset-e.panelOffset)>5e-4||Math.abs(e.panelOffsetVelocity)>5e-4){let t=G(e.panelOffset,e.panelOffsetVelocity,e.targetPanelOffset,a,Math.sqrt(300));e.panelOffset=t.current,e.panelOffsetVelocity=t.velocity,i=!0}else e.panelOffset=e.targetPanelOffset,e.panelOffsetVelocity=0}if(Math.abs(this.scrollVelocity)>.5){let e=this.scrollY+this.scrollVelocity*a,t=this.clampScrollValue(e);t!==e?(this.scrollY=t,this.scrollVelocity=0):(this.scrollY=t,this.scrollVelocity*=Math.exp(-4*a)),i=!0}else this.scrollVelocity=0;i?(this.requestRender(),this.animRafId=requestAnimationFrame(t)):(this.requestRender(),this.animRafId=null)};this.animRafId=requestAnimationFrame(t)},requestRender(){this.needsRedraw=!0,null===this.rafId&&(this.rafId=requestAnimationFrame(()=>{this.rafId=null,this.render()}))}},{rasterizeForeground(e){if("text"===e.kind&&e.text)return void this.rasterizeText(e);if("button"!==e.kind&&!e.label&&!e.icon)return void this.fgDirtyIds.delete(e.id);let t=this.dpr,r=Math.max(1,Math.round(e.rect.w*t)),a=Math.max(1,Math.round(e.rect.h*t));this.fgCanvas.width!==r&&(this.fgCanvas.width=r),this.fgCanvas.height!==a&&(this.fgCanvas.height=a);let i=this.fgCtx;i.setTransform(1,0,0,1,0,0),i.clearRect(0,0,r,a),i.scale(t,t);let o=e.rect.w,n=e.rect.h;if(e.icon){let t=e.icon.size,r=e.icon.color;i.save(),i.translate(o/2-t/2,n/2-t/2);let a=e.icon.viewport??24;i.scale(t/a,t/a);let s=new Path2D(e.icon.path);i.fillStyle=`rgba(${Math.round(255*r[0])}, ${Math.round(255*r[1])}, ${Math.round(255*r[2])}, ${r[3]})`,i.fill(s),i.restore(),this.uploadForegroundTexture(e.id),this.fgDirtyIds.delete(e.id);return}let s=e.labelFontSizePx??15/48*n;i.font=`400 ${s}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,i.textBaseline="middle",i.textAlign="center";let l=`rgba(${Math.round(255*e.labelColor[0])}, ${Math.round(255*e.labelColor[1])}, ${Math.round(255*e.labelColor[2])}, ${e.labelColor[3]})`,u=e.labelColor[0]+e.labelColor[1]+e.labelColor[2]<1.5;if(i.save(),i.shadowColor=u?"rgba(255,255,255,0.45)":"rgba(0,0,0,0.15)",i.shadowBlur=u?.12*s:.05*s,i.fillStyle=l,i.fillText(e.label,o/2,n/2+.5),i.restore(),e.showChevron){let t=.93*s,r=o/2+i.measureText(e.label).width/2+.53*s+t/2,a=n/2;i.save(),i.strokeStyle=l,i.globalAlpha=.6,i.lineWidth=.107*s,i.lineCap="round",i.lineJoin="round",i.beginPath(),i.moveTo(r-.3*t,a-.4*t),i.lineTo(r+.2*t,a),i.lineTo(r-.3*t,a+.4*t),i.stroke(),i.restore()}this.uploadForegroundTexture(e.id),this.fgDirtyIds.delete(e.id)},rasterizeText(e){if(!e.text)return;let t=this.dpr,r=Math.max(1,Math.round(e.rect.w*t)),a=Math.max(1,Math.round(e.rect.h*t));this.fgCanvas.width!==r&&(this.fgCanvas.width=r),this.fgCanvas.height!==a&&(this.fgCanvas.height=a);let i=this.fgCtx;i.setTransform(1,0,0,1,0,0),i.clearRect(0,0,r,a),i.scale(t,t);let o=e.text,n=e.rect.w,s=e.rect.h;i.font=`${o.fontWeight} ${o.fontSizePx}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,i.textBaseline="middle";let l=o.paddingPx??0,u="none";"light"===o.halo?u="light":"dark"===o.halo?u="dark":("auto"===o.halo||void 0===o.halo)&&(u=o.color[0]+o.color[1]+o.color[2]<1.5?"light":"dark"),"light"===u?(i.shadowColor="rgba(255,255,255,0.55)",i.shadowBlur=.16*o.fontSizePx):"dark"===u?(i.shadowColor="rgba(0,0,0,0.28)",i.shadowBlur=.1*o.fontSizePx):(i.shadowColor="transparent",i.shadowBlur=0),i.fillStyle=`rgba(${Math.round(255*o.color[0])}, ${Math.round(255*o.color[1])}, ${Math.round(255*o.color[2])}, ${o.color[3]})`;let c=0;if(o.icon){let e=o.icon.size,t=o.icon.layoutSize??e,r=2*!!o.content,a=t+r+(o.content?o.fontSizePx:0);i.save(),i.translate(n/2-e/2,s/2-a/2+t/2-e/2);let l=o.icon.viewport??24;i.scale(e/l,e/l);let u=new Path2D(o.icon.path),h=o.icon.color;i.fillStyle=`rgba(${Math.round(255*h[0])}, ${Math.round(255*h[1])}, ${Math.round(255*h[2])}, ${h[3]})`,i.fill(u),i.restore(),c=(t+r)/2}if("center"===o.align)if(i.textAlign="center",o.wrap){let e,t=M(i,o.content,n-2*l);null!=o.maxLines&&t.length>o.maxLines&&(t=t.slice(0,o.maxLines));let r=1.35*o.fontSizePx,a=r*t.length;for(let l of(e="top"===o.valign?r/2+c:"bottom"===o.valign?s-a+r/2+c:s/2-a/2+r/2+c,t))i.fillText(l,n/2,e),e+=r}else i.fillText(o.content,n/2,s/2+.5+c);else if("left"===o.align)if(i.textAlign="left",o.wrap){let e,t=M(i,o.content,n-2*l);null!=o.maxLines&&t.length>o.maxLines&&(t=t.slice(0,o.maxLines));let r=1.35*o.fontSizePx,a=r*t.length;for(let n of(e="top"===o.valign?r/2+c:"bottom"===o.valign?s-a+r/2+c:s/2-a/2+r/2+c,t))i.fillText(n,l,e),e+=r}else i.fillText(o.content,l,s/2+.5+c);else i.textAlign="right",i.fillText(o.content,n-l,s/2+.5+c);this.uploadForegroundTexture(e.id),this.fgDirtyIds.delete(e.id)},uploadForegroundTexture(e){let t=this.gl,r=this.fgTextures.get(e);r||(r=t.createTexture(),this.fgTextures.set(e,r)),t.bindTexture(t.TEXTURE_2D,r),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,this.fgCanvas),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1)}},{render(){if(!this.needsRedraw||(this.needsRedraw=!1,!this.wallpaperReady&&!this.backgroundColor))return;let e=this.gl;for(let e of(this.resizeFBOs(this.canvas.width,this.canvas.height),this.buttonConfigs))this.fgDirtyIds.has(e.id)&&this.rasterizeForeground(e);if(this.renderBackground(),0===this.buttonConfigs.length){this.bindFBO(null),this.drawCopy(this.fboATex);return}let t=this.buttonConfigs.find(e=>(e.sceneBlurRadius??0)>=.5);if(t){let e=t.sceneBlurRadius*this.dpr,r=this.blurTexture(this.fboATex,e);this.bindFBO(this.fboA),this.drawCopy(r)}e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA);let r=this.scrollY,a=this.cssHeight+120,i=e=>{let t=e.scroll?e.rect.y-r:e.rect.y;return{x:e.rect.x,y:t,w:e.rect.w,h:e.rect.h}},o=this.fboA,n=this.fboATex,s=this.fboB,l=this.fboBTex;for(let e of this.buttonConfigs){if(e.renderOnTop)continue;let t=e.scroll?e.rect.y-r:e.rect.y;if(t+e.rect.h<-120||t>a)continue;let u=i(e),c=this.buttonStates.get(e.id);if(this.renderNonGlassElement(e,u,c,o))continue;e.backdropFbo&&e.scrimColor&&this.renderDialogBackdrop(e.scrimColor,e.brightness,e.contrast,e.saturation),e.useContinuousSdf&&this.loadContinuousSdf(e.rect.w,e.rect.h,e.cornerRadius);let h=this.renderGlassElement(e,c,o,n,s,l,u);o=h.curFbo,n=h.curTex,s=h.otherFbo,l=h.otherTex,e.isBottomTabContainer&&this.tabsBackdropFbo&&this.tabsBackdropTex&&(this.bindFBO(this.tabsBackdropFbo),this.gl.clearColor(0,0,0,0),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.drawCopy(n),this.bindFBO(o),this.gl.enable(this.gl.BLEND),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA))}for(let e of this.buttonConfigs){if(!e.renderOnTop)continue;let t=e.scroll?e.rect.y-r:e.rect.y;if(t+e.rect.h<-120||t>a)continue;let u=i(e),c=this.buttonStates.get(e.id);if(this.renderNonGlassElement(e,u,c,o))continue;let h=this.renderGlassElement(e,c,o,n,s,l,u);o=h.curFbo,n=h.curTex,s=h.otherFbo,l=h.otherTex}this.bindFBO(null),this.drawCopy(n)},setSdfUniforms(e,t,r,a){let i=this.gl;i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(t),i.vertexAttribPointer(t,2,i.FLOAT,!1,0,0),i.uniform2f(e.uCanvasSize,this.canvas.width,this.canvas.height),i.uniform2f(e.uOffset,r.x*this.dpr,r.y*this.dpr),i.uniform2f(e.uSize,r.w*this.dpr,r.h*this.dpr),i.uniform4f(e.uCornerRadii,a*this.dpr,a*this.dpr,a*this.dpr,a*this.dpr)},renderBackground(){let e=this.gl;if(this.bindFBO(this.fboA),e.disable(e.BLEND),this.backgroundColor){let[e,t,r]=this.backgroundColor;this.drawSolidFill(e,t,r,1)}else e.useProgram(this.wallpaperProgram),e.bindBuffer(e.ARRAY_BUFFER,this.quadBuffer),e.enableVertexAttribArray(this.aPosLocWp),e.vertexAttribPointer(this.aPosLocWp,2,e.FLOAT,!1,0,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.wallpaperTexture),e.uniform1i(this.uWp.uBackdrop,0),e.uniform2f(this.uWp.uCanvasSize,this.canvas.width,this.canvas.height),e.uniform2f(this.uWp.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),e.drawArrays(e.TRIANGLES,0,6)},renderDialogBackdrop(e,t,r,a){let i=`${e.join(",")}|${t},${r},${a}`;if(this.dialogBackdropKey===i)return;this.dialogBackdropKey=i;let o=this.gl;if(this.bindFBO(this.dialogBackdropFbo),o.disable(o.BLEND),this.backgroundColor){let[e,t,r]=this.backgroundColor;this.drawSolidFill(e,t,r,1)}else o.useProgram(this.wallpaperProgram),o.bindBuffer(o.ARRAY_BUFFER,this.quadBuffer),o.enableVertexAttribArray(this.aPosLocWp),o.vertexAttribPointer(this.aPosLocWp,2,o.FLOAT,!1,0,0),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,this.wallpaperTexture),o.uniform1i(this.uWp.uBackdrop,0),o.uniform2f(this.uWp.uCanvasSize,this.canvas.width,this.canvas.height),o.uniform2f(this.uWp.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),o.drawArrays(o.TRIANGLES,0,6);e[3]>.001&&(o.enable(o.BLEND),o.blendFuncSeparate(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA,o.ONE,o.ONE_MINUS_SRC_ALPHA),this.drawSolidFill(e[0],e[1],e[2],e[3]),o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA)),this.bindFBO(this.blurFboA),this.drawColorControls(this.dialogBackdropTex,t,r,a),this.bindFBO(this.dialogBackdropFbo),this.drawCopy(this.blurFboATex)},renderNonGlassElement(e,t,r,a){let i=this.gl,o=t;if(null!=e.enterProgress){let r=e.enterProgress,a=r<0?-((1-Math.exp(-Math.abs(r)))*1):r<=1?r:1+(1-Math.exp(-(r-1))),i=null!=e.enterStretchFactor&&a>1?e.enterStretchFactor*(a-1)*32:0;o={x:t.x,y:t.y+-48*(1-a)+i,w:t.w,h:t.h}}if("plain-rect"===e.kind&&e.plainRect){let r,n=e.isToggleTrack?null:e.plainRect.color;if(n&&n[3]<=0)return!0;if(this.bindFBO(a),e.isToggleTrack){let t=this.toggleStates.get(e.isToggleTrack.groupId),a=t?t.fraction:0,i=e.isToggleTrack.offColor,o=e.isToggleTrack.onColor;r=[i[0]+(o[0]-i[0])*a,i[1]+(o[1]-i[1])*a,i[2]+(o[2]-i[2])*a,i[3]+(o[3]-i[3])*a]}else r=e.plainRect.color;let s=o;if(e.isSliderFill){let r=this.toggleStates.get(e.isSliderFill.groupId),a=r?r.fraction:0,i=Math.max(e.isSliderFill.minW,e.isSliderFill.trackW*a);s={x:t.x,y:t.y,w:i,h:t.h}}i.useProgram(this.plainRectProgram),this.setSdfUniforms(this.uPr,this.aPosLocPr,s,e.cornerRadius),i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);let l=null!=e.enterProgress?F(null!=e.enterSafeProgress?Math.max(0,Math.min(1,e.enterSafeProgress)):Math.max(0,Math.min(1,e.enterProgress))):1;return i.uniform4f(this.uPr.uColor,r[0],r[1],r[2],r[3]*l),i.uniform1f(this.uPr.uCornerStyle,this.cornerStyle),e.useContinuousSdf&&this.continuousSdfTexture?(i.activeTexture(i.TEXTURE2),i.bindTexture(i.TEXTURE_2D,this.continuousSdfTexture),i.uniform1i(this.uPr.uContinuousSdf,2),i.uniform1f(this.uPr.uUseContinuousSdf,1),i.uniform2f(this.uPr.uContinuousSdfTexSize,this.continuousSdfTexSize[0],this.continuousSdfTexSize[1]),i.uniform2f(this.uPr.uContinuousSdfElementSize,o.w*this.dpr,o.h*this.dpr)):i.uniform1f(this.uPr.uUseContinuousSdf,0),i.drawArrays(i.TRIANGLES,0,6),!0}if("progressive-blur"===e.kind&&e.progressiveBlur){this.bindFBO(a),i.useProgram(this.progressiveBlurProgram),this.setSdfUniforms(this.uPb,this.aPosLocPb,o,e.cornerRadius),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,this.wallpaperTexture),i.uniform1i(this.uPb.uBackdrop,0),i.uniform2f(this.uPb.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),i.uniform1f(this.uPb.uBlurRadius,e.progressiveBlur.blurRadius*this.dpr);let t=e.progressiveBlur.tintColor;return i.uniform4f(this.uPb.uTintColor,t[0],t[1],t[2],t[3]),i.uniform1f(this.uPb.uTintIntensity,e.progressiveBlur.tintIntensity),i.drawArrays(i.TRIANGLES,0,6),!0}if("text"===e.kind){this.bindFBO(a);let t=o,n=1,s=1;if(e.isBottomTabContent){let r=this.toggleStates.get(e.isBottomTabContent.groupId);if(r){let a=1+16/(e.isBottomTabContent.containerWidth??4*e.rect.w)*r.pressProgress;n=a,s=a;let i=e.isBottomTabContent.containerCenterX??e.rect.x+e.rect.w/2,o=e.isBottomTabContent.containerCenterY??e.rect.y+e.rect.h/2,l=e.rect.x+e.rect.w/2,u=e.rect.y+e.rect.h/2,c=i+(l-i)*a+r.panelOffset,h=e.rect.w*n,d=e.rect.h*s;t={x:c-h/2,y:o+(u-o)*a-d/2,w:h,h:d}}}let l=r?.pressProgress??0;if(e.isInteractive&&l>.001){let r=e.pressTintColor;i.useProgram(this.tintProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocTn),i.vertexAttribPointer(this.aPosLocTn,2,i.FLOAT,!1,0,0),r?i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA):i.blendFunc(i.SRC_ALPHA,i.ONE),i.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),i.uniform2f(this.uTn.uOffset,t.x*this.dpr,t.y*this.dpr),i.uniform2f(this.uTn.uSize,t.w*this.dpr,t.h*this.dpr),i.uniform4f(this.uTn.uCornerRadii,0,0,0,0),i.uniform2f(this.uTn.uOriginalSize,t.w*this.dpr,t.h*this.dpr),i.uniform1f(this.uTn.uOriginalCornerRadius,0),i.uniform2f(this.uTn.uLayerScale,1,1),r?i.uniform4f(this.uTn.uColor,r[0],r[1],r[2],.1*l):i.uniform4f(this.uTn.uColor,1,1,1,.1*l),i.drawArrays(i.TRIANGLES,0,6),i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA)}let u=this.fgTextures.get(e.id);return u&&(i.useProgram(this.foregroundProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocFg),i.vertexAttribPointer(this.aPosLocFg,2,i.FLOAT,!1,0,0),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,u),i.uniform1i(this.uFg.uTexture,0),i.uniform2f(this.uFg.uCanvasSize,this.canvas.width,this.canvas.height),i.uniform2f(this.uFg.uOffset,t.x*this.dpr,t.y*this.dpr),i.uniform2f(this.uFg.uSize,t.w*this.dpr,t.h*this.dpr),i.uniform4f(this.uFg.uCornerRadii,e.cornerRadius*this.dpr,e.cornerRadius*this.dpr,e.cornerRadius*this.dpr,e.cornerRadius*this.dpr),i.uniform2f(this.uFg.uOriginalSize,e.rect.w*this.dpr,e.rect.h*this.dpr),i.uniform1f(this.uFg.uOriginalCornerRadius,e.cornerRadius*this.dpr),i.uniform2f(this.uFg.uLayerScale,n,s),i.uniform1f(this.uFg.uCornerStyle,this.cornerStyle),i.uniform1f(this.uFg.uAlpha,null!=e.enterProgress?F(null!=e.enterSafeProgress?Math.max(0,Math.min(1,e.enterSafeProgress)):Math.max(0,Math.min(1,e.enterProgress))):1),i.drawArrays(i.TRIANGLES,0,6),i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA)),!0}return!1}},{renderGlassElement(e,t,r,a,i,o,n){let s,l,u=this.gl,c="button"===e.kind,h=t?.pressProgress??0,d=4/48,f=1,g=0,p=0,m=1,b=1;if(null!=e.enterProgress){let t=e.enterProgress,r=t<0?-((1-Math.exp(-Math.abs(t)))*1):t<=1?t:1+(1-Math.exp(-(t-1)));p+=-48*(1-r),null!=e.enterStretchFactor&&r>1&&(p+=e.enterStretchFactor*(r-1)*32);let a=1+.1*Math.max(0,r-1);m/=a,b*=a}if(c&&e.isInteractive&&t){let r=e.rect.w,a=e.rect.h,i=Math.max(r,a),o=Math.min(r,a);f=1+d*h;let n=t.dragX-t.startDragX,s=t.dragY-t.startDragY;g=o*Math.tanh(.05*n/o),p=o*Math.tanh(.05*s/o);let l=Math.atan2(s,n),u=Math.min(r/a,1),c=Math.min(a/r,1);m=f+d*Math.abs(Math.cos(l)*n/i)*u,b=f+d*Math.abs(Math.sin(l)*s/i)*c}else null==e.enterProgress&&(m=f,b=f);let S=0,v=1,x=1,C=0;if(e.isToggleKnob){let t=this.toggleStates.get(e.isToggleKnob.groupId);if(t){S=t.fraction*e.isToggleKnob.dragWidth,v=t.scaleX,x=t.scaleY,C=t.pressProgress;let r=e.isToggleKnob.velocityDivisor??50,a=t.velocity/r,i=Math.max(-.2,Math.min(.2,.75*a)),o=Math.max(-.2,Math.min(.2,.25*a));v/=1-i,x*=1-o}}if(m*=v,b*=x,e.isBottomTabContainer){let t=this.toggleStates.get(e.isBottomTabContainer.groupId);if(t){let r=1+16/e.rect.w*t.pressProgress;m*=r,b*=r,g+=t.panelOffset,C=t.pressProgress}}if(e.isBottomTabContent){let t=this.toggleStates.get(e.isBottomTabContent.groupId);if(t){let r=1+16/(e.isBottomTabContent.containerWidth??e.rect.w)*t.pressProgress;m*=r;let a=1+.2*t.pressProgress;m*=a,b*=r*a,g+=t.panelOffset}}if(e.isBottomTabIndicator){let t=this.toggleStates.get(e.isBottomTabIndicator.groupId);if(t){S+=t.fraction*e.isBottomTabIndicator.dragWidth,S+=t.panelOffset;let r=t.scaleX,a=t.scaleY,i=t.velocity/10,o=Math.max(-.2,Math.min(.2,.75*i)),n=Math.max(-.2,Math.min(.2,.25*i));m*=r/(1-o),b*=a*(1-n),C=Math.max(C,t.pressProgress)}}null!=e.elementScaleX&&(m*=e.elementScaleX),null!=e.elementScaleY&&(b*=e.elementScaleY),s=n.x+e.rect.w/2+g+S,l=n.y+e.rect.h/2+p;let T=e.rect.w*m,y=e.rect.h*b,R=s-T/2,k=l-y/2,w=e.cornerRadius*Math.min(m,b),A=!!(e.independentBackdrop&&!this.backgroundColor&&this.wallpaperTexture);this.bindFBO(i),this.drawCopy(a),u.enable(u.BLEND),u.blendFunc(u.SRC_ALPHA,u.ONE_MINUS_SRC_ALPHA);let E=Math.max(0,Math.round((R-60)*this.dpr)),P=Math.max(0,Math.round((this.cssHeight-(k+y+60))*this.dpr)),M=Math.min(this.fboW-E,Math.round((T+120)*this.dpr)),_=Math.min(this.fboH-P,Math.round((y+120)*this.dpr));u.enable(u.SCISSOR_TEST),u.scissor(E,P,M,_);let B={el:e,st:t,isButton:c,p:h,sx:R,sy:k,sw:T,sh:y,radii:[w,w,w,w],togglePressProgress:C,elHighlightAlpha:e.isToggleKnob||e.isBottomTabIndicator?0:e.highlight?e.highlight.alpha:0,enterAlpha:null!=e.enterProgress?F(null!=e.enterSafeProgress?Math.max(0,Math.min(1,e.enterSafeProgress)):Math.max(0,Math.min(1,e.enterProgress))):1,layerScaleX:m,layerScaleY:b,layerScale:Math.min(m,b),origW:e.rect.w,origH:e.rect.h,origCornerRadius:e.cornerRadius,elementRotation:e.elementRotation??0,independent:A};if(this.renderGlassShadowPass(B),e.useSeparableBlur&&e.blurRadius>=.5){let t=e.blurRadius*B.layerScale*this.dpr,r=e.backdropFbo&&this.dialogBackdropTex?this.dialogBackdropTex:a,o=this.blurTexture(r,t);this.gl.enable(this.gl.BLEND),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA),this.bindFBO(i),this.gl.viewport(0,0,this.fboW,this.fboH);let n=e.backdropFbo?{...B,el:{...e,backdropFbo:!1}}:B;this.renderGlassElementPass(n,o)}else this.renderGlassElementPass(B,a);return this.renderGlassPostPasses(B),u.disable(u.SCISSOR_TEST),{curFbo:i,curTex:o,otherFbo:r,otherTex:a}},renderGlassShadowPass(e){let t=this.gl,{el:r,sx:a,sy:i,sw:o,sh:n,radii:s}=e;if(!r.outerShadow||r.outerShadow.radius<=.5)return;let l=r.outerShadow.alpha;r.isBottomTabIndicator&&(l*=e.togglePressProgress),l<=.001||(t.useProgram(this.shadowProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocSh),t.vertexAttribPointer(this.aPosLocSh,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.uniform2f(this.uSh.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uSh.uElementOffset,a*this.dpr,i*this.dpr),t.uniform2f(this.uSh.uElementSize,o*this.dpr,n*this.dpr),t.uniform4f(this.uSh.uCornerRadii,s[0]*this.dpr,s[1]*this.dpr,s[2]*this.dpr,s[3]*this.dpr),t.uniform2f(this.uSh.uOriginalSize,e.origW*this.dpr,e.origH*this.dpr),t.uniform1f(this.uSh.uOriginalCornerRadius,e.origCornerRadius*this.dpr),t.uniform2f(this.uSh.uLayerScale,e.layerScaleX,e.layerScaleY),t.uniform1f(this.uSh.uElementRotation,e.elementRotation),t.uniform1f(this.uSh.uCornerStyle,this.cornerStyle),t.uniform1f(this.uSh.uShadowRadius,r.outerShadow.radius*this.dpr),t.uniform2f(this.uSh.uShadowOffset,r.outerShadow.offsetX*this.dpr,r.outerShadow.offsetY*this.dpr),t.uniform4f(this.uSh.uShadowColor,r.outerShadow.color[0],r.outerShadow.color[1],r.outerShadow.color[2],l),t.drawArrays(t.TRIANGLES,0,6))}},{renderGlassElementPass(e,t){let r=this.gl,{el:a,sx:i,sy:o,sw:n,sh:s,radii:l,togglePressProgress:u,layerScale:c}=e;r.useProgram(this.elementProgram),r.bindBuffer(r.ARRAY_BUFFER,this.quadBuffer),r.enableVertexAttribArray(this.aPosLocEl),r.vertexAttribPointer(this.aPosLocEl,2,r.FLOAT,!1,0,0),r.blendFunc(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,t),r.uniform1i(this.uEl.uBackdrop,0),this.wallpaperTexture&&(r.activeTexture(r.TEXTURE1),r.bindTexture(r.TEXTURE_2D,this.wallpaperTexture),r.uniform1i(this.uEl.uWallpaperSampler,1)),r.uniform2f(this.uEl.uCanvasSize,this.canvas.width,this.canvas.height),r.uniform2f(this.uEl.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),r.uniform2f(this.uEl.uElementOffset,i*this.dpr,o*this.dpr),r.uniform2f(this.uEl.uElementSize,n*this.dpr,s*this.dpr),r.uniform4f(this.uEl.uCornerRadii,l[0]*this.dpr,l[1]*this.dpr,l[2]*this.dpr,l[3]*this.dpr),r.uniform2f(this.uEl.uOriginalSize,e.origW*this.dpr,e.origH*this.dpr),r.uniform1f(this.uEl.uOriginalCornerRadius,e.origCornerRadius*this.dpr),r.uniform2f(this.uEl.uLayerScale,e.layerScaleX,e.layerScaleY),r.uniform1f(this.uEl.uElementRotation,a.elementRotation??0);let h=a.refractionHeight,d=a.refractionAmount,f=a.blurRadius,g=a.highlight?a.highlight.alpha:0,p=a.surfaceColor[3];a.isBottomTabIndicator&&(h=a.refractionHeight*u,d=a.refractionAmount*u,f=0,g=(a.highlight?.alpha??0)*u);let m=1,b=1,S=0,v=0,x=1,C=1,T=1,y=1,R=0,k=0,w=0,A=0,E=0,P=0,M=0,F=0,_=0;if(a.isToggleKnob){h=a.refractionHeight*u,d=a.refractionAmount*u,f=8*(1-u),g=(a.highlight?.alpha??0)*u,p=0;let e=10===a.isToggleKnob.velocityDivisor,t=e?1:.75,r=e?1:.75;if(m=2/3+(t-2/3)*u,b=0+(r-0)*u,a.isToggleKnob.trackColorOff&&a.isToggleKnob.trackColorOn&&a.isToggleKnob.trackW&&a.isToggleKnob.trackH){let e=this.toggleStates.get(a.isToggleKnob.groupId),l=e?e.fraction:0,c=a.isToggleKnob.trackColorOff,h=a.isToggleKnob.trackColorOn;R=c[0]+(h[0]-c[0])*l,k=c[1]+(h[1]-c[1])*l,w=c[2]+(h[2]-c[2])*l,A=c[3]+(h[3]-c[3])*l;let d=(i+n/2)*this.dpr,f=(o+s/2)*this.dpr,g=a.isToggleKnob.trackOriginalX??a.rect.x,p=a.isToggleKnob.trackOriginalY??a.rect.y,B=a.scroll?p-this.scrollY:p,D=(g+a.isToggleKnob.trackW/2)*this.dpr,z=(B+a.isToggleKnob.trackH/2)*this.dpr,L=2/3+(t-2/3)*u,O=0+(r-0)*u;E=d+(D-d)*L,P=f+(z-f)*O;let I=a.isToggleKnob.trackW*this.dpr,H=a.isToggleKnob.trackH*this.dpr;if(M=I*L*.5,F=H*O*.5,_=.5*H*Math.min(L,O),S=1,a.isToggleKnob.solidBackdropColor){let e=a.isToggleKnob.solidBackdropColor;x=e[0],C=e[1],T=e[2],y=e[3],v=1}m=1,b=1}}let B=0,D=0,z=0,L=0,O=0,I=0,H=0,U=0,W=0,N=0;if(a.isBottomTabIndicator&&(h=a.refractionHeight*u,d=a.refractionAmount*u,g=(a.highlight?.alpha??0)*u,a.isBottomTabIndicator.accentColor&&a.isBottomTabIndicator.containerRect)){let e=a.isBottomTabIndicator.accentColor,t=a.isBottomTabIndicator.containerRect;H=e[0],U=e[1],W=e[2],N=1,D=(t.x+t.w/2)*this.dpr,z=(t.y+t.h/2)*this.dpr,L=t.w/2*this.dpr,O=t.h/2*this.dpr,I=t.h/2*this.dpr,B=1}if(r.uniform1f(this.uEl.uUseToggleBackdrop,S),r.uniform1f(this.uEl.uUseSolidBackdrop,v),r.uniform4f(this.uEl.uSolidBackdropColor,x,C,T,y),r.uniform4f(this.uEl.uTrackColor,R,k,w,A),r.uniform4f(this.uEl.uTrackRect,E,P,M,F),r.uniform1f(this.uEl.uTrackCornerRadius,_),r.uniform1f(this.uEl.uIndicatorBackdrop,B),r.uniform4f(this.uEl.uContainerRect,D,z,L,O),r.uniform1f(this.uEl.uContainerCornerRadius,I),r.uniform4f(this.uEl.uIndicatorAccent,H,U,W,N),r.uniform1f(this.uEl.uInsetPx,4*this.dpr),a.isBottomTabIndicator){let e=this.toggleStates.get(a.isBottomTabIndicator.groupId);r.uniform1f(this.uEl.uIndicatorPressProgress,e?e.pressProgress:0),r.uniform1f(this.uEl.uIndicatorPanelOffset,e?e.panelOffset*this.dpr:0),r.uniform1f(this.uEl.uDpr,this.dpr);let t=a.isBottomTabIndicator.containerCenterX??0,i=a.isBottomTabIndicator.containerCenterY??0,o=a.isBottomTabIndicator.containerWidth??a.rect.w,n=e?1+16/o*e.pressProgress:1;r.uniform2f(this.uEl.uContainerCenter,t*this.dpr,i*this.dpr),r.uniform1f(this.uEl.uContainerScale,n);let s=a.isBottomTabIndicator.tabContentIds??[],l=a.isBottomTabIndicator.tabContentRects??[],u=Math.min(s.length,l.length,8),c=0;for(let e=0;e<8;e++)if(e<u){let t=this.fgTextures.get(s[e]);if(t){r.activeTexture(r.TEXTURE3+c),r.bindTexture(r.TEXTURE_2D,t),r.uniform1i(this.uEl[`uTabContentTex${c}`],3+c);let a=l[e];r.uniform4f(this.uEl[`uTabContentRects[${c}]`],(a.x+a.w/2)*this.dpr,(a.y+a.h/2)*this.dpr,a.w/2*this.dpr,a.h/2*this.dpr),c++}}for(let e=c;e<8;e++)r.uniform4f(this.uEl[`uTabContentRects[${e}]`],0,0,0,0);r.uniform1f(this.uEl.uTabContentCount,c),this.tabsBackdropTex&&(r.activeTexture(r.TEXTURE11),r.bindTexture(r.TEXTURE_2D,this.tabsBackdropTex),r.uniform1i(this.uEl.uTabsGlassLayer,11));{let e=2*L,t=2*O,a=I,i=Math.max(1,2*Math.ceil(Math.min(.5*this.dpr,.5*Math.min(e,t)))),o=Math.max(0,.25*this.dpr),n=Math.ceil(i)+4,s=Math.max(1,Math.ceil(e+2*n)),l=Math.max(1,Math.ceil(t+2*n)),u=Math.min(2,Math.max(1,Math.floor((window.devicePixelRatio||1)/this.dpr))),c=s*u,h=l*u,d=["inner-rr",e.toFixed(3),t.toFixed(3),a.toFixed(3),i,o.toFixed(3),n,s,l,`ss${u}`].join(":"),f=this.strokeMaskCache.get(d);if(!f){let e=document.createElement("canvas");e.width=c,e.height=h;let t=e.getContext("2d",{alpha:!0});if(!t)throw Error("2D canvas not supported");let a=r.createTexture();if(!a)throw Error("WebGL texture allocation failed");if(f={tex:a,canvas:e,ctx:t,w:s,h:l,ready:!1},this.strokeMaskCache.set(d,f),this.strokeMaskCache.size>32){let e=this.strokeMaskCache.keys().next().value;if(e&&e!==d){let t=this.strokeMaskCache.get(e);t&&r.deleteTexture(t.tex),this.strokeMaskCache.delete(e)}}}if(!f.ready){let s=f.ctx;s.clearRect(0,0,c,h),s.save(),s.scale(u,u),s.translate(n,n);let l=Math.min(a,e/2,t/2),d=new Path2D;d.moveTo(l,0),d.lineTo(e-l,0),d.arcTo(e,0,e,l,l),d.lineTo(e,t-l),d.arcTo(e,t,e-l,t,l),d.lineTo(l,t),d.arcTo(0,t,0,t-l,l),d.lineTo(0,l),d.arcTo(0,0,l,0,l),d.closePath(),s.clip(d),s.lineWidth=i,s.strokeStyle="rgba(255,255,255,1)",s.lineJoin="round",s.lineCap="round",s.filter=o>.01?`blur(${o}px)`:"none",s.stroke(d),s.filter="none",s.restore(),r.bindTexture(r.TEXTURE_2D,f.tex),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!1),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,f.canvas),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),f.ready=!0}r.activeTexture(r.TEXTURE12),r.bindTexture(r.TEXTURE_2D,f.tex),r.uniform1i(this.uEl.uInnerStrokeMask,12),r.uniform2f(this.uEl.uInnerStrokeMaskOffset,n,n),r.uniform2f(this.uEl.uInnerStrokeMaskSize,f.w,f.h)}}else r.uniform1f(this.uEl.uIndicatorPressProgress,0),r.uniform1f(this.uEl.uIndicatorPanelOffset,0),r.uniform1f(this.uEl.uDpr,this.dpr),r.uniform2f(this.uEl.uContainerCenter,0,0),r.uniform1f(this.uEl.uContainerScale,1),r.uniform1f(this.uEl.uTabContentCount,0),r.uniform2f(this.uEl.uInnerStrokeMaskOffset,1,1),r.uniform2f(this.uEl.uInnerStrokeMaskSize,1,1);r.uniform1f(this.uEl.uRefractionHeight,h*this.dpr),r.uniform1f(this.uEl.uRefractionAmount,d*this.dpr),r.uniform1f(this.uEl.uDepthEffect,+!!a.depthEffect),r.uniform1f(this.uEl.uChromaticAberration,+!!a.chromaticAberration);let X=a.useSeparableBlur&&a.blurRadius>=.5?0:f;if(r.uniform1f(this.uEl.uBlurRadius,X*c*this.dpr),r.uniform1f(this.uEl.uSaturation,a.saturation),r.uniform1f(this.uEl.uBrightness,a.brightness),r.uniform1f(this.uEl.uContrast,a.contrast),r.uniform1f(this.uEl.uContentScaleX,m),r.uniform1f(this.uEl.uContentScaleY,b),r.uniform4f(this.uEl.uTintColor,a.tintColor[0],a.tintColor[1],a.tintColor[2],a.tintColor[3]),r.uniform4f(this.uEl.uSurfaceColor,a.surfaceColor[0],a.surfaceColor[1],a.surfaceColor[2],p),a.highlight){r.uniform3f(this.uEl.uHighlightColor,a.highlight.color[0],a.highlight.color[1],a.highlight.color[2]),r.uniform1f(this.uEl.uHighlightAngle,a.highlight.angle),r.uniform1f(this.uEl.uHighlightFalloff,a.highlight.falloff),r.uniform1f(this.uEl.uHighlightAlpha,g),r.uniform1f(this.uEl.uHighlightMode,a.highlight.mode);let t=Math.min(e.origW,e.origH)*this.dpr,i=Math.min(a.highlight.widthDp*this.dpr,.5*t),o=(a.highlight.blurRadiusDp??a.highlight.widthDp/2)*this.dpr,n=!1!==a.highlight.aa?2*Math.ceil(i):2*Math.max(1,i);r.uniform1f(this.uEl.uHighlightStrokeWidth,n),r.uniform1f(this.uEl.uHighlightBlur,o)}else r.uniform1f(this.uEl.uHighlightAlpha,0),r.uniform1f(this.uEl.uHighlightMode,0),r.uniform1f(this.uEl.uHighlightStrokeWidth,0),r.uniform1f(this.uEl.uHighlightBlur,0);a.isSdfTexture&&this.sdfTexture?(r.activeTexture(r.TEXTURE2),r.bindTexture(r.TEXTURE_2D,this.sdfTexture),r.uniform1i(this.uEl.uSdfTexSampler,2),r.uniform1f(this.uEl.uUseSdfTexture,1),r.uniform2f(this.uEl.uSdfTexSize,this.sdfTextureSize[0],this.sdfTextureSize[1]),r.uniform1f(this.uEl.uSdfLightAngle,a.isSdfTexture.lightAngle),r.uniform1f(this.uEl.uRefractionHeight,a.isSdfTexture.refractionHeight*this.dpr)):r.uniform1f(this.uEl.uUseSdfTexture,0),a.useContinuousSdf&&this.continuousSdfTexture?(r.activeTexture(r.TEXTURE2),r.bindTexture(r.TEXTURE_2D,this.continuousSdfTexture),r.uniform1i(this.uEl.uContinuousSdf,2),r.uniform1f(this.uEl.uUseContinuousSdf,1),r.uniform2f(this.uEl.uContinuousSdfTexSize,this.continuousSdfTexSize[0],this.continuousSdfTexSize[1]),r.uniform2f(this.uEl.uContinuousSdfElementSize,e.origW*this.dpr,e.origH*this.dpr)):r.uniform1f(this.uEl.uUseContinuousSdf,0),r.uniform1f(this.uEl.uEnterAlpha,e.enterAlpha),r.uniform1f(this.uEl.uCornerStyle,this.cornerStyle),a.isMagnifier?(r.uniform1f(this.uEl.uUseMagnifier,1),r.uniform1f(this.uEl.uMagnifierZoom,a.isMagnifier.zoom),r.uniform1f(this.uEl.uMagnifierOffsetY,a.isMagnifier.sampleOffsetY*this.dpr)):r.uniform1f(this.uEl.uUseMagnifier,0),r.uniform1f(this.uEl.uSkipColorControls,a.backdropFbo&&a.useSeparableBlur&&a.blurRadius>=.5?1:0);let G=a.sampleWallpaper;r.uniform1f(this.uEl.uSampleWallpaper,+!!G),a.scrimColor?r.uniform4f(this.uEl.uScrimColor,a.scrimColor[0],a.scrimColor[1],a.scrimColor[2],a.scrimColor[3]):r.uniform4f(this.uEl.uScrimColor,0,0,0,0),r.drawArrays(r.TRIANGLES,0,6),e.elHighlightAlpha=g}},{renderGlassPostPasses(e){let t=this.gl,{el:r,st:a,isButton:i,p:o,sx:n,sy:s,sw:l,sh:u,radii:c,togglePressProgress:h,elHighlightAlpha:d}=e,f=e.origW*this.dpr,g=e.origH*this.dpr,p=e.origCornerRadius*this.dpr,m=e.layerScaleX,b=e.layerScaleY,S=(a,i)=>{let o=r.isToggleKnob||r.isBottomTabIndicator?h:1,d=a.alpha*o*e.enterAlpha,S=a.radius*o,v=a.offsetX*o,x=a.offsetY*o;if(d<=.001||S<=.5)return;let C=S*this.dpr,T=Math.ceil(3*C)+2,y=Math.max(1,Math.ceil(f+2*T)),R=Math.max(1,Math.ceil(g+2*T)),k=Math.min(2,Math.max(1,Math.floor((window.devicePixelRatio||1)/this.dpr))),w=!!r.useContinuousSdf,A={w:f,h:g,radius:p,offsetX:v*this.dpr,offsetY:x*this.dpr,blurSigma:C,margin:T,useG2:w,supersample:k},E=["is",i,A.useG2?"g2":"rr",A.w.toFixed(3),A.h.toFixed(3),A.radius.toFixed(3),A.offsetX.toFixed(3),A.offsetY.toFixed(3),A.blurSigma.toFixed(3),A.margin,Math.ceil(A.w+2*A.margin),Math.ceil(A.h+2*A.margin),`ss${A.supersample}`].join(":"),P=function(e,t,r,a,i){let o=e.get(r);if(o)return o;let n=t.createTexture();if(!n)throw Error("WebGL texture allocation failed");if(o={tex:n,w:a,h:i,ready:!1},e.set(r,o),e.size>32){let a=e.keys().next().value;if(a&&a!==r){let r=e.get(a);r&&t.deleteTexture(r.tex),e.delete(a)}}return o}(this.innerShadowMaskCache,t,E,y,R);if(!P.ready){let e=function(e){let{w:t,h:r,radius:a,offsetX:i,offsetY:o,blurSigma:n,margin:s,useG2:l,supersample:u}=e,c=Math.max(1,Math.ceil(t+2*s)),h=Math.max(1,Math.ceil(r+2*s)),d=c*u,f=h*u,{canvas:g,ctx:p}=V(d,f),{canvas:m,ctx:b}=V(d,f);p.save(),p.scale(u,u),p.translate(s,s);let S=function(e,t,r,a){if(a)return D(new OffscreenCanvas(1,1).getContext("2d"),e,t,r);let i=new Path2D;if("function"==typeof i.roundRect)i.roundRect(0,0,e,t,r);else{let a=Math.min(r,e/2,t/2);i.moveTo(a,0),i.lineTo(e-a,0),i.arcTo(e,0,e,a,a),i.lineTo(e,t-a),i.arcTo(e,t,e-a,t,a),i.lineTo(a,t),i.arcTo(0,t,0,t-a,a),i.lineTo(0,a),i.arcTo(0,0,a,0,a),i.closePath()}return i}(t,r,a,l);return p.clip(S),p.globalCompositeOperation="source-over",p.fillStyle="white",p.fill(S),p.globalCompositeOperation="destination-out",p.save(),p.translate(i,o),p.fill(S),p.restore(),p.globalCompositeOperation="source-over",p.restore(),n>.01?b.filter=`blur(${n*u}px)`:b.filter="none",b.drawImage(g,0,0),b.filter="none",{canvas:m,maskW:c,maskH:h,margin:s}}(A);t.bindTexture(t.TEXTURE_2D,P.tex),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e.canvas),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),P.ready=!0}t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.useProgram(this.innerShadowMaskCompositeProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocIs),t.vertexAttribPointer(this.aPosLocIs,2,t.FLOAT,!1,0,0),t.uniform2f(this.uIs.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uIs.uOffset,n*this.dpr,s*this.dpr),t.uniform2f(this.uIs.uSize,l*this.dpr,u*this.dpr),t.uniform4f(this.uIs.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,P.tex),t.uniform1i(this.uIs.uInnerShadowMask,0),t.uniform2f(this.uIs.uMaskOffset,T,T),t.uniform2f(this.uIs.uMaskSize,P.w,P.h);let M=a.color??[0,0,0];t.uniform3f(this.uIs.uInnerShadowColor,M[0],M[1],M[2]),t.uniform1f(this.uIs.uInnerShadowAlpha,d),t.uniform2f(this.uIs.uOriginalSize,f,g),t.uniform1f(this.uIs.uOriginalCornerRadius,p),t.uniform2f(this.uIs.uLayerScale,m,b),t.uniform1f(this.uIs.uElementRotation,e.elementRotation),t.drawArrays(t.TRIANGLES,0,6)};r.innerShadow&&S(r.innerShadow,0);let v=!!r.isBottomTabContainer,x=i?o:v?h:0;if(i&&r.isInteractive&&a&&o>.001||v&&h>.001){let i,o;t.useProgram(this.tintProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocTn),t.vertexAttribPointer(this.aPosLocTn,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE),t.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uTn.uOffset,n*this.dpr,s*this.dpr),t.uniform2f(this.uTn.uSize,l*this.dpr,u*this.dpr),t.uniform4f(this.uTn.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),t.uniform2f(this.uTn.uOriginalSize,f,g),t.uniform1f(this.uTn.uOriginalCornerRadius,p),t.uniform2f(this.uTn.uLayerScale,m,b),t.uniform1f(this.uTn.uElementRotation,e.elementRotation),t.uniform1f(this.uTn.uCornerStyle,this.cornerStyle),t.uniform4f(this.uTn.uColor,1,1,1,.08*x),t.drawArrays(t.TRIANGLES,0,6),t.useProgram(this.highlightProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocHl),t.vertexAttribPointer(this.aPosLocHl,2,t.FLOAT,!1,0,0),t.blendFunc(t.ONE,t.ONE),t.uniform2f(this.uHl.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uHl.uOffset,n*this.dpr,s*this.dpr),t.uniform2f(this.uHl.uSize,l*this.dpr,u*this.dpr),t.uniform4f(this.uHl.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),t.uniform2f(this.uHl.uOriginalSize,f,g),t.uniform1f(this.uHl.uOriginalCornerRadius,p),t.uniform2f(this.uHl.uLayerScale,m,b),t.uniform1f(this.uHl.uElementRotation,e.elementRotation),t.uniform1f(this.uHl.uCornerStyle,this.cornerStyle),t.uniform4f(this.uHl.uColor,1,1,1,.15*x);let h=Math.min(l,u)*this.dpr;if(t.uniform1f(this.uHl.uRadius,1.5*h),v){let e=this.toggleStates.get(r.isBottomTabContainer.groupId),t=r.isBottomTabContainer.tabsCount??4,a=r.rect.w/t,n=e?e.fraction:0,s=l/r.rect.w;i=Math.max(0,Math.min(l,(n+.5)*a*s))*this.dpr,o=u/2*this.dpr}else i=Math.max(0,Math.min(l,a.dragX*e.layerScaleX))*this.dpr,o=Math.max(0,Math.min(u,a.dragY*e.layerScaleY))*this.dpr;t.uniform2f(this.uHl.uPosition,i,o),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA)}if(r.isToggleKnob&&h<.999&&(t.useProgram(this.tintProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocTn),t.vertexAttribPointer(this.aPosLocTn,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uTn.uOffset,n*this.dpr,s*this.dpr),t.uniform2f(this.uTn.uSize,l*this.dpr,u*this.dpr),t.uniform4f(this.uTn.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),t.uniform2f(this.uTn.uOriginalSize,f,g),t.uniform1f(this.uTn.uOriginalCornerRadius,p),t.uniform2f(this.uTn.uLayerScale,m,b),t.uniform1f(this.uTn.uElementRotation,e.elementRotation),t.uniform1f(this.uTn.uCornerStyle,this.cornerStyle),t.uniform4f(this.uTn.uColor,1,1,1,+(1-h)),t.drawArrays(t.TRIANGLES,0,6)),r.isBottomTabIndicator&&r.isBottomTabIndicator.dimColor){let a=r.isBottomTabIndicator.dimColor;t.useProgram(this.tintProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocTn),t.vertexAttribPointer(this.aPosLocTn,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uTn.uOffset,n*this.dpr,s*this.dpr),t.uniform2f(this.uTn.uSize,l*this.dpr,u*this.dpr),t.uniform4f(this.uTn.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),t.uniform2f(this.uTn.uOriginalSize,f,g),t.uniform1f(this.uTn.uOriginalCornerRadius,p),t.uniform2f(this.uTn.uLayerScale,m,b),t.uniform1f(this.uTn.uElementRotation,e.elementRotation),t.uniform1f(this.uTn.uCornerStyle,this.cornerStyle),t.uniform4f(this.uTn.uColor,a[0],a[1],a[2],.1*(1-h)),t.drawArrays(t.TRIANGLES,0,6),t.uniform4f(this.uTn.uColor,0,0,0,.03*h),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA)}if(i&&(r.label||r.icon)){let a=this.fgTextures.get(r.id);a&&(t.useProgram(this.foregroundProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocFg),t.vertexAttribPointer(this.aPosLocFg,2,t.FLOAT,!1,0,0),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,a),t.uniform1i(this.uFg.uTexture,0),t.uniform2f(this.uFg.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uFg.uOffset,n*this.dpr,s*this.dpr),t.uniform2f(this.uFg.uSize,l*this.dpr,u*this.dpr),t.uniform4f(this.uFg.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),t.uniform2f(this.uFg.uOriginalSize,f,g),t.uniform1f(this.uFg.uOriginalCornerRadius,p),t.uniform2f(this.uFg.uLayerScale,m,b),t.uniform1f(this.uFg.uCornerStyle,this.cornerStyle),r.useContinuousSdf&&this.continuousSdfTexture?(t.activeTexture(t.TEXTURE2),t.bindTexture(t.TEXTURE_2D,this.continuousSdfTexture),t.uniform1i(this.uFg.uContinuousSdf,2),t.uniform1f(this.uFg.uUseContinuousSdf,1),t.uniform2f(this.uFg.uContinuousSdfTexSize,this.continuousSdfTexSize[0],this.continuousSdfTexSize[1]),t.uniform2f(this.uFg.uContinuousSdfElementSize,e.origW*this.dpr,e.origH*this.dpr)):t.uniform1f(this.uFg.uUseContinuousSdf,0),t.uniform1f(this.uFg.uAlpha,1-.15*o),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA))}if(r.highlight&&r.highlight.alpha>.001){let a=r.isToggleKnob||r.isBottomTabIndicator?d:r.highlight.alpha,i=1===r.highlight.mode?.38:1,o=a*e.enterAlpha*i;if(o>.001){let a=Math.min(r.highlight.widthDp*this.dpr,.5*Math.min(f,g)),i=!1!==r.highlight.aa?Math.max(1,2*Math.ceil(a)):Math.max(1,2*Math.round(a)),h=Math.max(0,(r.highlight.blurRadiusDp??r.highlight.widthDp/2)*this.dpr),d=Math.ceil(i)+4,S=Math.max(1,Math.ceil(f+2*d)),v=Math.max(1,Math.ceil(g+2*d)),x=Math.min(2,Math.max(1,Math.floor((window.devicePixelRatio||1)/this.dpr))),C=S*x,T=v*x,y=!!r.useContinuousSdf,R=[y?"g2":"rr",f.toFixed(3),g.toFixed(3),p.toFixed(3),i,h.toFixed(3),d,S,v,`ss${x}`].join(":"),k=this.strokeMaskCache.get(R);if(!k){let e=document.createElement("canvas");e.width=C,e.height=T;let r=e.getContext("2d",{alpha:!0});if(!r)throw Error("2D canvas not supported");let a=t.createTexture();if(!a)throw Error("WebGL texture allocation failed");if(k={tex:a,canvas:e,ctx:r,w:S,h:v,ready:!1},this.strokeMaskCache.set(R,k),this.strokeMaskCache.size>32){let e=this.strokeMaskCache.keys().next().value;if(e&&e!==R){let r=this.strokeMaskCache.get(e);r&&t.deleteTexture(r.tex),this.strokeMaskCache.delete(e)}}}if(!k.ready){let e,r=k.ctx;if(r.clearRect(0,0,C,T),r.save(),r.scale(x,x),r.translate(d,d),y)e=D(r,f,g,p);else{e=new Path2D;let t=Math.min(p,f/2,g/2);e.moveTo(t,0),e.lineTo(f-t,0),e.arcTo(f,0,f,t,t),e.lineTo(f,g-t),e.arcTo(f,g,f-t,g,t),e.lineTo(t,g),e.arcTo(0,g,0,g-t,t),e.lineTo(0,t),e.arcTo(0,0,t,0,t),e.closePath()}r.clip(e),r.lineWidth=i,r.strokeStyle="rgba(255,255,255,1)",r.lineJoin="round",r.lineCap="round",r.filter=h>.01?`blur(${h}px)`:"none",r.stroke(e),r.filter="none",r.restore(),t.bindTexture(t.TEXTURE_2D,k.tex),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,k.canvas),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),k.ready=!0}t.enable(t.BLEND),1===r.highlight.mode?t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA):t.blendFunc(t.ONE,t.ONE),t.useProgram(this.strokeMaskCompositeProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocSm),t.vertexAttribPointer(this.aPosLocSm,2,t.FLOAT,!1,0,0),t.uniform2f(this.uSm.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uSm.uOffset,n*this.dpr,s*this.dpr),t.uniform2f(this.uSm.uSize,l*this.dpr,u*this.dpr),t.uniform4f(this.uSm.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,k.tex),t.uniform1i(this.uSm.uStrokeMask,0),t.uniform2f(this.uSm.uMaskOffset,d,d),t.uniform2f(this.uSm.uMaskSize,k.w,k.h),t.uniform4f(this.uSm.uHighlightColor,r.highlight.color[0],r.highlight.color[1],r.highlight.color[2],1),t.uniform1f(this.uSm.uHighlightAngle,r.useGravityAngle?this.gravityAngle:r.highlight.angle),t.uniform1f(this.uSm.uHighlightFalloff,r.highlight.falloff),t.uniform1f(this.uSm.uHighlightAlpha,o),t.uniform1f(this.uSm.uHighlightMode,r.highlight.mode),t.uniform2f(this.uSm.uOriginalSize,f,g),t.uniform1f(this.uSm.uOriginalCornerRadius,p),t.uniform2f(this.uSm.uLayerScale,m,b),t.uniform1f(this.uSm.uElementRotation,e.elementRotation),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA)}}}});var $=((t={})[t.Home=0]="Home",t[t.Buttons=1]="Buttons",t[t.Toggle=2]="Toggle",t[t.Slider=3]="Slider",t[t.BottomTabs=4]="BottomTabs",t[t.Dialog=5]="Dialog",t[t.LockScreen=6]="LockScreen",t[t.ControlCenter=7]="ControlCenter",t[t.Magnifier=8]="Magnifier",t[t.GlassPlayground=9]="GlassPlayground",t[t.AdaptiveLuminanceGlass=10]="AdaptiveLuminanceGlass",t[t.ProgressiveBlur=11]="ProgressiveBlur",t[t.ScrollContainer=12]="ScrollContainer",t[t.LazyScrollContainer=13]="LazyScrollContainer",t[t.Settings=14]="Settings",t[t.About=15]="About",t[t.PerfBenchmark=16]="PerfBenchmark",t);let K=new Set,j={handle:null,lastVelocity:0},Z={refractionHeight:12,refractionAmount:-24,depthEffect:!1,chromaticAberration:!1,blurRadius:2,saturation:1.5,brightness:0,contrast:1},J={mode:0,color:[1,1,1],angle:45*Math.PI/180,falloff:1,alpha:.5,widthDp:.5},Q={radius:24,alpha:.1,offsetX:0,offsetY:4,color:[0,0,0]},ee={homeContentColor:[0,0,0,1],homeSubtitleColor:[0,136/255,1,1],homeTextHalo:"dark",toggleAccent:[52/255,199/255,89/255],toggleTrackOff:[120/255,120/255,120/255,.2],toggleCardBg:[1,1,1,1],sliderAccent:[0,136/255,1],sliderTrackOff:[120/255,120/255,120/255,.2],sliderCardBg:[1,1,1,1],tabsContentColor:[0,0,0,1],tabsAccent:[0,136/255,1],tabsContainer:[250/255,250/255,250/255,.4],tabsTextHalo:"dark",dialogContentColor:[0,0,0,1],dialogAccent:[0,136/255,1,1],dialogContainer:[250/255,250/255,250/255,.6],dialogDim:[41/255,41/255,58/255,.23],dialogBlurRadius:16,dialogBrightness:.2,magnifierContentColor:[0,0,0,1],magnifierAccent:[0,136/255,1,1],magnifierCardBg:[1,1,1,.9],controlCenterAccent:[0,136/255,1,1],progressiveContentColor:[0,0,0,1],progressiveTint:[1,1,1,1],progressiveTextHalo:"dark",adaptiveContentColor:[0,0,0,1],backIconColor:[0,0,0,1],buttonSurface:[1,1,1,.3]},et={homeContentColor:[1,1,1,1],homeSubtitleColor:[0,136/255,1,1],homeTextHalo:"light",toggleAccent:[48/255,209/255,88/255],toggleTrackOff:[120/255,120/255,128/255,.36],toggleCardBg:[18/255,18/255,18/255,1],sliderAccent:[0,145/255,1],sliderTrackOff:[120/255,120/255,128/255,.36],sliderCardBg:[18/255,18/255,18/255,1],tabsContentColor:[1,1,1,1],tabsAccent:[0,145/255,1],tabsContainer:[18/255,18/255,18/255,.4],tabsTextHalo:"light",dialogContentColor:[1,1,1,1],dialogAccent:[0,145/255,1,1],dialogContainer:[18/255,18/255,18/255,.4],dialogDim:[18/255,18/255,18/255,.56],dialogBlurRadius:8,dialogBrightness:0,magnifierContentColor:[1,1,1,1],magnifierAccent:[0,145/255,1,1],magnifierCardBg:[18/255,18/255,18/255,.9],controlCenterAccent:[0,145/255,1,1],progressiveContentColor:[1,1,1,1],progressiveTint:[128/255,128/255,128/255,1],progressiveTextHalo:"light",adaptiveContentColor:[1,1,1,1],backIconColor:[1,1,1,1],buttonSurface:[18/255,18/255,18/255,.4]};ee.toggleAccent,ee.toggleTrackOff,ee.sliderAccent,ee.sliderTrackOff,ee.dialogContainer,ee.dialogAccent,ee.dialogDim;let er="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",ea="M400 552 L147 653 q-24 10 -45.5 -4.5 T80 608 v-22 q0 -12 5.5 -23 t15.5 -18 l299 -209 v-176 q0 -33 23.5 -56.5 T480 80 q33 0 56.5 23.5 T560 160 v176 l299 209 q10 7 15.5 18 t5.5 23 v22 q0 26 -21.5 40.5 T813 653 L560 552 v144 l103 72 q8 6 12.5 14.5 T680 801 v24 q0 20 -16.5 32.5 T627 864 l-147 -44 l-147 44 q-20 6 -36.5 -6.5 T280 825 v-24 q0 -10 4.5 -18.5 T297 768 l103 -72 v-144 Z",ei=[{titleKey:"section_glass",items:[{dest:1,labelKey:"item_buttons"},{dest:2,labelKey:"item_toggle"},{dest:3,labelKey:"item_slider"},{dest:4,labelKey:"item_bottom_tabs"},{dest:5,labelKey:"item_dialog"}]},{titleKey:"section_system",items:[{dest:6,labelKey:"item_lock_screen"},{dest:7,labelKey:"item_control_center"},{dest:8,labelKey:"item_magnifier"}]},{titleKey:"section_experiments",items:[{dest:9,labelKey:"item_glass_playground"},{dest:10,labelKey:"item_adaptive_luminance"},{dest:11,labelKey:"item_progressive_blur"},{dest:12,labelKey:"item_scroll_container"},{dest:13,labelKey:"item_lazy_scroll"},{dest:16,labelKey:"item_perf_benchmark"}]},{titleKey:"section_system_nav",items:[{dest:14,labelKey:"item_settings"},{dest:15,labelKey:"item_about"}]}],eo={toggleOn:!1,sliderValue:50,selectedTab:0,selectedTab2:0,cornerRadiusFrac:.5,blurRadiusDp:0,refractionHeightFrac:.2,refractionAmountFrac:.2,chromaticAberration:0,magnifierX:0,magnifierY:0,lockScreenOffsetX:0,lockScreenOffsetY:0,controlCenterActive:0,controlCenterEnter:1,controlCenterSafeEnter:1,gpSheetExpanded:!0,gpOffsetX:0,gpOffsetY:0,gpZoom:1,gpRotation:0,algOffsetX:0,algOffsetY:0,adaptiveLuminance:.5,customDpr:0,globalSeparableBlur:!0,blurTapCap:17,blurDownsample:1,capsuleShape:!0,liveDpr:null,liveTapCap:null,hideOverlayButtons:!1,locale:"zh",pageTransition:!0,showFps:!1,highlightAa:!0,perfProgress:null,perfStatusText:"",perfDone:!1,perfResultDpr:0,perfGlassAngle:0,perfRoundTrigger:0,perfProgressFrac:0,perfProgressFracAnimated:0,perfDeformMul:0,perfExitProgress:0},en=null;function es(e,t,r=400){return"u">typeof document&&(en||(en=document.createElement("canvas").getContext("2d")),en)?(en.font=`${r} ${t}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,en.measureText(e).width):e.length*t*.55}let el={home_title:{zh:"液态玻璃目录",en:"Backdrop Catalog"},section_glass:{zh:"液态玻璃组件",en:"Liquid glass components"},section_system:{zh:"系统 UI",en:"System UIs"},section_experiments:{zh:"实验性功能",en:"Experiments"},section_system_nav:{zh:"系统",en:"System"},item_buttons:{zh:"按钮",en:"Buttons"},item_toggle:{zh:"开关",en:"Toggle"},item_slider:{zh:"滑块",en:"Slider"},item_bottom_tabs:{zh:"底部标签栏",en:"Bottom tabs"},item_dialog:{zh:"对话框",en:"Dialog"},item_lock_screen:{zh:"锁屏（SDF 纹理）",en:"Lock screen (SDF texture)"},item_control_center:{zh:"控制中心",en:"Control center"},item_magnifier:{zh:"放大镜",en:"Magnifier"},item_glass_playground:{zh:"玻璃游乐场",en:"Glass playground"},item_adaptive_luminance:{zh:"自适应亮度玻璃",en:"Adaptive luminance glass"},item_progressive_blur:{zh:"渐进模糊",en:"Progressive blur"},item_scroll_container:{zh:"滚动容器",en:"Scroll container"},item_lazy_scroll:{zh:"懒加载滚动容器",en:"Lazy scroll container"},item_settings:{zh:"设置",en:"Settings"},item_about:{zh:"关于",en:"About"},item_perf_benchmark:{zh:"性能检测",en:"Performance benchmark"},settings_title:{zh:"设置",en:"Settings"},settings_dpr_label:{zh:"DPR",en:"DPR"},settings_dpr_desc:{zh:"设备 DPR",en:"device DPR"},settings_range:{zh:"范围",en:"range"},settings_blur_title:{zh:"可分离双通道模糊",en:"Separable 2-pass blur"},settings_global:{zh:"全局",en:"Global"},settings_on:{zh:"开",en:"ON"},settings_off:{zh:"关",en:"OFF"},settings_tap_cap_label:{zh:"采样上限",en:"Tap cap"},settings_tap_cap_hint:{zh:"(1=最快, 33=最高质量)",en:"(1=fast, 33=best quality)"},settings_shape_title:{zh:"形状",en:"Shape"},settings_capsule:{zh:"胶囊形",en:"Capsule"},settings_ui_title:{zh:"界面",en:"UI"},settings_hide_overlay:{zh:"隐藏悬浮按钮",en:"Hide overlay buttons"},settings_language_title:{zh:"语言",en:"Language"},settings_language_zh:{zh:"中文",en:"Chinese"},settings_language_en:{zh:"英文",en:"English"},settings_transition_title:{zh:"页面过渡动画",en:"Page transitions"},settings_transition:{zh:"过渡动画",en:"Transitions"},settings_fps_title:{zh:"性能",en:"Performance"},settings_fps:{zh:"显示帧率",en:"Show FPS"},settings_perf_redetect:{zh:"重新检测性能",en:"Re-detect performance"},settings_highlight_title:{zh:"高光",en:"Highlight"},settings_highlight_aa:{zh:"高光抗锯齿",en:"Highlight anti-aliasing"},settings_reset:{zh:"重置",en:"Reset"},settings_cat_rendering:{zh:"渲染",en:"Rendering"},settings_cat_blur:{zh:"模糊",en:"Blur"},settings_cat_interface:{zh:"界面",en:"Interface"},settings_cat_performance:{zh:"性能",en:"Performance"},about_title:{zh:"关于",en:"About"},about_author:{zh:"由 Z.ai Agent 移植",en:"Ported by Z.ai Agent"},about_projects:{zh:"项目",en:"Projects"},about_original:{zh:"原版（Android，Kotlin）：",en:"Original (Android, Kotlin):"},about_port:{zh:"Web 移植版（Next.js + WebGL）：",en:"This web port (Next.js + WebGL):"},about_desc:{zh:"Kyant 的 Android 液态玻璃目录的忠实 WebGL 复刻。在浏览器中浏览液态玻璃组件演示——由 WebGL 着色器渲染，无需 Android 设备。",en:"A faithful WebGL reproduction of Kyant's Android Liquid Glass catalog. Browse liquid-glass component demos in your browser — rendered with WebGL shaders, no Android required."},shame_title:{zh:"⚠️ 耻辱柱",en:"⚠️ Wall of Shame"},shame_project:{zh:"GooseHyperGlass",en:"GooseHyperGlass"},shame_plagiarism:{zh:'对本项目的抄袭山寨：Shader 代码与核心算法照搬照抄，却系统性抹除原作者 Kyant、移植者及 Z.ai Agent 署名，蓄意误导用户把别人成果包装成自己的"原创"。',en:"A plagiarized knockoff of this project: shader code and core algorithms ripped wholesale, yet all credit to original author Kyant, porter, and Z.ai Agent systematically erased — deliberately misleading users into believing it is independent original work."},shame_quality:{zh:"抄都抄不明白：强制降分辨率不可调、blur滤镜滥用、点击行为未处理、对话框崩坏、锯齿刺眼、连G2连续曲率圆角都做不出来。",en:"Couldn't even copy it right: forced resolution downscaling, blur filter abuse, unhandled clicks, broken dialogs, jagged aliasing, failed to implement G2 continuous-curvature corners."},shame_coverup_title:{zh:"遮丑行径：",en:"Cover-up tactics:"},shame_coverup_1:{zh:"① 假改名又改回——短暂改名装样子后悄悄恢复，做贼心虚的拙劣表演",en:"① Faked a rename then reverted — a clumsy performance of guilty conscience"},shame_coverup_2:{zh:"② 删光自己的回应帖——抹除对话痕迹，销毁证据",en:"② Deleted all own response posts — destroying evidence and conversation trail"},shame_coverup_3:{zh:"③ 关闭Issue区——封堵一切公开质疑通道",en:"③ Disabled Issue tracker — sealing off all channels for public scrutiny"},shame_conclusion:{zh:"抄了代码、抹了名字、被抓就删帖毁证据关门——系统性抄袭与欺诈，对开源社区伦理的公然践踏。",en:"Copied code, erased names, then deleted evidence and shut doors when caught — systematic plagiarism and fraud, a flagrant trampling of open-source ethics."},shame_evidence:{zh:"详细证据 → #112 & #114",en:"Detailed evidence → #112 & #114"},pick_image:{zh:"选择图片",en:"Pick an image"},page_buttons:{zh:"按钮",en:"Buttons"},page_toggle:{zh:"开关",en:"Toggle"},page_slider:{zh:"滑块",en:"Slider"},page_bottom_tabs:{zh:"底部标签栏",en:"Bottom Tabs"},page_dialog:{zh:"对话框",en:"Dialog"},page_lock_screen:{zh:"锁屏",en:"Lock screen"},page_control_center:{zh:"控制中心",en:"Control center"},page_magnifier:{zh:"放大镜",en:"Magnifier"},page_glass_playground:{zh:"玻璃游乐场",en:"Glass Playground"},page_adaptive_luminance:{zh:"自适应亮度",en:"Adaptive luminance"},page_progressive_blur:{zh:"渐进模糊",en:"Progressive blur"},page_scroll_container:{zh:"滚动容器",en:"Scroll container"},page_lazy_scroll:{zh:"懒加载滚动容器",en:"Lazy scroll container"},page_settings:{zh:"设置",en:"Settings"},page_about:{zh:"关于",en:"About"},page_perf_benchmark:{zh:"性能检测",en:"Performance Benchmark"},perf_detecting:{zh:"正在检测...",en:"Detecting..."},perf_stop:{zh:"停止",en:"Stop"},perf_round_info:{zh:"第{n}/{max}轮 · DPR {dpr}",en:"Round {n}/{max} · DPR {dpr}"},perf_result_good:{zh:"性能良好！推荐 DPR：{dpr}",en:"Performance OK! Recommended DPR: {dpr}"},perf_result_low:{zh:"性能有限，推荐 DPR：{dpr}",en:"Limited performance, recommended DPR: {dpr}"},perf_retest:{zh:"重新检测",en:"Re-test"},perf_continue:{zh:"继续检测",en:"Continue"},perf_exit:{zh:"退出",en:"Exit"},perf_done:{zh:"检测完成",en:"Benchmark done"}};function eu(e,t){let r=el[e];return r?r[t]??r.en:e}let ec=new Map;function eh(e){let{groupId:t,trackX:r,dragW:a,rendererRef:i,onValueChange:o,onLiveValue:n,getFraction:s,beginDrag:l,drag:u,endDrag:c,setTarget:h,count:d,snap:f,liveUpdate:g=!1,onTapJump:p=!0,didDragThreshold:m=3}=e;ec.has(t)||ec.set(t,{fraction:0,x:0,didDrag:!1});let b=ec.get(t),S=e=>f?f(e):e;return{onTap:e=>{if(!p)return;let n=S(Math.max(0,Math.min(1,(e.x-r)/a))),s=i?.current;s&&h(s,t,n,d),o(n)},onDragStart:e=>{let r=i?.current;r&&(K.add(t),b.fraction=s(r,t),b.x=e.x,b.didDrag=!1,l(r,t,b.fraction,d))},onDrag:e=>{let r=i?.current;if(!r)return;Math.abs(e.x-b.x)>m&&(b.didDrag=!0),u(r,t,b.fraction,e.x,b.x,a,d);let l=s(r,t);n&&n(l),g&&o(l)},onDragEnd:()=>{let e=i?.current;if(!e)return;let r=S(c(e,t,d));f&&null==d&&h(e,t,r,d),o(r),K.delete(t)}}}let ed={getFraction:(e,t)=>e.getToggleFraction(t),beginDrag:(e,t,r)=>e.beginToggleDrag(t,r),drag:(e,t,r,a,i,o)=>e.dragToggle(t,r,a,i,o),endDrag:(e,t)=>e.endSliderDrag(t),setTarget:(e,t,r)=>e.setToggleTarget(t,r)},ef={getFraction:(e,t)=>e.getToggleTarget(t),beginDrag:(e,t,r)=>e.beginToggleDrag(t,r),drag:(e,t,r,a,i,o)=>e.dragToggle(t,r,a,i,o),endDrag:(e,t)=>e.endToggleDrag(t),setTarget:(e,t,r)=>e.setToggleTarget(t,r)};function eg(e,t,r,a,i,o,n,s,l,u=!0,c=!1,h=0,d,f){let g=[],p={},m=a-20,b=t-10,S=r+-9,v=eb(`${e}-track`,{x:t,y:r,w:a,h:6},o,3);v.hitRect={x:t,y:r+-21,w:a,h:48},v.scroll=u,g.push(v);let x=eb(`${e}-fill`,{x:t,y:r,w:Math.max(6,h*a),h:6},[...n,1],3);x.isSliderFill={groupId:i,trackX:t,trackW:a,knobW:40,minW:0},x.scroll=u,g.push(x);let C=eS(`${e}-knob`,{x:b,y:S,w:40,h:24},{cornerRadius:12,refractionHeight:10,refractionAmount:-14,blurRadius:8,saturation:1,surfaceColor:[0,0,0,0],highlight:{mode:1,color:[1,1,1],angle:Math.PI/4,falloff:1,alpha:1,widthDp:.5/1.5,blurRadiusDp:.25/1.5},outerShadow:{radius:4,alpha:.05,offsetX:0,offsetY:4/6*1,color:[0,0,0]},innerShadow:{radius:4,alpha:.3,offsetX:0,offsetY:4},chromaticAberration:!0},u);C.isToggleKnob={groupId:i,dragWidth:m,velocityDivisor:10},C.hitRect={x:b,y:S+-12,w:40,h:48},g.push(C);let T=eh({groupId:i,trackX:t,dragW:m,rendererRef:s,onValueChange:l,onLiveValue:f,...ed,snap:d,liveUpdate:c});return p[`${e}-track`]=T,p[`${e}-knob`]=T,{elements:g,interactions:p}}function ep(e,t,r,a=!0){return{id:e,kind:"button",rect:t,...Z,cornerRadius:t.h/2,tintColor:r.tintColor,surfaceColor:r.surfaceColor,highlight:{...J},outerShadow:{...Q},label:r.label,labelColor:r.labelColor,labelFontSizePx:r.labelFontSizePx,showChevron:!1,isInteractive:!0,scroll:a,independentBackdrop:!0}}function em(e,t,r,a={},i=!0){return{id:e,kind:"text",rect:t,cornerRadius:0,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:"",labelColor:[0,0,0,1],showChevron:!1,isInteractive:!1,pressTintColor:a.pressTintColor,scroll:i,text:{content:r,color:a.color??[0,0,0,1],fontSizePx:a.fontSizePx??15,fontWeight:a.fontWeight??400,align:a.align??"left",wrap:a.wrap??!1,paddingPx:a.paddingPx??16,valign:a.valign,maxLines:a.maxLines,halo:a.halo??"auto",icon:a.icon}}}function eb(e,t,r,a=0,i=!0){return{id:e,kind:"plain-rect",rect:t,cornerRadius:a,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:"",labelColor:[0,0,0,1],showChevron:!1,isInteractive:!1,scroll:i,plainRect:{color:r}}}function eS(e,t,r={},a=!0){return{id:e,kind:"glass-shape",rect:t,cornerRadius:r.cornerRadius??t.h/2,refractionHeight:r.refractionHeight??12,refractionAmount:r.refractionAmount??-24,depthEffect:r.depthEffect??!1,chromaticAberration:r.chromaticAberration??!1,blurRadius:r.blurRadius??2,saturation:r.saturation??1.5,brightness:r.brightness??0,contrast:r.contrast??1,tintColor:[0,0,0,0],surfaceColor:r.surfaceColor??[0,0,0,0],highlight:void 0!==r.highlight?r.highlight:{...J},outerShadow:void 0!==r.outerShadow?r.outerShadow:{...Q},label:"",labelColor:[0,0,0,1],showChevron:!1,isInteractive:!1,scroll:a,innerShadow:r.innerShadow??null,independentBackdrop:!0}}function ev(e,t,r,a,i,o,n,s=!0,l=0){let u=[],c={},h=t.x+t.w-64-l,d=t.y+(t.h-28)/2,f=h+2,g=d+2,p=o.backIconColor,m=em(`${e}-label`,{x:t.x,y:t.y,w:t.w,h:t.h},r,{color:p,fontSizePx:15,fontWeight:400,align:"left",paddingPx:l,halo:o.homeTextHalo,pressTintColor:p});m.isInteractive=!0,u.push(m);let b=o.toggleTrackOff,S=o.toggleAccent,v=eb(`${e}-track`,{x:h,y:d,w:64,h:28},b,14,s);v.isToggleTrack={groupId:e,offColor:b,onColor:[...S,1]},u.push(v);let x=eS(`${e}-knob`,{x:f,y:g,w:40,h:24},{cornerRadius:12,refractionHeight:5,refractionAmount:-10,blurRadius:8,saturation:1,surfaceColor:[0,0,0,0],highlight:{mode:1,color:[1,1,1],angle:Math.PI/4,falloff:1,alpha:1,widthDp:.5/1.5,blurRadiusDp:.25/1.5},outerShadow:{radius:4,alpha:.05,offsetX:0,offsetY:4/6*1,color:[0,0,0]},innerShadow:{radius:4,alpha:.3,offsetX:0,offsetY:4},chromaticAberration:!0},s);x.isToggleKnob={groupId:e,dragWidth:20,trackColorOff:o.toggleTrackOff,trackColorOn:[...o.toggleAccent,1],trackW:64,trackH:28,trackOriginalX:h,trackOriginalY:d,solidBackdropColor:o.toggleCardBg},u.push(x);let C=eh({groupId:e,trackX:0,dragW:20,rendererRef:n,onValueChange:e=>{e>=.5!==a&&i()},...ef,snap:e=>+(e>=.5),onTapJump:!1});return C.onTap=()=>i(),c[`${e}-track`]=C,c[`${e}-knob`]=C,c[`${e}-label`]={onTap:()=>i()},{elements:u,interactions:c}}function ex(e,t,r=!1){return{element:{id:"__back__",kind:"button",rect:{x:16,y:16,w:56,h:56},...Z,cornerRadius:28,tintColor:[0,0,0,0],surfaceColor:t.buttonSurface,highlight:null,outerShadow:{...Q},label:"",labelColor:t.backIconColor,showChevron:!1,isInteractive:!0,scroll:r,icon:{path:"M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",size:32,color:t.backIconColor}},interaction:{onTap:()=>e()}}}function eC(e,t,r,a){let i=r-t;if(i>=a)return r;let o=Math.max(0,(a-i)/2-t);if(o<=0)return r;for(let t of e)"__back__"!==t.id&&"__theme__"!==t.id&&(!1!==t.scroll||"__pickimage__"===t.id)&&(t.rect={...t.rect,y:t.rect.y+o},t.hitRect&&(t.hitRect={...t.hitRect,y:t.hitRect.y+o}),t.isToggleKnob&&null!=t.isToggleKnob.trackOriginalY&&(t.isToggleKnob.trackOriginalY+=o),t.isBottomTabIndicator&&t.isBottomTabIndicator.containerRect&&(t.isBottomTabIndicator.containerRect={...t.isBottomTabIndicator.containerRect,y:t.isBottomTabIndicator.containerRect.y+o}),t.isBottomTabContent&&null!=t.isBottomTabContent.containerCenterY&&(t.isBottomTabContent.containerCenterY+=o),t.isBottomTabIndicator&&null!=t.isBottomTabIndicator.containerCenterY&&(t.isBottomTabIndicator.containerCenterY+=o),t.isBottomTabIndicator&&t.isBottomTabIndicator.tabContentRects&&(t.isBottomTabIndicator.tabContentRects=t.isBottomTabIndicator.tabContentRects.map(e=>({...e,y:e.y+o}))));return r+o}function eT(e,t,r,a="zh"){let i=[],o={},n=40;i.push(em("home-title",{x:16,y:n,w:e-32,h:44},eu("home_title",a),{color:r.homeContentColor,fontSizePx:28,fontWeight:500,align:"left",paddingPx:0,halo:r.homeTextHalo})),n+=52;for(let s=0;s<ei.length;s++){let l=ei[s];s>0&&(n+=16),n+=24;let u=eu(l.titleKey,a);for(let s of(i.push(em(`subtitle-${l.titleKey}`,{x:16,y:n,w:e-32,h:24},u,{color:r.homeSubtitleColor,fontSizePx:15,fontWeight:500,align:"left",paddingPx:0,halo:r.homeTextHalo})),n+=32,l.items)){let l=`item-${s.dest}`,u=em(l,{x:0,y:n,w:e,h:48},eu(s.labelKey,a),{color:r.homeContentColor,fontSizePx:17,fontWeight:400,align:"left",paddingPx:16,halo:r.homeTextHalo,pressTintColor:r.backIconColor});u.isInteractive=!0,i.push(u),o[l]={onTap:()=>t(s.dest)},n+=48}}return{elements:i,interactions:o,contentHeight:n+=40}}let ey={x:0,y:0},eR={v:1},ek=null,ew=null,eA={x:0,y:0},eE={x:0,y:0,ox:0,oy:0},eP=new Set([5,6,9,10]),eM={x:0,y:0,ox:0,oy:0};function eF(e,t,r,a=ee){let i=[],o={},n=ex(t,a);i.push(n.element),o[n.element.id]=n.interaction;let s=e-32,l=80;for(let e=0;e<r;e++)i.push(eS(`sc-card-${e}`,{x:16,y:l,w:s,h:160},{cornerRadius:32,refractionHeight:16,refractionAmount:-32,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,0],highlight:{...J}})),l+=176;return{elements:i,interactions:o,contentHeight:l+16}}function e_(e,t,r){let a=1.35*t,i=e.split(/\s+/),o="",n=0;for(let e of i){let a=o?o+" "+e:e;es(a,t)<=r||!o?o=a:(n++,o=e)}return o&&n++,n*a}function eB(e,t,r,a,i,o,n,s,l=!0,u,c){let h,d,f,g,p,m,b,S,v,x,C,T,y,R,k,w,A,E,P,M,F,_,B,D,z,L,O,I,H,U,W,N,X,G,Y,V,q,ei,eo,en,el,eD,ez,eL,eO,eI,eH,eU,eW,eN,eX,eG,eY,eV,eq,e$=l?ee:et,eK=a.locale||"zh";switch(e){case $.Home:h=eT(t,o,e$,eK);break;case $.Buttons:h=function(e,t,r,a){let i=[],o={},n=ex(r,a);i.push(n.element),o[n.element.id]=n.interaction;let s=0;for(let t of[{id:"btn-transparent",label:"Transparent Liquid Button",tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],labelColor:[0,0,0,1]},{id:"btn-surface",label:"Surface Liquid Button",tintColor:[0,0,0,0],surfaceColor:[1,1,1,.3],labelColor:[0,0,0,1]},{id:"btn-tinted-blue",label:"Tinted Liquid Button",tintColor:[0,136/255,1,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]},{id:"btn-tinted-orange",label:"Tinted Liquid Button",tintColor:[1,141/255,40/255,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]}]){let r=Math.ceil(es(t.label,15)+32),a=(e-r)/2;i.push(ep(t.id,{x:a,y:s,w:r,h:48},t)),s+=64}let l=eC(i,0,s-16,t);return{elements:i,interactions:o,contentHeight:l}}(t,r,n,e$);break;case $.Toggle:h=function(e,t,r,a,i,o,n=ee){let s=[],l={},u=ex(r,n);s.push(u.element),l[u.element.id]=u.interaction;let c=n.toggleAccent,h=n.toggleTrackOff,d=n.toggleCardBg,f={mode:1,color:[1,1,1],angle:Math.PI/4,falloff:1,alpha:1,widthDp:.5/1.5,blurRadiusDp:.25/1.5},g={radius:4,alpha:.05,offsetX:0,offsetY:4/6*1,color:[0,0,0]},p={radius:4,alpha:.3,offsetX:0,offsetY:4,color:[0,0,0]},m=e/2-32,b=m+2,S=eb("toggle1-track",{x:m,y:0,w:64,h:28},h,14);S.isToggleTrack={groupId:"toggle1",offColor:h,onColor:[...c,1]},s.push(S);let v=eS("toggle1-knob",{x:b,y:2,w:40,h:24},{cornerRadius:12,refractionHeight:5,refractionAmount:-10,blurRadius:8,saturation:1,surfaceColor:[0,0,0,0],highlight:f,outerShadow:g,innerShadow:p,chromaticAberration:!0});v.isToggleKnob={groupId:"toggle1",dragWidth:20,trackColorOff:h,trackColorOn:[...c,1],trackW:64,trackH:28,trackOriginalX:m,trackOriginalY:0},s.push(v);let x=(e-176)/2,C=68;s.push(eb("toggle-card",{x:x,y:C,w:176,h:76},d,32));let T=x+24+32,y=C+24,R=T+2,k=y+2,w=eb("toggle2-track",{x:T,y:y,w:64,h:28},h,14);w.isToggleTrack={groupId:"toggle2",offColor:h,onColor:[...c,1]},s.push(w);let A=eS("toggle2-knob",{x:R,y:k,w:40,h:24},{cornerRadius:12,refractionHeight:5,refractionAmount:-10,blurRadius:8,saturation:1,surfaceColor:[0,0,0,0],highlight:f,outerShadow:g,innerShadow:p,chromaticAberration:!0});A.isToggleKnob={groupId:"toggle2",dragWidth:20,trackColorOff:h,trackColorOn:[...c,1],trackW:64,trackH:28,trackOriginalX:T,trackOriginalY:y,solidBackdropColor:d},s.push(A);let E=(e,t)=>eh({groupId:e,trackX:0,dragW:t,rendererRef:o,onValueChange:e=>{let t=e>=.5;i(e=>e.toggleOn===t?e:{toggleOn:t})},...ef,snap:e=>+(e>=.5),onTapJump:!1}),P=E("toggle1",20);P.onTap=()=>i(e=>({toggleOn:!e.toggleOn}));let M=E("toggle2",20);M.onTap=()=>i(e=>({toggleOn:!e.toggleOn})),l["toggle1-track"]=P,l["toggle1-knob"]=P,l["toggle2-track"]=M,l["toggle2-knob"]=M;let F=eC(s,0,C+76+24,t);return{elements:s,interactions:l,contentHeight:F}}(t,r,n,0,i,s,e$);break;case $.Slider:h=function(e,t,r,a,i,o,n=ee){let s=[],l={},u=ex(r,n);s.push(u.element),l[u.element.id]=u.interaction;let c=n.sliderAccent,h=n.sliderTrackOff,d=n.sliderCardBg,f=e-64,g=22,p=-9,m=eb("slider1-track",{x:32,y:0,w:f,h:6},h,3);m.hitRect={x:32,y:-21,w:f,h:48},s.push(m);let b=eb("slider1-fill",{x:32,y:0,w:6,h:6},[...c,1],3);b.isSliderFill={groupId:"slider1",trackX:32,trackW:f,knobW:40,minW:0},s.push(b);let S=eS("slider1-knob",{x:g,y:p,w:40,h:24},{cornerRadius:12,refractionHeight:10,refractionAmount:-14,blurRadius:8,saturation:1,surfaceColor:[0,0,0,0],highlight:{mode:1,color:[1,1,1],angle:Math.PI/4,falloff:1,alpha:1,widthDp:.5/1.5,blurRadiusDp:.25/1.5},outerShadow:{radius:4,alpha:.05,offsetX:0,offsetY:4/6*1,color:[0,0,0]},innerShadow:{radius:4,alpha:.3,offsetX:0,offsetY:4},chromaticAberration:!0});S.isToggleKnob={groupId:"slider1",dragWidth:f-20,velocityDivisor:10};S.hitRect={x:g,y:p+-12,w:40,h:48},s.push(S);let v=e-48,x=64;s.push(eb("slider-card",{x:24,y:x,w:v,h:72},d,32));let C=80,T=v-48-64,y=x+24+9,R=70,k=y+-9,w=eb("slider2-track",{x:80,y:y,w:T,h:6},h,3);w.hitRect={x:C,y:y+-21,w:T,h:48},s.push(w);let A=eb("slider2-fill",{x:C,y:y,w:6,h:6},[...c,1],3);A.isSliderFill={groupId:"slider2",trackX:C,trackW:T,knobW:40,minW:0},s.push(A);let E=eS("slider2-knob",{x:R,y:k,w:40,h:24},{cornerRadius:12,refractionHeight:10,refractionAmount:-14,blurRadius:8,saturation:1,surfaceColor:[0,0,0,0],highlight:{mode:1,color:[1,1,1],angle:Math.PI/4,falloff:1,alpha:1,widthDp:.5/1.5,blurRadiusDp:.25/1.5},outerShadow:{radius:4,alpha:.05,offsetX:0,offsetY:4/6*1,color:[0,0,0]},innerShadow:{radius:4,alpha:.3,offsetX:0,offsetY:4},chromaticAberration:!0});E.isToggleKnob={groupId:"slider2",dragWidth:T-20,velocityDivisor:10},E.hitRect={x:R,y:k+-12,w:40,h:48},s.push(E);let P=f-20,M=T-20,F=(e,t,r)=>eh({groupId:e,trackX:t,dragW:r,rendererRef:o,onValueChange:e=>i({sliderValue:100*e}),...ed,liveUpdate:!1});l["slider1-track"]=F("slider1",32,P),l["slider1-knob"]=l["slider1-track"],l["slider2-track"]=F("slider2",C,M),l["slider2-knob"]=l["slider2-track"];let _=eC(s,0,x+72+24,t);return{elements:s,interactions:l,contentHeight:_}}(t,r,n,0,i,s,e$);break;case $.BottomTabs:h=function(e,t,r,a,i,o=null,n=ee){let s=[],l={},u=ex(r,n);s.push(u.element),l[u.element.id]=u.interaction;let c=e-72,h=n.tabsContentColor,d=n.tabsContainer,f=n.tabsAccent,g=32,p=40,m=c-8,b=28;function S(e,t,r,a,i){let u,S=m/t,v=i+4,x=eS(`${e}-container`,{x:36,y:i,w:c,h:64},{cornerRadius:g,refractionHeight:24,refractionAmount:-24,blurRadius:8,saturation:1.5,surfaceColor:d,highlight:{...J,alpha:.5},depthEffect:!0});x.isBottomTabContainer={groupId:e,tabsCount:t},x.independentBackdrop=!1,s.push(x);let C=(ec.has(e)||ec.set(e,{fraction:0,x:0,didDrag:!1}),u=ec.get(e),{onTap:()=>{},onDragStart:r=>{let a=o?.current;a&&(K.add(e),u.fraction=a.getTabTarget(e),u.x=r.x,u.didDrag=!1,a.beginTabDrag(e,u.fraction,t))},onDrag:r=>{let a=o?.current;a&&(Math.abs(r.x-u.x)>3&&(u.didDrag=!0),a.dragTab(e,u.fraction,r.x,u.x,S,t))},onDragEnd:()=>{let r=o?.current;if(!r)return;let i=r.endTabDrag(e,t);u.didDrag&&a(i),K.delete(e)}});for(let r=0;r<t;r++){let t=`${e}-tab-${r}`,o=em(t,{x:p+S*r,y:v,w:S,h:56},`Tab ${r+1}`,{color:n.tabsContentColor,fontSizePx:12,fontWeight:400,align:"center",paddingPx:0,halo:n.tabsTextHalo,icon:{path:ea,size:24,layoutSize:28,color:h,viewport:960}});o.isBottomTabContent={groupId:e,containerCenterX:36+c/2,containerCenterY:i+32,containerWidth:c},s.push(o),l[t]={onTap:()=>a(r),onDragStart:C.onDragStart,onDrag:C.onDrag,onDragEnd:C.onDragEnd}}l[`${e}-container`]=C;let T=eS(`${e}-indicator`,{x:40,y:v,w:S,h:56},{cornerRadius:b,refractionHeight:10,refractionAmount:-14,blurRadius:0,saturation:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:{...J,alpha:.5},outerShadow:{...Q},innerShadow:{radius:8,alpha:.3,offsetX:0,offsetY:8},chromaticAberration:!0});T.independentBackdrop=!1,T.isBottomTabIndicator={groupId:e,dragWidth:S,dimColor:n.backIconColor,accentColor:[...f],containerRect:{x:p-4,y:v,w:m+8,h:56},containerCenterX:36+c/2,containerCenterY:i+32,containerWidth:c,tabContentIds:Array.from({length:t},(t,r)=>`${e}-tab-${r}`),tabContentRects:Array.from({length:t},(e,t)=>({x:p+S*t,y:v,w:S,h:56}))},s.push(T)}S("tabs3",3,a.selectedTab,e=>i({selectedTab:e}),0),S("tabs4",4,a.selectedTab2,e=>i({selectedTab2:e}),96);let v=eC(s,0,160,t);return{elements:s,interactions:l,contentHeight:v}}(t,r,n,a,i,s,e$);break;case $.Dialog:h=function(e,t,r,a,i=ee){let o=[],n={},s=ex(r,i,!0);o.push(s.element),n[s.element.id]=s.interaction;let l=eb("dialog-scrim",{x:0,y:0,w:e,h:t},i.dialogDim,0);l.scroll=!1,o.push(l);let u=e-80,c=(t-276)/2,h=eS("dialog-card",{x:40,y:c,w:u,h:276},{cornerRadius:48,refractionHeight:24,refractionAmount:-48,blurRadius:i.dialogBlurRadius,saturation:1.5,brightness:i.dialogBrightness,surfaceColor:i.dialogContainer,highlight:{...J,mode:2,color:[1,1,1],alpha:.38,widthDp:.5},depthEffect:!0});h.useSeparableBlur=!0,h.independentBackdrop=!1,a.capsuleShape&&(h.useContinuousSdf=!0),o.push(h),o.push(em("dialog-title",{x:68,y:c+24,w:u-56,h:36},"Dialog Title",{color:i.dialogContentColor,fontSizePx:24,fontWeight:500,align:"left",paddingPx:0,halo:"none"}));let d=i.dialogBrightness>.1,f=[i.dialogContentColor[0],i.dialogContentColor[1],i.dialogContentColor[2],d?.68:.78];o.push(em("dialog-body",{x:64,y:c+68+12,w:u-48,h:100},er,{color:f,fontSizePx:15,fontWeight:400,align:"left",wrap:!0,valign:"top",maxLines:5,paddingPx:0,halo:"none"}));let g=(u-48-16)/2,p=c+276-24-48,m=64,b=64+g+16,S=ep("dialog-cancel",{x:64,y:p,w:g,h:48},{label:"",tintColor:[0,0,0,0],surfaceColor:[i.dialogContainer[0],i.dialogContainer[1],i.dialogContainer[2],.2],labelColor:i.dialogContentColor,saturation:1,brightness:0,contrast:1},!1);S.refractionHeight=0,S.refractionAmount=0,S.blurRadius=0,S.highlight=null,S.outerShadow=null,o.push(S),n["dialog-cancel"]={onTap:()=>{}},o.push(em("dialog-cancel-label",{x:m,y:p,w:g,h:48},"Cancel",{color:i.dialogContentColor,fontSizePx:16,fontWeight:400,align:"center",paddingPx:0,halo:"none"}));let v=ep("dialog-okay",{x:b,y:p,w:g,h:48},{label:"",tintColor:[0,0,0,0],surfaceColor:i.dialogAccent,labelColor:[1,1,1,1],saturation:1,brightness:0,contrast:1},!1);for(let e of(v.refractionHeight=0,v.refractionAmount=0,v.blurRadius=0,v.highlight=null,v.outerShadow=null,o.push(v),n["dialog-okay"]={onTap:()=>{}},o.push(em("dialog-okay-label",{x:b,y:p,w:g,h:48},"Okay",{color:[1,1,1,1],fontSizePx:16,fontWeight:400,align:"center",paddingPx:0})),o))e.scroll=!1;return eC(o,0,t,t),{elements:o,interactions:n,contentHeight:t}}(t,r,n,a,e$);break;case $.LockScreen:h=function(e,t,r,a,i,o=ee){let n=[],s={},l=ex(r,o);n.push(l.element),s[l.element.id]=l.interaction;let u=eb("ls-scrim",{x:0,y:0,w:e,h:Math.max(t,800)},[0,0,0,.3],0);u.scroll=!1,n.push(u);let c=Math.min(400,e-96),h=515/1599*c,d=eS("ls-glass",{x:(e-c)/2+a.lockScreenOffsetX,y:0+a.lockScreenOffsetY,w:c,h:h},{cornerRadius:0,refractionHeight:0,refractionAmount:0,blurRadius:2,saturation:1.5,brightness:-.1,contrast:.75,surfaceColor:[1,1,1,.25],highlight:null,outerShadow:null});d.isSdfTexture={refractionHeight:48,lightAngle:45},d.independentBackdrop=!1,n.push(d),s["ls-glass"]={onDragStart:()=>{ey.x=a.lockScreenOffsetX,ey.y=a.lockScreenOffsetY},onDrag:(e,t)=>{i({lockScreenOffsetX:ey.x+t.x,lockScreenOffsetY:ey.y+t.y})},onDragEnd:()=>{}},n.push(em("ls-hint",{x:24,y:0+h+32,w:e-48,h:40},"Drag the clock — SDF texture glass",{color:[1,1,1,.8],fontSizePx:14,fontWeight:400,align:"center",paddingPx:0,halo:"dark"}));let f=eC(n,0,h+32+40,t);return{elements:n,interactions:s,contentHeight:f}}(t,r,n,a,i,e$);break;case $.ControlCenter:h=function(e,t,r,a,i,o=ee){let n=[],s={},l=o.controlCenterAccent,u=Math.max(16,(e-320)/2),c=[1,1,1,1],h=eb("cc-dim",{x:0,y:0,w:e,h:Math.max(t,800)},[0,0,0,.4*Math.max(0,Math.min(1,a.controlCenterSafeEnter))],0);h.scroll=!1,h.sceneBlurRadius=4*Math.max(0,Math.min(1,a.controlCenterSafeEnter)),n.push(h);let d=eb("cc-drag",{x:0,y:0,w:e,h:Math.max(t,800)},[0,0,0,0],0);d.scroll=!1,n.push(d);let f=ex(r,o);n.push(f.element),s[f.element.id]=f.interaction;let g=Math.max(0,Math.min(1,a.controlCenterSafeEnter)),p=24*g,m=-48*g,b=0;n.push(eS("cc-a",{x:u,y:b,w:152,h:152},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0}));n.push(eb("cc-a-icon1",{x:u+16,y:b+16,w:56,h:56},[1,1,1,.2],28)),n.push(em("cc-a-icon1-label",{x:u+16,y:b+16,w:56,h:56},"",{icon:{path:ea,size:19,color:c,viewport:960}})),n.push(eb("cc-a-icon2",{x:u+152-16-56,y:b+16,w:56,h:56},l,28)),n.push(em("cc-a-icon2-label",{x:u+152-16-56,y:b+16,w:56,h:56},"",{icon:{path:ea,size:19,color:c,viewport:960}})),n.push(eb("cc-a-icon3",{x:u+16,y:b+152-16-56,w:56,h:56},l,28)),n.push(em("cc-a-icon3-label",{x:u+16,y:b+152-16-56,w:56,h:56},"",{icon:{path:ea,size:19,color:c,viewport:960}})),n.push(eS("cc-b",{x:u+152+16,y:b,w:152,h:152},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),b+=168,n.push(eS("cc-c",{x:u,y:b,w:68,h:68},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),n.push(em("cc-c-icon",{x:u,y:b,w:68,h:68},"",{icon:{path:ea,size:24,color:c,viewport:960}})),n.push(eS("cc-d",{x:u+68+16,y:b,w:68,h:68},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),n.push(em("cc-d-icon",{x:u+68+16,y:b,w:68,h:68},"",{icon:{path:ea,size:24,color:c,viewport:960}})),n.push(eS("cc-e",{x:u,y:b+68+16,w:152,h:68},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0}));let S=u+152+16;n.push(eS("cc-f",{x:S,y:b,w:68,h:152},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),n.push(eS("cc-g",{x:S+68+16,y:b,w:68,h:152},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),b+=168,n.push(eS("cc-h",{x:u,y:b,w:152,h:152},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),n.push(eS("cc-i",{x:S,y:b,w:68,h:68},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),n.push(em("cc-i-icon",{x:S,y:b,w:68,h:68},"",{icon:{path:ea,size:24,color:c,viewport:960}})),n.push(eS("cc-j",{x:S+68+16,y:b,w:68,h:68},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),n.push(em("cc-j-icon",{x:S+68+16,y:b,w:68,h:68},"",{icon:{path:ea,size:24,color:c,viewport:960}})),n.push(eS("cc-k",{x:S,y:b+68+16,w:68,h:68},{cornerRadius:34,refractionHeight:p,refractionAmount:m,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,.05],highlight:{...J,falloff:2},outerShadow:null,depthEffect:!0})),n.push(em("cc-k-icon",{x:S,y:b+68+16,w:68,h:68},"",{icon:{path:ea,size:24,color:c,viewport:960}})),b+=168;let v=Math.max(300,.6*t),x=["cc-a","cc-b","cc-c","cc-d","cc-e","cc-f","cc-g","cc-h","cc-i","cc-j","cc-k"],C={"cc-a":0,"cc-b":0,"cc-c":1,"cc-d":1,"cc-e":1,"cc-f":1,"cc-g":1,"cc-h":2,"cc-i":2,"cc-j":2,"cc-k":2},T=()=>{null!=j.handle&&(cancelAnimationFrame(j.handle),j.handle=null),null!=ek&&(cancelAnimationFrame(ek),ek=null,ew=null),eR.v=a.controlCenterEnter},y=(e,t)=>{ew=eR.v+t.y/v,null==ek&&(ek=requestAnimationFrame(()=>{if(ek=null,null!=ew){let e=ew;ew=null,i({controlCenterEnter:e,controlCenterSafeEnter:Math.max(0,Math.min(1,e))})}}))},R=(e,t)=>{null!=ek&&(cancelAnimationFrame(ek),ek=null);let r=a.controlCenterEnter;null!=ew&&(r=ew,i({controlCenterEnter:ew,controlCenterSafeEnter:Math.max(0,Math.min(1,ew))}),ew=null);let o=t.y;!function(e,t,r,a){null!=j.handle&&cancelAnimationFrame(j.handle);let i=Math.sqrt(300),o=t>.5?.5:1,n=t>.5?.5/r:.01,s=-1,l=-1,u=a,c=0,h=-1;function d(e,t,r,a,o){let n=e-r;if(a>=1){let e=t+i*n,a=Math.exp(-i*o);return{p:r+(n+e*o)*a,v:(t-i*e*o)*a}}let s=i*Math.sqrt(1-a*a),l=(t+a*i*n)/s,u=Math.exp(-a*i*o),c=Math.cos(s*o),h=Math.sin(s*o),d=u*((l*s-a*i*n)*c-(n*s+a*i*l)*h);return{p:r+u*(n*c+l*h),v:d}}let f=r=>{e(e=>{let a;s<0&&(s=e.controlCenterEnter),l<0&&(l=e.controlCenterSafeEnter),a=h<0?1/60:Math.min(.05,(r-h)/1e3),h=r;let i=d(s,u,t,o,a);s=i.p,u=i.v;let g=d(l,c,t,1,a);l=g.p,c=g.v;let p=Math.abs(t-s)<n&&Math.abs(u)<10*n,m=.01>Math.abs(t-l)&&.1>Math.abs(c);return p&&m?(j.handle=null,j.lastVelocity=0,{controlCenterEnter:t,controlCenterSafeEnter:t}):(j.handle=requestAnimationFrame(f),{controlCenterEnter:s,controlCenterSafeEnter:l})})};j.handle=requestAnimationFrame(f)}(i,o<-1?0:o>1?1:r<.5?0:1,v,o/v)};for(let e of x){let t=n.find(t=>t.id===e);t&&(t.isInteractive=!0,t.enterProgress=a.controlCenterEnter,t.enterSafeProgress=a.controlCenterSafeEnter,t.enterStretchFactor=C[e],t.blurRadius=0,t.useGravityAngle=!0,a.capsuleShape&&(t.useContinuousSdf=!0)),s[e]={onDragStart:T,onDrag:y,onDragEnd:R}}let k=a.controlCenterEnter,w=a.controlCenterSafeEnter;for(let e of n)if(e.id.startsWith("cc-")&&"cc-dim"!==e.id&&"cc-drag"!==e.id&&!x.includes(e.id)){e.enterProgress=k,e.enterSafeProgress=w;let t=e.id.split("-").slice(0,2).join("-");e.enterStretchFactor=C[t]??0}s["cc-drag"]={onDragStart:T,onDrag:y,onDragEnd:R};let A=eC(n,0,b,t);return{elements:n,interactions:s,contentHeight:A}}(t,r,n,a,i,e$);break;case $.Magnifier:h=function(e,t,r,a,i,o=ee){let n=[],s={},l=ex(r,o);n.push(l.element),s[l.element.id]=l.interaction;let u=e-48,c=u-48,h=function(e,t,r){let a=e.split(/\s+/),i="",o=0;for(let e of a){let t=i?i+" "+e:e;es(t,16)<=r||!i?i=t:(o++,i=e)}return i&&o++,21.6*o}(er,0,c),d=h+48;n.push(eb("mag-card",{x:24,y:0,w:u,h:d},o.magnifierCardBg,32)),n.push(em("mag-text",{x:48,y:24,w:c,h:h},er,{color:o.magnifierContentColor,fontSizePx:16,fontWeight:400,align:"left",wrap:!0,paddingPx:0,halo:"none"}));let f=0+d/2-12,g=e/2-2+a.magnifierX,p=f+a.magnifierY,m=eb("mag-cursor",{x:g,y:p,w:4,h:24},o.magnifierAccent,2);m.hitRect={x:g-22,y:p-12,w:48,h:48},n.push(m);let b=eS("mag-glass",{x:g+2-64,y:p+12-80-48,w:128,h:96},{cornerRadius:48,refractionHeight:8,refractionAmount:-24,blurRadius:0,saturation:1,surfaceColor:[0,0,0,0],highlight:{...J},outerShadow:{...Q},innerShadow:{radius:16,alpha:.15,offsetX:0,offsetY:16},depthEffect:!0,chromaticAberration:!0});b.isMagnifier={zoom:1.5,sampleOffsetY:80},b.independentBackdrop=!1,n.push(b);let S={onDragStart:()=>{eA.x=a.magnifierX,eA.y=a.magnifierY},onDrag:(e,t)=>{i({magnifierX:eA.x+t.x,magnifierY:eA.y+t.y})},onDragEnd:()=>{}};s["mag-glass"]=S,s["mag-cursor"]=S;let v=eC(n,0,d,t);return{elements:n,interactions:s,contentHeight:v}}(t,r,n,a,i,e$);break;case $.GlassPlayground:h=function(e,t,r,a,i,o=null,n=ee){let s=[],l={},u=ex(r,n);s.push(u.element),l[u.element.id]=u.interaction;let c=n.backIconColor,h=256*a.gpZoom,d=(e-h)/2+a.gpOffsetX,f=0+a.gpOffsetY,g=h/2*a.cornerRadiusFrac,p=eS("gp-square",{x:d,y:f,w:h,h:h},{cornerRadius:g,refractionHeight:a.refractionHeightFrac*h*.5,refractionAmount:-a.refractionAmountFrac*h,blurRadius:+a.blurRadiusDp,saturation:1.5,surfaceColor:[0,0,0,0],highlight:{...J,mode:2,alpha:.38},depthEffect:!0,chromaticAberration:a.chromaticAberration>0});p.elementRotation=a.gpRotation,p.isInteractive=!0,p.scroll=!1,p.useSeparableBlur=!0,s.push(p),l["gp-square"]={onDragStart:e=>{eE.x=e.x,eE.y=e.y,eE.ox=a.gpOffsetX,eE.oy=a.gpOffsetY},onDrag:e=>{i({gpOffsetX:eE.ox+(e.x-eE.x),gpOffsetY:eE.oy+(e.y-eE.y)})},onDragEnd:()=>{},onTransform:(e,t,r)=>{i(a=>{let i=a.gpZoom*t,o=a.gpRotation+r;return{gpOffsetX:a.gpOffsetX+e.x,gpOffsetY:a.gpOffsetY+e.y,gpZoom:i,gpRotation:o}})}};let m=[1,141/255,40/255,1];if(a.gpSheetExpanded){let r=e-32,u=40,h=r-48,d=[{key:"cornerRadiusFrac",label:"Corner radius",range:[0,1]},{key:"blurRadiusDp",label:"Blur radius",range:[0,32]},{key:"refractionHeightFrac",label:"Refraction height",range:[0,1]},{key:"refractionAmountFrac",label:"Refraction amount",range:[0,1]},{key:"chromaticAberration",label:"Chromatic aberration",range:[0,1]}],f=24+68*d.length-16+24,g=t-88-f;s.push(eS("gp-sheet",{x:16,y:g,w:r,h:f},{cornerRadius:32,refractionHeight:16,refractionAmount:-32,blurRadius:4,saturation:1.5,surfaceColor:n.tabsContainer,highlight:{...J,mode:2,alpha:.38}}));let p=g+24,m=0;for(let e of d){let t=a[e.key],r=e.range,d=e.key;s.push(em(`gp-label-${d}`,{x:u,y:p,w:h,h:16},e.label,{color:c,fontSizePx:13,fontWeight:400,align:"left",paddingPx:0,halo:n.homeTextHalo}));let f=p+16+12+9,g=`gp-slider-${m++}`,b=(t-r[0])/(r[1]-r[0]),S=eg(`gp-${d}`,u,f,h,g,n.sliderTrackOff,n.sliderAccent,o,e=>{i({[d]:r[0]+(r[1]-r[0])*e})},!1,!0,b);s.push(...S.elements),Object.assign(l,S.interactions),p+=68}}let b={id:"gp-toggle",kind:"button",rect:{x:20,y:t-20-56,w:56,h:56},...Z,cornerRadius:28,tintColor:m,surfaceColor:[0,0,0,0],highlight:{...J},outerShadow:{...Q},label:"",labelColor:[1,1,1,1],showChevron:!1,isInteractive:!0,scroll:!1,icon:{path:a.gpSheetExpanded?"M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z":"M16.59 15.41L12 10.83l-4.59 4.58L6 14l6-6 6 6-1.41 1.41z",size:32,color:[1,1,1,1]}};s.push(b),l["gp-toggle"]={onTap:()=>i(e=>({gpSheetExpanded:!e.gpSheetExpanded}))};let S={id:"gp-reset",kind:"button",rect:{x:e-20-56,y:t-20-56,w:56,h:56},...Z,cornerRadius:28,tintColor:m,surfaceColor:[0,0,0,0],highlight:{...J},outerShadow:{...Q},label:"",labelColor:[1,1,1,1],showChevron:!1,isInteractive:!0,scroll:!1,icon:{path:"M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",size:32,color:[1,1,1,1]}};for(let e of(s.push(S),l["gp-reset"]={onTap:()=>i({cornerRadiusFrac:.5,blurRadiusDp:0,refractionHeightFrac:.2,refractionAmountFrac:.2,chromaticAberration:0,gpOffsetX:0,gpOffsetY:0,gpZoom:1,gpRotation:0})},s))e.scroll=!1;return{elements:s,interactions:l,contentHeight:t}}(t,r,n,a,i,s,e$);break;case $.AdaptiveLuminanceGlass:h=function(e,t,r,a,i,o=ee){let n=[],s={},l=ex(r,o);n.push(l.element),s[l.element.id]=l.interaction;let u=a.adaptiveLuminance,c=2*u-1,h=Math.sign(c)*c*c,d=(e-160)/2+a.algOffsetX,f=0+a.algOffsetY,g=eS("alg-square",{x:d,y:f,w:160,h:160},{cornerRadius:24,refractionHeight:24,refractionAmount:-80,blurRadius:+(h>0?8+8*h:8+-(-6*h)),saturation:1.5,brightness:h>0?.1+.4*h:.1+-(-.30000000000000004*h),contrast:h>0?1+-1*h:1,surfaceColor:[0,0,0,0],highlight:{...J,mode:2,alpha:.38},depthEffect:!0});g.isInteractive=!0,n.push(g),s["alg-square"]={onDragStart:e=>{eM.x=e.x,eM.y=e.y,eM.ox=a.algOffsetX,eM.oy=a.algOffsetY},onDrag:e=>{i({algOffsetX:eM.ox+(e.x-eM.x),algOffsetY:eM.oy+(e.y-eM.y)})},onDragEnd:()=>{}};let p=`luminance:
${Math.round(100*u)/100}`;n.push(em("alg-label",{x:d,y:f,w:160,h:160},p,{color:u>.5?[0,0,0,1]:[1,1,1,1],fontSizePx:16,fontWeight:400,align:"center",paddingPx:0,halo:u>.5?"dark":"light"}));let m=eC(n,0,160,t);return{elements:n,interactions:s,contentHeight:m}}(t,r,n,a,i,e$);break;case $.ProgressiveBlur:h=function(e,t,r,a=ee){let i=[],o={},n=ex(r,a);i.push(n.element),o[n.element.id]=n.interaction;i.push({id:"pb-band",kind:"progressive-blur",rect:{x:0,y:0,w:e,h:128},cornerRadius:0,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,label:"",labelColor:a.progressiveContentColor,showChevron:!1,isInteractive:!1,scroll:!0,progressiveBlur:{blurRadius:4,tintColor:a.progressiveTint,tintIntensity:.8}}),i.push(em("pb-label",{x:0,y:0,w:e,h:128},"alpha-masked progressive blur",{color:a.progressiveContentColor,fontSizePx:16,fontWeight:400,align:"center",paddingPx:0,halo:a.progressiveTextHalo}));let s=eC(i,0,128,t);return{elements:i,interactions:o,contentHeight:s}}(t,r,n,e$);break;case $.ScrollContainer:h=eF(t,n,20,e$);break;case $.LazyScrollContainer:h=eF(t,n,100,e$);break;case $.Settings:d=[],f={},g=a.locale||"zh",p=ex(n,e$),d.push(p.element),f[p.element.id]=p.interaction,m=e$.backIconColor,b=e$.toggleCardBg,S=[m[0],m[1],m[2],.5],v=e$.homeSubtitleColor,x=t-64,d.push(em("settings-title",{x:32,y:72,w:t-64,h:40},eu("settings_title",g),{color:m,fontSizePx:24,fontWeight:600,align:"left",paddingPx:0,halo:e$.homeTextHalo})),C=128,y=Math.max(1e-4,(T=window.devicePixelRatio||1)-.5),R=a.customDpr>0?Math.max(.5,Math.min(T,a.customDpr)):T,k=Math.max(1,Math.round(y/.25)),w=e=>Math.max(0,Math.min(1,Math.round(e*k)/k)),A=(a.blurTapCap-1)/32,E=Math.round(16),P=e=>Math.max(0,Math.min(1,Math.round(e*E)/E)),M=e=>1+Math.round(32*e),F=C,_=48,B=t-64-32,D=eb("settings-card-rendering-bg",{x:32,y:F,w:t-64,h:100},b,24),d.push(D),C+=16,d.push(em("settings-card-rendering-title",{x:_,y:C,w:B,h:20},eu("settings_cat_rendering",g),{color:m,fontSizePx:14,fontWeight:600,align:"left",paddingPx:0,halo:e$.homeTextHalo})),z=eg("settings-dpr",_+8,(C+=28)+9,B-16,"settings-dpr",e$.sliderTrackOff,e$.sliderAccent,s,e=>{i({customDpr:.5+e*y,liveDpr:null})},!0,!1,(R-.5)/y,w,e=>{i({liveDpr:.5+w(e)*y})}),d.push(...z.elements),Object.assign(f,z.interactions),C+=36,L=null!=a.liveDpr?a.liveDpr:R,O=`${eu("settings_dpr_label",g)}: ${L.toFixed(2)}  (${eu("settings_dpr_desc",g)} ${T}, ${eu("settings_range",g)} 0.5–${T.toFixed(2)})`,(H=em("settings-dpr-label",{x:32,y:C,w:x,h:I=28},O,{color:S,fontSizePx:13,fontWeight:400,align:"left",paddingPx:16,halo:e$.homeTextHalo,pressTintColor:m})).isInteractive=!0,d.push(H),U=ev("settings-highlight-aa",{x:32,y:C+=I,w:x,h:60},eu("settings_highlight_aa",g),a.highlightAa,()=>i(e=>({highlightAa:!e.highlightAa})),e$,s,!0,16),d.push(...U.elements),Object.assign(f,U.interactions),W=ev("settings-shape-capsule",{x:32,y:C+=60,w:x,h:64},eu("settings_capsule",g),a.capsuleShape,()=>i(e=>({capsuleShape:!e.capsuleShape})),e$,s,!0,16),d.push(...W.elements),Object.assign(f,W.interactions),C+=64,D.rect.h=C-F,C+=16,N=C,X=48,G=t-64-32,Y=eb("settings-card-blur-bg",{x:32,y:N,w:t-64,h:100},b,24),d.push(Y),C+=16,d.push(em("settings-card-blur-title",{x:X,y:C,w:G,h:20},eu("settings_cat_blur",g),{color:m,fontSizePx:14,fontWeight:600,align:"left",paddingPx:0,halo:e$.homeTextHalo})),V=ev("settings-blur-global",{x:32,y:C+=28,w:x,h:60},eu("settings_global",g),a.globalSeparableBlur,()=>i(e=>({globalSeparableBlur:!e.globalSeparableBlur})),e$,s,!0,16),d.push(...V.elements),Object.assign(f,V.interactions),q=eg("settings-blur-taps",X+8,(C+=60)+9,G-16,"settings-blur-taps",e$.sliderTrackOff,e$.sliderAccent,s,e=>{i({blurTapCap:M(e),liveTapCap:null})},!0,!1,A,P,e=>{i({liveTapCap:M(P(e))})}),d.push(...q.elements),Object.assign(f,q.interactions),C+=28,ei=null!=a.liveTapCap?a.liveTapCap:a.blurTapCap,eo=`${eu("settings_tap_cap_label",g)}: ${ei}  ${eu("settings_tap_cap_hint",g)}`,(el=em("settings-blur-taps-label",{x:32,y:C,w:x,h:en=32},eo,{color:S,fontSizePx:13,fontWeight:400,align:"left",paddingPx:16,halo:e$.homeTextHalo,pressTintColor:m})).isInteractive=!0,d.push(el),C+=en,Y.rect.h=C-N,C+=16,eD=C,ez=t-64-32,eL=eb("settings-card-interface-bg",{x:32,y:eD,w:t-64,h:100},b,24),d.push(eL),C+=16,d.push(em("settings-card-interface-title",{x:48,y:C,w:ez,h:20},eu("settings_cat_interface",g),{color:m,fontSizePx:14,fontWeight:600,align:"left",paddingPx:0,halo:e$.homeTextHalo})),eO=ev("settings-ui-hide-overlays",{x:32,y:C+=28,w:x,h:60},eu("settings_hide_overlay",g),a.hideOverlayButtons,()=>i(e=>({hideOverlayButtons:!e.hideOverlayButtons})),e$,s,!0,16),d.push(...eO.elements),Object.assign(f,eO.interactions),eI=ev("settings-transition-toggle",{x:32,y:C+=60,w:x,h:60},eu("settings_transition",g),a.pageTransition,()=>i(e=>({pageTransition:!e.pageTransition})),e$,s,!0,16),d.push(...eI.elements),Object.assign(f,eI.interactions),C+=60,eH="zh"===g?eu("settings_language_zh",g):eu("settings_language_en",g),(eU=em("settings-language-toggle",{x:32,y:C,w:x,h:52},eu("settings_language_title",g)+": "+eH,{color:v,fontSizePx:15,fontWeight:500,align:"left",paddingPx:16,halo:e$.homeTextHalo,pressTintColor:m})).isInteractive=!0,d.push(eU),f["settings-language-toggle"]={onTap:()=>i(e=>({locale:"zh"===e.locale?"en":"zh"}))},C+=52,eL.rect.h=C-eD,C+=16,eW=C,eN=t-64-32,eX=eb("settings-card-performance-bg",{x:32,y:eW,w:t-64,h:100},b,24),d.push(eX),C+=16,d.push(em("settings-card-performance-title",{x:48,y:C,w:eN,h:20},eu("settings_cat_performance",g),{color:m,fontSizePx:14,fontWeight:600,align:"left",paddingPx:0,halo:e$.homeTextHalo})),eG=ev("settings-fps-toggle",{x:32,y:C+=28,w:x,h:60},eu("settings_fps",g),a.showFps,()=>i(e=>({showFps:!e.showFps})),e$,s,!0,16),d.push(...eG.elements),Object.assign(f,eG.interactions),C+=60,(eV=em("settings-perf-redetect",{x:32,y:C,w:x,h:52},(eY="running"===a.perfProgress)?eu("perf_detecting",g):eu("settings_perf_redetect",g),{color:v,fontSizePx:15,fontWeight:500,align:"left",paddingPx:16,halo:e$.homeTextHalo,pressTintColor:m})).isInteractive=!0,d.push(eV),f["settings-perf-redetect"]={onTap:()=>{if(!eY){try{window.localStorage.removeItem("liquid-glass-perf-dpr")}catch{}i({customDpr:0,perfProgress:"running",perfDone:!1,perfResultDpr:0,perfStatusText:"",perfGlassAngle:0,perfProgressFrac:0,perfProgressFracAnimated:0,perfDeformMul:1,perfExitProgress:0,perfRoundTrigger:1})}}},C+=52,eX.rect.h=C-eW,C+=16,(eq=em("settings-reset",{x:32,y:C,w:x,h:36},eu("settings_reset",g),{color:[1,59/255,48/255,1],fontSizePx:15,fontWeight:500,align:"left",paddingPx:16,halo:e$.homeTextHalo,pressTintColor:m})).isInteractive=!0,d.push(eq),f["settings-reset"]={onTap:()=>{i({customDpr:0,globalSeparableBlur:!0,blurTapCap:17,blurDownsample:1,capsuleShape:!0,hideOverlayButtons:!1,locale:"zh",pageTransition:!0,liveDpr:null,liveTapCap:null,showFps:!1,highlightAa:!0,perfProgress:null,perfDone:!1,perfResultDpr:0,perfStatusText:""});try{window.localStorage.removeItem("liquid-glass-perf-dpr")}catch{}let e=window.devicePixelRatio||1,t=(e-.5)/Math.max(1e-4,e-.5);s?.current?.setToggleTarget("settings-dpr",t),s?.current?.setToggleTarget("settings-blur-taps",.5)}},h={elements:d,interactions:f,contentHeight:C+36+24};break;case $.About:h=function(e,t,r,a,i="zh"){let o=[],n={},s=ex(r,a);o.push(s.element),n[s.element.id]=s.interaction;let l=a.backIconColor,u=[0,136/255,1,1],c=72,h=em("about-title",{x:32,y:72,w:e-64,h:40},eu("about_title",i),{color:l,fontSizePx:24,fontWeight:600,align:"left",paddingPx:0,halo:a.homeTextHalo});h.scroll=!0,o.push(h);let d=em("about-author",{x:32,y:c+=56,w:e-64,h:20},eu("about_author",i),{color:l,fontSizePx:16,fontWeight:500,align:"left",paddingPx:0,halo:a.homeTextHalo});d.scroll=!0,o.push(d);let f=em("about-projects-title",{x:32,y:c+=44,w:e-64,h:20},eu("about_projects",i),{color:l,fontSizePx:16,fontWeight:600,align:"left",paddingPx:0,halo:a.homeTextHalo});f.scroll=!0,o.push(f);let g=em("about-original-label",{x:32,y:c+=32,w:e-64,h:16},eu("about_original",i),{color:l,fontSizePx:13,fontWeight:400,align:"left",paddingPx:0,halo:a.homeTextHalo});g.scroll=!0,o.push(g);let p=em("about-original-url",{x:32,y:c+=20,w:e-64,h:16},"github.com/Kyant0/AndroidLiquidGlass",{color:u,fontSizePx:13,fontWeight:400,align:"left",paddingPx:0,halo:a.homeTextHalo});p.isInteractive=!0,p.scroll=!0,o.push(p),n["about-original-url"]={onTap:()=>{window.open("https://github.com/Kyant0/AndroidLiquidGlass","_blank")}};let m=em("about-port-label",{x:32,y:c+=32,w:e-64,h:16},eu("about_port",i),{color:l,fontSizePx:13,fontWeight:400,align:"left",paddingPx:0,halo:a.homeTextHalo});m.scroll=!0,o.push(m);let b=em("about-port-url",{x:32,y:c+=20,w:e-64,h:16},"github.com/martin65536/liquid-glass-webgl",{color:u,fontSizePx:13,fontWeight:400,align:"left",paddingPx:0,halo:a.homeTextHalo});b.isInteractive=!0,b.scroll=!0,o.push(b),n["about-port-url"]={onTap:()=>{window.open("https://github.com/martin65536/liquid-glass-webgl","_blank")}},c+=40;let S=eu("about_desc",i),v=e-64,x=e_(S,14,v),C=em("about-desc",{x:32,y:c,w:v,h:x},S,{color:l,fontSizePx:14,fontWeight:400,align:"left",wrap:!0,paddingPx:0,halo:a.homeTextHalo});C.scroll=!0,o.push(C);let T=[.8,.2,.2,1],y=[1,.6,.6,1],R=em("about-shame-title",{x:32,y:c+=x+32,w:e-64,h:24},eu("shame_title",i),{color:T,fontSizePx:18,fontWeight:700,align:"left",paddingPx:0,halo:a.homeTextHalo});R.scroll=!0,o.push(R);let k=em("about-shame-project",{x:32,y:c+=32,w:e-64,h:16},eu("shame_project",i),{color:u,fontSizePx:14,fontWeight:600,align:"left",paddingPx:0,halo:a.homeTextHalo});k.isInteractive=!0,k.scroll=!0,o.push(k),n["about-shame-project"]={onTap:()=>{window.open("https://github.com/Minecraftgoose/GooseHyperGlass","_blank")}},c+=22;let w=eu("shame_plagiarism",i),A=e_(w,13,e-64),E=em("about-shame-plagiarism",{x:32,y:c,w:e-64,h:A},w,{color:y,fontSizePx:13,fontWeight:400,align:"left",wrap:!0,paddingPx:0,halo:a.homeTextHalo});E.scroll=!0,o.push(E),c+=A+6;let P=eu("shame_quality",i),M=e_(P,13,e-64),F=em("about-shame-quality",{x:32,y:c,w:e-64,h:M},P,{color:y,fontSizePx:13,fontWeight:400,align:"left",wrap:!0,paddingPx:0,halo:a.homeTextHalo});F.scroll=!0,o.push(F);let _=em("about-shame-coverup-title",{x:32,y:c+=M+8,w:e-64,h:16},eu("shame_coverup_title",i),{color:T,fontSizePx:13,fontWeight:600,align:"left",paddingPx:0,halo:a.homeTextHalo});for(let t of(_.scroll=!0,o.push(_),c+=20,[{key:"shame_coverup_1",id:"about-shame-coverup-1"},{key:"shame_coverup_2",id:"about-shame-coverup-2"},{key:"shame_coverup_3",id:"about-shame-coverup-3"}])){let r=eu(t.key,i),n=e_(r,13,e-64),s=em(t.id,{x:32,y:c,w:e-64,h:n},r,{color:y,fontSizePx:13,fontWeight:400,align:"left",wrap:!0,paddingPx:0,halo:a.homeTextHalo});s.scroll=!0,o.push(s),c+=n+3}c+=6;let B=eu("shame_conclusion",i),D=e_(B,13,e-64),z=em("about-shame-conclusion",{x:32,y:c,w:e-64,h:D},B,{color:y,fontSizePx:13,fontWeight:600,align:"left",wrap:!0,paddingPx:0,halo:a.homeTextHalo});z.scroll=!0,o.push(z);let L=em("about-shame-evidence",{x:32,y:c+=D+8,w:e-64,h:16},eu("shame_evidence",i),{color:u,fontSizePx:13,fontWeight:500,align:"left",paddingPx:0,halo:a.homeTextHalo});return L.isInteractive=!0,L.scroll=!0,o.push(L),n["about-shame-evidence"]={onTap:()=>{window.open("https://github.com/Kyant0/AndroidLiquidGlass/issues/112","_blank")}},{elements:o,interactions:n,contentHeight:c+=40}}(t,0,n,e$,eK);break;case $.PerfBenchmark:h=function(e,t,r,a,i,o=ee){let n=[],s={},l=a.locale||"zh",u=o.backIconColor,c="running"===a.perfProgress||"stop-requested"===a.perfProgress,h=a.perfDone,d=(e-290)/2,f=(t-290)/2-100,g=a.perfGlassAngle||0,p=a.perfDeformMul??+!!c;for(let e=0;e<4;e++)for(let t=0;t<4;t++){let r,i,o=4*e+t,s=eP.has(o),l=(s?12:6)*p,u=(s?.2:.1)*p,c=f+(75*e+32.5)*1,h=.8*p,m=d+(75*t+32.5)*1+28*h*Math.sin(.35*g+.7*e),b=c+22*h*Math.cos(.35*g+.8*t),S=g+(e+t-3)*.35;s?i=r=(65+l*Math.sin(S))*1:(r=65,i=65);let v=m-r/2,x=b-i/2,C=Math.min(r,i),T=eS(`perf-glass-${o}`,{x:v,y:x,w:r,h:i},{cornerRadius:.5*C*a.cornerRadiusFrac,refractionHeight:a.refractionHeightFrac*C*.5,refractionAmount:-a.refractionAmountFrac*C,blurRadius:+a.blurRadiusDp,saturation:1.5,surfaceColor:[0,0,0,0],highlight:{...J,mode:2,alpha:.38},depthEffect:!0,chromaticAberration:a.chromaticAberration>0});if(T.useSeparableBlur=!0,T.isInteractive=!0,T.scroll=!1,!s){let e=Math.cos(S);T.elementScaleX=1+u*e,T.elementScaleY=1-u*e}n.push(T)}let m=a.perfStatusText||"";m&&n.push(em("perf-status",{x:16,y:t-170,w:e-32,h:24},m,{color:u,fontSizePx:13,fontWeight:500,align:"center",paddingPx:0,halo:o.homeTextHalo},!1));let b=a.perfProgressFracAnimated??0,S=t-120,v=e-16,x=Math.max(0,v*b),C="light"===o.homeTextHalo;n.push({id:"perf-progress-track",kind:"plain-rect",rect:{x:8,y:S,w:v,h:4},cornerRadius:2,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:1,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:{mode:0,color:[1,1,1],angle:0,falloff:0,alpha:0,widthDp:0},outerShadow:null,plainRect:{color:C?[1,1,1,.12]:[0,0,0,.12]},isInteractive:!1,scroll:!1}),x>.5&&n.push({id:"perf-progress-fill",kind:"plain-rect",rect:{x:8,y:S,w:x,h:4},cornerRadius:2,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:1,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:{mode:0,color:[1,1,1],angle:0,falloff:0,alpha:0,widthDp:0},outerShadow:null,plainRect:{color:[0,136/255,1,1]},isInteractive:!1,scroll:!1});let T=c?eu("perf_stop",l):h?eu("perf_retest",l):eu("item_perf_benchmark",l),y={id:"perf-btn",kind:"button",rect:{x:(e-140)/2,y:t-60,w:140,h:44},...Z,cornerRadius:22,tintColor:c?[232/255,68/255,58/255,1]:[1,141/255,40/255,1],surfaceColor:[0,0,0,0],highlight:{...J},outerShadow:{...Q},label:T,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!0,scroll:!1};n.push(y),s["perf-btn"]={onTap:()=>{c?i({perfProgress:"stop-requested"}):i({perfProgress:"running",perfDone:!1,perfResultDpr:0,perfStatusText:"",perfGlassAngle:0,perfProgressFrac:0,perfProgressFracAnimated:0,perfDeformMul:1,perfExitProgress:0,perfRoundTrigger:1})}};let R=a.perfExitProgress??0;if(h&&R>.01){let a=t-60,i={id:"perf-exit",kind:"button",rect:{x:(e-100)/2,y:a+(t-110-a)*R,w:100,h:44},...Z,cornerRadius:22,refractionHeight:Z.refractionHeight*R,refractionAmount:Z.refractionAmount*R,blurRadius:Z.blurRadius*R,tintColor:[0,136/255,1,R],surfaceColor:[0,0,0,0],highlight:{...J,alpha:R},outerShadow:{...Q,alpha:Q.alpha*R},label:eu("perf_exit",l),labelColor:[1,1,1,R],showChevron:!1,isInteractive:R>.5,scroll:!1};n.push(i),s["perf-exit"]={onTap:()=>r()}}for(let e of n)e.scroll=!1;return{elements:n,interactions:s,contentHeight:t}}(t,r,n,a,i,e$);break;default:h=eT(t,o,e$)}let ej=e===$.Settings,eZ=e===$.PerfBenchmark,eJ=a.hideOverlayButtons&&!ej||eZ,eQ=h.elements.findIndex(e=>"__back__"===e.id);if(eQ>=0)if(eJ)h.elements.splice(eQ,1),delete h.interactions.__back__;else{let[e]=h.elements.splice(eQ,1);h.elements.push(e)}if(u&&!eJ){let e=function(e,t,r,a,i=!1){return{element:{id:"__theme__",kind:"button",rect:{x:a-16-56,y:16,w:56,h:56},...Z,cornerRadius:28,tintColor:[0,0,0,0],surfaceColor:t.buttonSurface,highlight:null,outerShadow:{...Q},label:"",labelColor:t.backIconColor,showChevron:!1,isInteractive:!0,scroll:i,icon:{path:r?"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z":"M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM4.22 4.22a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 1 1-1.42 1.41L4.22 5.63a1 1 0 0 1 0-1.41zm12.73 12.73a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 1 1-1.42 1.41l-1.41-1.42a1 1 0 0 1 0-1.41zM2 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1zm17 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1zM4.22 19.78a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.42l-1.41 1.41a1 1 0 0 1-1.42 0zM16.95 7.05a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.42l-1.41 1.41a1 1 0 0 1-1.42 0z",size:32,color:t.backIconColor}},interaction:{onTap:()=>e()}}}(u,e$,l,t,!1);a.globalSeparableBlur&&(e.element.useSeparableBlur=!0),h.elements.push(e.element),h.interactions[e.element.id]=e.interaction}let e0=e===$.About;if(c&&e!==$.Home&&!ej&&!e0&&!eZ){let e=eu("pick_image",eK),a=Math.ceil(es(e,16)+48),i=ep("__pickimage__",{x:t/2-a/2,y:r-16-56,w:a,h:56},{label:e,tintColor:[0,136/255,1,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1],labelFontSizePx:16},!1);h.elements.push(i),h.interactions.__pickimage__={onTap:()=>c(),onDragStart:()=>{},onDrag:()=>{},onDragEnd:()=>{}}}if(a.globalSeparableBlur)for(let e of h.elements)"button"!==e.kind&&"glass-shape"!==e.kind||e.isSdfTexture||e.isToggleKnob||e.isBottomTabIndicator||e.isMagnifier||(e.useSeparableBlur=!0);if(!a.highlightAa)for(let e of h.elements)e.highlight&&(e.highlight.aa=!1);return h}function eD({wallpaperSrc:e,elements:t,contentHeight:i,onReady:o,interactions:n,scrollResetToken:s,backgroundColor:l=null,toggleTargets:u,tabTargets:c,rendererRef:h,className:d,dpr:f,blurTapCap:g,cornerStyle:p}){let m=a.useRef(null),b=a.useRef(null),S=a.useRef(null),v=a.useRef(t);a.useEffect(()=>{v.current=t});let x=a.useRef(n);a.useEffect(()=>{x.current=n});let C=a.useRef(new Map),T=a.useRef(null);a.useEffect(()=>{if(!m.current||!b.current)return;let t=new q(m.current);S.current=t,h&&(h.current=t),t.setBackgroundColor(l),t.loadWallpaper(e).then(()=>{requestAnimationFrame(()=>{o?.()})}).catch(e=>{console.error(e),requestAnimationFrame(()=>{o?.()})}),t.loadSdfTexture("/clock_sdf.webp").catch(e=>console.error(e));let r=()=>{let e=b.current?.getBoundingClientRect();e&&(m.current.style.width=e.width+"px",m.current.style.height=e.height+"px",t.resize(e.width,e.height))};if(null!=f){let e=window.devicePixelRatio||1;t.dpr=f>0?Math.max(.5,Math.min(e,f)):e}null!=g&&(t.blurTapCap=Math.max(1,Math.min(33,0|g))),null!=p&&(t.cornerStyle=p),r();let a=new ResizeObserver(r);a.observe(b.current);let i=e=>{e.preventDefault();let r=0!==e.deltaY?e.deltaY:e.deltaX,a=t.getScrollY();t.setScrollY(a+r)},n=m.current;return n.addEventListener("wheel",i,{passive:!1}),()=>{a.disconnect(),n.removeEventListener("wheel",i),t.dispose(),S.current=null,h&&(h.current=null)}},[e]),a.useEffect(()=>{S.current?.setBackgroundColor(l)},[l]),a.useEffect(()=>{let e=S.current;if(!e||null==f)return;let t=window.devicePixelRatio||1;e.dpr=f>0?Math.max(.5,Math.min(t,f)):t;let r=b.current?.getBoundingClientRect();r&&e.resize(r.width,r.height)},[f]),a.useEffect(()=>{let e=S.current;e&&null!=g&&(e.blurTapCap=Math.max(1,Math.min(33,0|g)))},[g]),a.useEffect(()=>{let e=S.current;e&&null!=p&&(e.cornerStyle=p,e.requestRender())},[p]),a.useEffect(()=>{S.current?.setElements(t)},[t]),a.useEffect(()=>{void 0!==i&&S.current?.setContentHeight(i)},[i]),a.useEffect(()=>{S.current?.setScrollY(0)},[s]),a.useEffect(()=>{if(!u)return;let e=S.current;if(e)for(let[t,r]of Object.entries(u))K.has(t)||e.setToggleTarget(t,r)},[u]),a.useEffect(()=>{if(!c)return;let e=S.current;if(e)for(let[t,{tabIndex:r,tabsCount:a}]of Object.entries(c))K.has(t)||e.setTabSelected(t,r,a)},[c]);let y=e=>{let t=m.current.getBoundingClientRect();return{x:e.clientX-t.left,y:e.clientY-t.top}},R=a.useCallback(e=>{let t=v.current,r=m.current,a=S.current;if(!r||!a)return;let{x:i,y:o}=y(e),n=a.getScrollY(),s=x.current,l=null;for(let e=t.length-1;e>=0;e--){let r=t[e],a=r.hitRect??r.rect,u=r.scroll?a.y-n:a.y,c=i,h=o,d=r.elementRotation;if(d&&Math.abs(d)>.001){let e=a.x+.5*a.w,t=(r.scroll?a.y-n:a.y)+.5*a.h,s=i-e,l=o-t,u=Math.cos(-d),f=Math.sin(-d);c=e+s*u-l*f,h=t+s*f+l*u}if(c>=a.x&&c<=a.x+a.w&&h>=u&&h<=u+a.h){if(!s?.[r.id]&&!r.isInteractive)continue;l=r;break}}if(l){let t=l.id,n=Array.from(C.current.entries()).find(([,e])=>e.pressedId===t&&"transform"!==e.mode);if(n&&s?.[t]?.onTransform){let[u,c]=n;l.isInteractive&&("button"===l.kind||"text"===l.kind)&&a.setPressed(t,!1);let h={x:c.x,y:c.y},d=i-h.x,f=o-h.y;T.current={dist:Math.hypot(d,f),angle:Math.atan2(f,d),cx:(h.x+i)/2,cy:(h.y+o)/2},c.mode="transform",c.transformPartner=e.pointerId,C.current.set(e.pointerId,{pressedId:t,startX:i,startY:o,startClientY:e.clientY,startScrollY:a.getScrollY(),dragStarted:!1,mode:"transform",hasDrag:!!s?.[t]?.onDrag,velocitySamples:[{t:performance.now(),x:e.clientX,y:e.clientY}],x:i,y:o,transformPartner:u});try{r.setPointerCapture(e.pointerId)}catch{}return}}let u=!!(l&&s?.[l.id]?.onDrag);if(C.current.set(e.pointerId,{pressedId:l?l.id:null,startX:i,startY:o,startClientY:e.clientY,startScrollY:a.getScrollY(),dragStarted:!1,mode:"pending",hasDrag:u,velocitySamples:[{t:performance.now(),x:e.clientX,y:e.clientY}],x:i,y:o,transformPartner:null}),l&&l.isInteractive){let e=!!s?.[l.id]?.onDrag;("button"===l.kind||"text"===l.kind||"glass-shape"===l.kind&&!e&&s?.[l.id]?.onTap)&&a.setPressed(l.id,!0,{x:i,y:o})}try{r.setPointerCapture(e.pointerId)}catch{}},[]),k=a.useCallback(e=>{let t=S.current;if(!m.current||!t)return;let{x:r,y:a}=y(e),i=C.current.get(e.pointerId);if(!i)return;if(i.x=r,i.y=a,"transform"===i.mode){let e=i.transformPartner;if(null==e)return;let t=C.current.get(e);if(!t)return;let r=i.pressedId;if(!r)return;let a=t.x-i.x,o=t.y-i.y,n=Math.hypot(a,o),s=Math.atan2(o,a),l=(i.x+t.x)/2,u=(i.y+t.y)/2,c=T.current;if(c&&c.dist>.001){let e=n/c.dist,t=s-c.angle;t>Math.PI&&(t-=2*Math.PI),t<-Math.PI&&(t+=2*Math.PI);let a={x:l-c.cx,y:u-c.cy};x.current?.[r]?.onTransform?.(a,e,t)}T.current={dist:n,angle:s,cx:l,cy:u};return}i.velocitySamples.push({t:performance.now(),x:e.clientX,y:e.clientY}),i.velocitySamples.length>20&&i.velocitySamples.shift();let o=r-i.startX,n=a-i.startY,s=Math.abs(o),l=Math.abs(n);if("pending"===i.mode){let o=i.pressedId;if(o){let e=v.current.find(e=>e.id===o);e?.kind==="button"&&e.isInteractive&&t.setDragPosition(o,{x:r,y:a})}if(s<4&&l<4)return;let n=i.pressedId,u=v.current,c=n?u.find(e=>e.id===n):null,h=c?.kind==="button"&&c?.isInteractive,d=!!c&&!!x.current?.[n]?.onDrag,f=!d&&c?.kind==="glass-shape"&&c?.isInteractive&&!!x.current?.[n]?.onTap;if(d)i.mode="drag",i.dragStarted=!0,x.current?.[n]?.onDragStart?.({x:r,y:a});else if(h||f)t.setDragPosition(n,{x:r,y:a});else if(l>s+2&&l>=14){if(Array.from(C.current.entries()).some(([t,r])=>t!==e.pointerId&&"scroll"===r.mode))return;if(n){let e=u.find(e=>e.id===n);e?.isInteractive&&"text"===e.kind&&t.setPressed(n,!1)}i.mode="scroll";let r=e.clientY-i.startClientY;t.setScrollY(i.startScrollY-r);return}}if("scroll"===i.mode){let r=e.clientY-i.startClientY;t.setScrollY(i.startScrollY-r);return}if("drag"===i.mode){let e=i.pressedId;if(!e)return;let s=v.current.find(t=>t.id===e);if(!s)return;"button"===s.kind&&s.isInteractive&&t.setDragPosition(e,{x:r,y:a}),x.current?.[e]?.onDrag?.({x:r,y:a},{x:o,y:n})}},[]),w=a.useCallback(e=>{let t=S.current,r=m.current,a=C.current.get(e.pointerId);if(!a){if(r&&r.hasPointerCapture(e.pointerId))try{r.releasePointerCapture(e.pointerId)}catch{}return}let i=a.mode,o=a.pressedId;if("transform"===i){let t=a.transformPartner;if(C.current.delete(e.pointerId),T.current=null,null!=t){let e=C.current.get(t);e&&(e.transformPartner=null,e.mode="drag",e.dragStarted=!0,e.startX=e.x,e.startY=e.y,e.pressedId&&x.current?.[e.pressedId]?.onDragStart?.({x:e.x,y:e.y}))}if(r&&r.hasPointerCapture(e.pointerId))try{r.releasePointerCapture(e.pointerId)}catch{}return}if(t){if(o){let e=v.current.find(e=>e.id===o);if(e?.isInteractive){let r=!!x.current?.[o]?.onDrag;("button"===e.kind||"text"===e.kind||"glass-shape"===e.kind&&!r&&x.current?.[o]?.onTap)&&t.setPressed(o,!1)}}if("scroll"===i){let e=(e=>{if(e.length<2)return 0;let t=e[e.length-1].t,r=t-100,a=e[e.length-1];for(let t=e.length-1;t>=0&&!(e[t].t<r);t--)a=e[t];let i=(t-a.t)/1e3;return i<.001?0:-(e[e.length-1].y-a.y)/i})(a.velocitySamples);Math.abs(e)>50&&t.setScrollVelocity(e)}if(o){let{x:t,y:r}=y(e);if(a.dragStarted){let{x:e,y:i}=(e=>{if(e.length<2)return{x:0,y:0};let t=e[e.length-1],r=t.t,a=r-100,i=t;for(let t=e.length-1;t>=0&&!(e[t].t<a);t--)i=e[t];let o=(r-i.t)/1e3;return o<.001?{x:0,y:0}:{x:(t.x-i.x)/o,y:(t.y-i.y)/o}})(a.velocitySamples);x.current?.[o]?.onDragEnd?.({x:t,y:r},{x:e,y:i})}else("pending"===i||"drag"===i)&&x.current?.[o]?.onTap?.({x:t,y:r})}}if(C.current.delete(e.pointerId),r&&r.hasPointerCapture(e.pointerId))try{r.releasePointerCapture(e.pointerId)}catch{}},[]);return(0,r.jsx)("div",{ref:b,className:d,style:{position:"relative"},children:(0,r.jsx)("canvas",{ref:m,onPointerDown:R,onPointerMove:k,onPointerUp:w,onPointerLeave:w,onPointerCancel:w,style:{display:"block",width:"100%",height:"100%",cursor:"pointer",touchAction:"none"}})})}async function ez(){try{if(!navigator.userAgentData?.getHighEntropyValues)return{};let e=await navigator.userAgentData.getHighEntropyValues(["platform","platformVersion","architecture","model","uaFullVersion","fullVersionList"]);return{uaPlatform:e.platform,uaPlatformVersion:e.platformVersion,uaArchitecture:e.architecture,uaModel:e.model,uaBrowsers:e.fullVersionList?e.fullVersionList.map(e=>`${e.brand}/${e.version}`).join("; "):void 0}}catch{return{}}}async function eL(e,t){let r=await ez(),a=function(e){try{let t=e||document.createElement("canvas"),r=t.getContext("webgl2")||t.getContext("webgl")||t.getContext("experimental-webgl");if(!r)return{gpuVendor:null,gpuRenderer:null,webglVersion:null,maxTextureSize:null,maxRenderbufferSize:null};let a=r.getExtension("WEBGL_debug_renderer_info"),i=a?r.getParameter(a.UNMASKED_VENDOR_WEBGL):r.getParameter(r.VENDOR),o=a?r.getParameter(a.UNMASKED_RENDERER_WEBGL):r.getParameter(r.RENDERER),n=r instanceof WebGL2RenderingContext?"WebGL 2.0":"WebGL 1.0",s=r.getParameter(r.MAX_TEXTURE_SIZE),l=r.getParameter(r.MAX_RENDERBUFFER_SIZE);return{gpuVendor:i,gpuRenderer:o,webglVersion:n,maxTextureSize:s,maxRenderbufferSize:l}}catch{return{gpuVendor:null,gpuRenderer:null,webglVersion:null,maxTextureSize:null,maxRenderbufferSize:null}}}(e),i=function(e){try{let t=e||document.querySelector("canvas");if(!t)return{canvasCssWidth:null,canvasCssHeight:null,canvasBufferWidth:null,canvasBufferHeight:null,canvasDpr:null};let r=t.offsetWidth,a=t.offsetHeight,i=t.width,o=t.height,n=i>0?i/r:window.devicePixelRatio;return{canvasCssWidth:r,canvasCssHeight:a,canvasBufferWidth:i,canvasBufferHeight:o,canvasDpr:n}}catch{return{canvasCssWidth:null,canvasCssHeight:null,canvasBufferWidth:null,canvasBufferHeight:null,canvasDpr:null}}}(e),o=function(){try{let e=navigator.connection;if(!e)return{};return{connectionType:e.type,connectionDownlink:e.downlink,connectionRtt:e.rtt,connectionEffectiveType:e.effectiveType}}catch{return{}}}(),n=function(){try{let e=document.createElement("canvas");e.width=200,e.height=50;let t=e.getContext("2d");t.textBaseline="top",t.font="14px Arial",t.fillStyle="#f60",t.fillRect(125,1,62,20),t.fillStyle="#069",t.font="11px Arial",t.fillText("LiquidGlassFP 🎨",2,15),t.fillStyle="rgba(102, 204, 0, 0.7)",t.font="18px Arial",t.fillText("WebGL!",4,45);let r=e.toDataURL(),a=0;for(let e=0;e<r.length;e++){let t=r.charCodeAt(e);a=(a<<5)-a+t,a&=a}return Math.abs(a).toString(36)}catch{return null}}();return{userAgent:navigator.userAgent,platform:navigator.platform,...r,cpuCores:navigator.hardwareConcurrency??null,deviceMemory:navigator.deviceMemory??null,...a,screenWidth:screen.width,screenHeight:screen.height,screenAvailWidth:screen.availWidth,screenAvailHeight:screen.availHeight,colorDepth:screen.colorDepth,pixelDepth:screen.pixelDepth,devicePixelRatio:window.devicePixelRatio,...i,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,language:navigator.language,languages:navigator.languages.join(","),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,cookieEnabled:navigator.cookieEnabled,doNotTrack:navigator.doNotTrack??null,online:navigator.onLine,...o,canvasFingerprint:n,pageTitle:document.title,pageUrl:window.location.href,isDarkTheme:t??null}}async function eO(t){try{let{supabase:r}=await e.A(60959),a=function(e){let t={};for(let[r,a]of Object.entries(e))t[r.replace(/[A-Z]/g,e=>`_${e.toLowerCase()}`)]=a;return t}(t),{data:i,error:o}=await r.from("device_info").insert([a]).select().single();if(o)return{success:!1,error:o.message};return{success:!0,data:i}}catch(e){return{success:!1,error:String(e)}}}function eI(){let e,t=function(){let[e,t]=a.useState("light");return a.useEffect(()=>{if(!window.matchMedia)return;let e=window.matchMedia("(prefers-color-scheme: dark)"),r=()=>t(e.matches?"dark":"light");return r(),e.addEventListener("change",r),()=>e.removeEventListener("change",r)},[]),e}(),[i,o]=a.useState(null),n="light"===(i??t),[s,l]=a.useState($.Home),u="liquid-glass-settings",[c,h]=a.useState({...eo,...(()=>{try{let e=window.localStorage.getItem(u);if(!e)return{};let t=JSON.parse(e);return{customDpr:"number"==typeof t.customDpr?t.customDpr:0,globalSeparableBlur:"boolean"!=typeof t.globalSeparableBlur||t.globalSeparableBlur,blurTapCap:"number"==typeof t.blurTapCap?t.blurTapCap:17,blurDownsample:"number"==typeof t.blurDownsample?t.blurDownsample:1,capsuleShape:"boolean"!=typeof t.capsuleShape||t.capsuleShape,locale:"zh"===t.locale||"en"===t.locale?t.locale:"zh",pageTransition:"boolean"!=typeof t.pageTransition||t.pageTransition,showFps:"boolean"==typeof t.showFps&&t.showFps}}catch{return{}}})()}),[d,f]=a.useState({w:420,h:900}),[g,p]=a.useState(!1),m=a.useRef(null),b=a.useRef(null),[S,v]=a.useState(0),x=a.useRef(0),C=a.useRef(0),T=["原版是 Kotlin 写的 Android 应用","Web 版用 Next.js + WebGL 复刻","液态玻璃效果靠折射+模糊+色散","圆角用 SDF 着色器计算","开关拖动有弹簧动画","控制中心有回弹过冲","放大镜 1.5x 缩放采样","可分离模糊双通道加速","DPR 自动检测二分搜索","全部渲染在 GPU 完成"],[y,R]=a.useState(T[0]);a.useEffect(()=>{R(T[Math.floor(Math.random()*T.length)]);let e=setInterval(()=>{R(T[Math.floor(Math.random()*T.length)])},3e3);return()=>clearInterval(e)},[]);let k=s===$.PerfBenchmark&&"running"===c.perfProgress;a.useEffect(()=>{if(!c.showFps&&!k||!g)return;x.current=0,C.current=performance.now();let e=()=>{x.current++;let r=performance.now(),a=r-C.current;a>=1e3&&(v(Math.round(1e3*x.current/a)),x.current=0,C.current=r),t=requestAnimationFrame(e)},t=requestAnimationFrame(e);return()=>cancelAnimationFrame(t)},[c.showFps,k,g]),a.useEffect(()=>{g&&c.perfDone&&!(c.perfResultDpr<=0)&&eL(document.querySelector("canvas"),!n).then(e=>{eO(e).then(e=>{e.success?console.log("[DeviceInfo] Recorded to Supabase ✓ (DPR:",c.perfResultDpr,")"):console.warn("[DeviceInfo] Failed:",e.error)})})},[g,c.perfDone,c.perfResultDpr]);let w="liquid-glass-perf-dpr",A=a.useRef("idle"),E=a.useRef(.5),P=a.useRef(0),M=a.useRef(0),F=a.useRef(0);a.useEffect(()=>{F.current=c.perfProgressFrac??0},[c.perfProgressFrac]),a.useEffect(()=>{"running"===c.perfProgress&&s!==$.PerfBenchmark&&l($.PerfBenchmark)},[c.perfProgress,s]),a.useEffect(()=>{if(g&&!(c.customDpr>0)){try{let e=window.localStorage.getItem(w);if(e){let t=parseFloat(e);if(t>0)return void D({customDpr:t})}}catch{}l($.PerfBenchmark),D({perfProgress:"running",perfDone:!1,perfResultDpr:0,perfStatusText:"",customDpr:0,perfGlassAngle:0,perfProgressFrac:0,perfProgressFracAnimated:0,perfDeformMul:1,perfExitProgress:0,perfRoundTrigger:1})}},[g,c.customDpr]),a.useEffect(()=>{let e;if(s!==$.PerfBenchmark||!g||"running"!==c.perfProgress||"measuring"===A.current)return;let t=window.devicePixelRatio||1;"done"===A.current&&(A.current="idle",M.current=0,E.current=.5,P.current=t),0===M.current&&(E.current=.5,P.current=t);let r=M.current+1;e=1===r?P.current:2===r?E.current:Math.round((E.current+P.current)/2*4)/4,M.current=r,A.current="measuring",D({customDpr:e,perfStatusText:`第${r}/7轮 \xb7 DPR: ${e} \xb7 正在检测性能...`,perfProgressFrac:(r-1)/7});let a=0,i=0,o=0,n=0,l=s=>{o||(o=s,i=s);let u=s-i;i=s,u>0&&u<200&&a++;let c=s-o,h=(r-1)/7+Math.min(1,c/2e3)/7;(F.current=h,D({perfProgressFrac:h}),c>=2e3)?function(e,t,r,a,i){if(e>=55?E.current=t:P.current=t,2===a&&.5===t&&e<55){A.current="done";let e=`检测完成 \xb7 推荐 DPR：0.5 \xb7 性能有限，已自动降低画质`;try{window.localStorage.setItem(w,String(.5))}catch{}D({customDpr:.5,perfDone:!0,perfResultDpr:.5,perfStatusText:e,perfProgress:null,perfProgressFrac:1});return}if(a>=7||P.current-E.current<=.25){let e=Math.max(.5,Math.min(r,E.current));A.current="done";let t=e>=.75*r?`检测完成！推荐 DPR：${e} \xb7 设备可流畅运行液态玻璃`:`检测完成 \xb7 推荐 DPR：${e} \xb7 性能有限，已自动降低画质`;try{window.localStorage.setItem(w,String(e))}catch{}D({customDpr:e,perfDone:!0,perfResultDpr:e,perfStatusText:t,perfProgress:null,perfProgressFrac:1})}else A.current="idle",D(r=>({perfProgress:"running",perfRoundTrigger:r.perfRoundTrigger+1,perfStatusText:`第${a}/${7}轮 \xb7 DPR: ${t} \xb7 FPS: ${e}fps`}))}(a>5?Math.round(1e3*a/c):0,e,t,r,7):n=requestAnimationFrame(l)};return n=requestAnimationFrame(l),()=>cancelAnimationFrame(n)},[s,c.perfProgress,c.perfRoundTrigger,g]),a.useEffect(()=>{if("stop-requested"!==c.perfProgress)return;let e=window.devicePixelRatio||1,t=Math.max(.5,Math.min(e,E.current));A.current="done";let r=t>=.75*e?`检测完成！推荐 DPR：${t} \xb7 设备可流畅运行液态玻璃`:`检测完成 \xb7 推荐 DPR：${t} \xb7 性能有限，已自动降低画质`;try{window.localStorage.setItem(w,String(t))}catch{}D({customDpr:t,perfDone:!0,perfResultDpr:t,perfStatusText:r,perfProgress:null,perfProgressFrac:1})},[c.perfProgress]),a.useEffect(()=>{if(s!==$.PerfBenchmark||"running"!==c.perfProgress&&"stop-requested"!==c.perfProgress||!g)return;let e=2*Math.PI,t=c.perfGlassAngle||0,r=c.perfProgressFracAnimated??0,a=0,i=0,o=n=>{a||(a=n);let s=Math.min(.05,(n-a)/1e3);a=n,t+=e*s;let l=F.current;r+=(l-r)*Math.min(1,4*s),D({perfGlassAngle:t,perfProgressFracAnimated:r}),i=requestAnimationFrame(o)};return i=requestAnimationFrame(o),()=>cancelAnimationFrame(i)},[s,c.perfProgress,g]),a.useEffect(()=>{if(s!==$.PerfBenchmark||!g||!c.perfDone||c.perfDeformMul<=.01&&c.perfExitProgress>=.99&&(c.perfProgressFracAnimated??0)>=.99)return;let e=2*Math.PI,t=c.perfGlassAngle||0,r=c.perfProgressFracAnimated??0,a=0,i=0,o=0,n=s=>{i||(i=s);let l=Math.min(.05,(s-i)/1e3);i=s,a+=l,t+=e*l;let u=Math.exp(-3*a),c=0;if(a>.3){let e=Math.min(1,(a-.3)/.5);c=1-(1-e)*(1-e)}let h=F.current;(r+=(h-r)*Math.min(1,4*l),D({perfGlassAngle:t,perfDeformMul:u,perfExitProgress:c,perfProgressFracAnimated:r}),u<=.01&&c>=.99&&r>=.99)?D({perfDeformMul:0,perfExitProgress:1,perfProgressFracAnimated:1}):o=requestAnimationFrame(n)};return o=requestAnimationFrame(n),()=>cancelAnimationFrame(o)},[s,c.perfDone,g]);let _=a.useRef(null),B=a.useRef("/wallpaper/wallpaper_light.webp"),D=a.useCallback(e=>{h(t=>{let r="function"==typeof e?e(t):e,a={...t,...r};if(void 0!==r.customDpr||void 0!==r.globalSeparableBlur||void 0!==r.blurTapCap||void 0!==r.blurDownsample||void 0!==r.capsuleShape||void 0!==r.hideOverlayButtons||void 0!==r.locale||void 0!==r.pageTransition||void 0!==r.showFps)try{window.localStorage.setItem(u,JSON.stringify({customDpr:a.customDpr,globalSeparableBlur:a.globalSeparableBlur,blurTapCap:a.blurTapCap,blurDownsample:a.blurDownsample,capsuleShape:a.capsuleShape,hideOverlayButtons:a.hideOverlayButtons,locale:a.locale,pageTransition:a.pageTransition,showFps:a.showFps}))}catch{}return a})},[]),[z,L]=a.useState("idle"),O=a.useRef("enter"),I=a.useRef(null),H=a.useCallback(e=>{c.pageTransition?(I.current=e,O.current="enter",L("fadeOut")):l(e),e!==$.Home&&window.history.pushState({dest:e},"")},[c.pageTransition]),U=a.useCallback(()=>{let e=$.Home;c.pageTransition?(I.current=e,O.current="exit",L("fadeOut")):l(e),window.history.state?.dest!==void 0&&window.history.back()},[c.pageTransition]);a.useEffect(()=>{if("fadeOut"===z){let e=setTimeout(()=>{l(I.current??$.Home),I.current=null,L("prepIn")},200);return()=>clearTimeout(e)}if("prepIn"===z)return void requestAnimationFrame(()=>{requestAnimationFrame(()=>{L("fadeIn")})});if("fadeIn"===z){let e=setTimeout(()=>{L("idle")},200);return()=>clearTimeout(e)}},[z]),a.useEffect(()=>{let e=()=>{"idle"===z&&(c.pageTransition?(I.current=$.Home,O.current="exit",L("fadeOut")):l($.Home))};return window.addEventListener("popstate",e),()=>window.removeEventListener("popstate",e)},[c.pageTransition,z]),a.useEffect(()=>{let e=()=>{let e=Math.min(900,window.innerHeight),t=b.current?.parentElement;t&&(t.style.height=e+"px"),b.current&&(b.current.style.height=e+"px");let r=b.current?.getBoundingClientRect();r&&f({w:r.width,h:r.height})};e();let t=new ResizeObserver(e);return b.current&&t.observe(b.current),window.addEventListener("resize",e),window.addEventListener("orientationchange",e),()=>{t.disconnect(),window.removeEventListener("resize",e),window.removeEventListener("orientationchange",e)}},[]);let W=d.w,N=d.h,X=a.useCallback(()=>{o(e=>"light"===e?"dark":"light")},[]);a.useEffect(()=>{if(!("DeviceMotionEvent"in window)||s!==$.ControlCenter)return;let e=45,t=t=>{let r=t.accelerationIncludingGravity;if(!r||null==r.x||null==r.y)return;let a=r.x,i=180*Math.atan2(r.y,a)/Math.PI-e;for(;i>180;)i-=360;for(;i<-180;)i+=360;for(e+=.5*i;e>180;)e-=360;for(;e<-180;)e+=360;let o=e*Math.PI/180;_.current?.setGravityAngle(o)};return window.addEventListener("devicemotion",t),()=>window.removeEventListener("devicemotion",t)},[_,s]);let G=a.useMemo(()=>eB(s,W,N,c,D,H,U,_,n,X,()=>m.current?.click()),[s,W,N,c,D,H,U,n,X]),Y=s===$.Home||s===$.Settings||s===$.About,V=a.useMemo(()=>Y?s===$.Settings?n?[.94,.94,.96]:[0,0,0]:n?[1,1,1]:[0,0,0]:null,[Y,n,s]),q=a.useMemo(()=>{let e={};if(s===$.Toggle){let t=+!!c.toggleOn;e.toggle1=t,e.toggle2=t}if(s===$.Slider){let t=c.sliderValue/100;e.slider1=t,e.slider2=t}if(s===$.GlassPlayground&&(e["gp-slider-0"]=c.cornerRadiusFrac,e["gp-slider-1"]=c.blurRadiusDp/32,e["gp-slider-2"]=c.refractionHeightFrac,e["gp-slider-3"]=c.refractionAmountFrac,e["gp-slider-4"]=c.chromaticAberration),s===$.Settings){let t=window.devicePixelRatio||1,r=Math.max(1e-4,t-.5),a=c.customDpr>0?Math.max(.5,Math.min(t,c.customDpr)):t;e["settings-dpr"]=Math.max(0,Math.min(1,(a-.5)/r)),e["settings-blur-taps"]=Math.max(0,Math.min(1,(c.blurTapCap-1)/32)),e["settings-blur-global"]=+!!c.globalSeparableBlur,e["settings-shape-capsule"]=+!!c.capsuleShape,e["settings-ui-hide-overlays"]=+!!c.hideOverlayButtons,e["settings-transition-toggle"]=+!!c.pageTransition,e["settings-fps-toggle"]=+!!c.showFps,e["settings-highlight-aa"]=+!!c.highlightAa}return e},[s,c.toggleOn,c.sliderValue,c.cornerRadiusFrac,c.blurRadiusDp,c.refractionHeightFrac,c.refractionAmountFrac,c.chromaticAberration,c.customDpr,c.blurTapCap,c.globalSeparableBlur,c.capsuleShape,c.hideOverlayButtons,c.pageTransition,c.showFps,c.highlightAa]),K=a.useMemo(()=>{let e={};return s===$.BottomTabs&&(e.tabs3={tabIndex:c.selectedTab,tabsCount:3},e.tabs4={tabIndex:c.selectedTab2,tabsCount:4}),e},[s,c.selectedTab,c.selectedTab2]),j=a.useRef({x:0,y:0}),Z=a.useRef(null),J=a.useRef(!1);return a.useEffect(()=>{j.current.x=c.algOffsetX,j.current.y=c.algOffsetY},[c.algOffsetX,c.algOffsetY]),a.useEffect(()=>{if(s!==$.AdaptiveLuminanceGlass)return;let e=new Image;e.crossOrigin="anonymous",e.onload=()=>{let t=document.createElement("canvas");t.width=e.naturalWidth,t.height=e.naturalHeight;let r=t.getContext("2d",{alpha:!1});r&&(r.drawImage(e,0,0),Z.current=t,J.current=!0)},e.src=B.current},[s]),a.useEffect(()=>{if(s!==$.AdaptiveLuminanceGlass)return;let e=0,t=0,r=c.adaptiveLuminance,a=c.adaptiveLuminance,i=o=>{if(e=requestAnimationFrame(i),o-t>=200){t=o;let e=Z.current;if(J.current&&e){let t=e.getContext("2d",{alpha:!1});if(t){let r=(W-160)/2+j.current.x+80,i=(N-160)/2+j.current.y+80,o=e.width,n=e.height,s=Math.max(W/o,N/n),l=(W-o*s)/2,u=(N-n*s)/2,c=0,h=0;try{for(let e=0;e<5;e++)for(let a=0;a<5;a++){let d=r-56+112*a/4,f=i-56+112*e/4,g=Math.round((d-l)/s),p=Math.round((f-u)/s);if(g>=0&&g<o&&p>=0&&p<n){let e=t.getImageData(g,p,1,1).data;c+=(.2126*e[0]+.7152*e[1]+.0722*e[2])/255,h++}}}catch{}h>0&&(a=c/h)}}}let n=a-r;Math.abs(n)>.001&&(r+=.06*n,D(e=>.01>Math.abs(e.adaptiveLuminance-r)?{}:{adaptiveLuminance:r}))};return e=requestAnimationFrame(i),()=>cancelAnimationFrame(e)},[s,W,N,D]),(0,r.jsx)("div",{className:"w-full flex items-center justify-center",style:{background:n?"#FFFFFF":"#000000",height:"100vh",overflow:"hidden"},children:(0,r.jsxs)("div",{ref:b,className:"relative overflow-hidden shadow-2xl lg-frame",suppressHydrationWarning:!0,style:{width:"min(420px, 100vw)",opacity:+("fadeOut"!==z&&"prepIn"!==z),transform:(e=O.current,"fadeOut"===z?"enter"===e?"translateX(-16px)":"translateX(16px)":"prepIn"===z?"enter"===e?"translateX(16px)":"translateX(-16px)":"translateX(0)"),transition:c.pageTransition&&"prepIn"!==z?"opacity 200ms ease, transform 200ms ease":"none"},children:[!g&&(0,r.jsxs)("div",{style:{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:n?"#FFFFFF":"#050507",zIndex:50},children:[(0,r.jsx)("div",{style:{width:36,height:36,borderRadius:"50%",border:`3px solid ${n?"#e0e0e0":"#333"}`,borderTopColor:n?"#333":"#aaa",animation:"lg-spinner 0.8s linear infinite"}}),(0,r.jsxs)("p",{style:{color:n?"#666":"#999",fontSize:13,lineHeight:1.5,textAlign:"center",maxWidth:320,margin:0},children:["💡 ",y]})]}),(0,r.jsx)(eD,{wallpaperSrc:"/wallpaper/wallpaper_light.webp",elements:G.elements,contentHeight:G.contentHeight,interactions:G.interactions,scrollResetToken:s,backgroundColor:V,toggleTargets:q,tabTargets:K,rendererRef:_,dpr:c.customDpr,blurTapCap:c.blurTapCap,className:"w-full h-full",onReady:()=>p(!0)}),(c.showFps||k)&&g&&(0,r.jsxs)("div",{style:{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",color:"#0f0",font:"bold 14px monospace",padding:"4px 8px",borderRadius:4,zIndex:40,pointerEvents:"none"},children:["FPS: ",S]}),(0,r.jsx)("input",{ref:m,type:"file",accept:"image/*",style:{display:"none"},onChange:e=>{let t=e.target.files?.[0];if(t){let e=URL.createObjectURL(t);B.current=e,_.current?.loadWallpaper(e).catch(()=>{}),J.current=!1;let r=new Image;r.crossOrigin="anonymous",r.onload=()=>{let e=document.createElement("canvas");e.width=r.naturalWidth,e.height=r.naturalHeight;let t=e.getContext("2d",{alpha:!1});t&&(t.drawImage(r,0,0),Z.current=e,J.current=!0)},r.src=e}e.target.value=""}})]})})}e.s(["buildCatalog",()=>eB],80668),e.i(80668),e.s(["default",()=>eI],52683)}]);