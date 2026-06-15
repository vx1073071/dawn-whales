/**
 * R222 JVS#2: Barrel re-exports for factor strategy templates.
 *
 * All templates split by market for maintainability:
 *   - factor-strategy-templates-hk.ts
 *   - factor-strategy-templates-crypto.ts
 *   - factor-strategy-templates-jpkr.ts
 *   - factor-strategy-templates-apac.ts
 *   - factor-strategy-templates-euin.ts
 *   - factor-strategy-templates-ai.ts
 *   - factor-strategy-templates-hksupplement.ts
 *   - factor-strategy-templates-crosssupplement.ts
 *   - factor-strategy-templates-aisupplement.ts
 *
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';
import { HK_TEMPLATES } from './factor-strategy-templates-hk';
import { CRYPTO_TEMPLATES } from './factor-strategy-templates-crypto';
import { JP_KR_TEMPLATES } from './factor-strategy-templates-jpkr';
import { TW_SG_AU_TEMPLATES } from './factor-strategy-templates-apac';
import { EU_IN_TEMPLATES } from './factor-strategy-templates-euin';
import { AI_TEMPLATES } from './factor-strategy-templates-ai';
import { HK_SUPPLEMENT_TEMPLATES } from './factor-strategy-templates-hksupplement';
import { CROSS_SUPPLEMENT_TEMPLATES } from './factor-strategy-templates-crosssupplement';
import { AI_SUPPLEMENT_TEMPLATES } from './factor-strategy-templates-aisupplement';

export { HK_TEMPLATES };
export { CRYPTO_TEMPLATES };
export { JP_KR_TEMPLATES };
export { TW_SG_AU_TEMPLATES };
export { EU_IN_TEMPLATES };
export { AI_TEMPLATES };
export { HK_SUPPLEMENT_TEMPLATES };
export { CROSS_SUPPLEMENT_TEMPLATES };
export { AI_SUPPLEMENT_TEMPLATES };

// ═══════════════════════════════════════════════════════════════════════════════
// Combined arrays (backward compatible)
// ═══════════════════════════════════════════════════════════════════════════════

/** R204: Combined HK + Crypto */
export const ALL_AUTOCLAW_TEMPLATES: FactorStrategyTemplate[] = [
  ...HK_TEMPLATES,
  ...CRYPTO_TEMPLATES,
  ...JP_KR_TEMPLATES,
  ...TW_SG_AU_TEMPLATES,
  ...EU_IN_TEMPLATES,
];

/** R206: All autoclaws + AI-native */
export const ALL_AUTOCLAW_TEMPLATES_R206: FactorStrategyTemplate[] = [
  ...HK_TEMPLATES,
  ...CRYPTO_TEMPLATES,
  ...JP_KR_TEMPLATES,
  ...TW_SG_AU_TEMPLATES,
  ...EU_IN_TEMPLATES,
  ...AI_TEMPLATES,
];

/** R207: All templates including supplements */
export const ALL_AUTOCLAW_TEMPLATES_R207: FactorStrategyTemplate[] = [
  ...HK_TEMPLATES,
  ...CRYPTO_TEMPLATES,
  ...JP_KR_TEMPLATES,
  ...TW_SG_AU_TEMPLATES,
  ...EU_IN_TEMPLATES,
  ...AI_TEMPLATES,
  ...HK_SUPPLEMENT_TEMPLATES,
  ...CROSS_SUPPLEMENT_TEMPLATES,
  ...AI_SUPPLEMENT_TEMPLATES,
];

export { ALL_AUTOCLAW_TEMPLATES as TEMPLATES };
