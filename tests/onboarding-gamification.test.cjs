/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("onboarding gamification: el progreso usa microcopy sobrio y guiado", () => {
  const flowSource = read("components/onboarding/onboarding-flow.tsx");

  assert.match(flowSource, /Tu negocio va tomando forma/);
  assert.match(flowSource, /Ya tienes lo esencial/);
  assert.match(flowSource, /Solo te falta un paso/);
  assert.match(flowSource, /Todo listo para publicar/);
  assert.match(flowSource, /Agregar nombre del negocio/);
  assert.match(flowSource, /Seleccionar tipo/);
  assert.match(flowSource, /Agregar tu primer producto/);
});

test("onboarding gamification: existen estados visuales para actual, completado y cierre", () => {
  const flowSource = read("components/onboarding/onboarding-flow.tsx");
  const pageSource = read("app/onboarding/page.tsx");

  assert.match(flowSource, /Actual/);
  assert.match(flowSource, /Listo/);
  assert.match(flowSource, /Cierre/);
  assert.match(flowSource, /isMobileKeyboardOpen \? "compact" : "full"/);
  assert.match(flowSource, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(flowSource, /transition-\[padding,opacity,transform\] duration-200 ease-out/);
  assert.match(flowSource, /transition-\[padding,box-shadow,background-color,border-color,transform,opacity\] duration-200 ease-out/);
  assert.match(flowSource, /transition-\[margin,opacity,max-height,transform\] duration-200 ease-out/);
  assert.match(flowSource, /progressRewardActive/);
  assert.match(flowSource, /progressRewardSeed/);
  assert.match(flowSource, /progressRewardCardClassName/);
  assert.match(flowSource, /publishRedirectTimeoutRef/);
  assert.match(flowSource, /publishSuccessVisible/);
  assert.match(flowSource, /publishSuccessExpanded/);
  assert.match(flowSource, /Negocio publicado/);
  assert.match(flowSource, /Todo listo\. Te llevamos a tu panel/);
  assert.match(flowSource, /role="status"/);
  assert.match(flowSource, /aria-live="polite"/);
  assert.match(flowSource, /radial-gradient\(circle_at_top,_rgba\(74,222,128,0\.40\),_transparent_58%\)/);
  assert.match(flowSource, /radial-gradient\(circle_at_bottom,_rgba\(167,243,208,0\.24\),_transparent_72%\)/);
  assert.match(flowSource, /status === "ready"/);
  assert.match(flowSource, /status === "current"/);
  assert.match(flowSource, /status === "completed"/);
  assert.match(flowSource, /pb-\[calc\(13rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(flowSource, /bg-\[linear-gradient\(90deg,#10b981_0%,#34d399_100%\)\]/);
  assert.match(flowSource, /bg-\[linear-gradient\(135deg,#047857_0%,#10b981_100%\)\]/);
  assert.match(flowSource, /CheckCircle2 className="mr-2 h-\[18px\] w-\[18px\]"/);
  assert.match(flowSource, /3 de 4 pasos listos/);
  assert.match(flowSource, /3 de 4/);
  assert.doesNotMatch(flowSource, /4 de 4 pasos completos/);
  assert.match(flowSource, /mobileFooterDescriptionClassName/);
  assert.match(flowSource, /max-h-0 overflow-hidden opacity-0/);
  assert.match(flowSource, /max-h-16 opacity-100/);
  assert.match(flowSource, /keyboardViewportBaselineRef/);
  assert.match(flowSource, /requestAnimationFrame/);
  assert.match(flowSource, /orientationchange/);
  assert.match(flowSource, /bg-\[linear-gradient\(135deg,#047857_0%,#10b981_100%\)\] shadow-\[0_18px_34px_rgba\(4,120,87,0\.24\)\]/);
  assert.match(flowSource, /bg-\[linear-gradient\(135deg,#047857_0%,#10b981_100%\)\] px-2 py-0\.5 text-\[11px\] font-semibold text-white/);
  assert.match(flowSource, /href="\/login"/);
  assert.doesNotMatch(pageSource, /href="\/login"/);
});
