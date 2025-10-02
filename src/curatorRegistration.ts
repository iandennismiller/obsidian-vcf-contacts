/**
 * Curator Processor Registration
 * 
 * This module registers all curator processors with the curatorService.
 * It must be imported before any code that accesses curatorService.settings()
 * to ensure the processors are registered and their default settings are available.
 */

import { curatorService } from "./models/curatorManager/curatorManager";

// Curator processor imports
import { UidProcessor } from './curators/uidValidate';
import { VcardSyncPreProcessor } from './curators/vcardSyncRead';
import { RelatedOtherProcessor } from './curators/relatedOther';
import { RelatedFrontMatterProcessor } from './curators/relatedFrontMatter';
import { RelatedListProcessor } from './curators/relatedList';
import { GenderInferenceProcessor } from './curators/genderInference';
import { GenderRenderProcessor } from './curators/genderRender';
import { RelatedNamespaceUpgradeProcessor } from './curators/namespaceUpgrade';
import { VcardSyncPostProcessor } from './curators/vcardSyncWrite';
import { ContactToFrontMatterProcessor } from './curators/contactToFrontMatter';
import { FrontMatterToContactProcessor } from './curators/frontMatterToContact';

// Register all curator processors at module load time
// This ensures they're available when DEFAULT_SETTINGS is created
curatorService.register(UidProcessor);
curatorService.register(VcardSyncPreProcessor);
curatorService.register(RelatedOtherProcessor);
curatorService.register(RelatedFrontMatterProcessor);
curatorService.register(RelatedListProcessor);
curatorService.register(RelatedNamespaceUpgradeProcessor);
curatorService.register(GenderInferenceProcessor);
curatorService.register(GenderRenderProcessor);
curatorService.register(ContactToFrontMatterProcessor);
curatorService.register(FrontMatterToContactProcessor);
curatorService.register(VcardSyncPostProcessor);

// Export for testing purposes
export const registeredProcessors = [
  UidProcessor,
  VcardSyncPreProcessor,
  RelatedOtherProcessor,
  RelatedFrontMatterProcessor,
  RelatedListProcessor,
  RelatedNamespaceUpgradeProcessor,
  GenderInferenceProcessor,
  GenderRenderProcessor,
  ContactToFrontMatterProcessor,
  FrontMatterToContactProcessor,
  VcardSyncPostProcessor
];
