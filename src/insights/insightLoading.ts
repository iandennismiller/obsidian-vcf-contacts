import { insightService } from "src/insights/insightService";
import { UidProcessor } from 'src/insights/processors/UidProcessor';
import { VcfSyncPreProcessor } from 'src/insights/processors/VcfSyncPreProcessor';
import { RelatedOtherProcessor } from 'src/insights/processors/RelatedOtherProcessor';
import { RelatedFrontMatterProcessor } from 'src/insights/processors/RelatedFrontMatterProcessor';
import { RelatedListProcessor } from 'src/insights/processors/RelatedListProcessor';
import { VcfSyncPostProcessor } from 'src/insights/processors/VcfSyncPostProcessor';
import { GenderInferenceProcessor } from 'src/insights/processors/GenderInferenceProcessor';
import { GenderRenderProcessor } from 'src/insights/processors/GenderRenderProcessor';

insightService.register(UidProcessor);
insightService.register(VcfSyncPreProcessor);
insightService.register(RelatedOtherProcessor);
insightService.register(RelatedFrontMatterProcessor);
insightService.register(RelatedListProcessor);
insightService.register(VcfSyncPostProcessor);
insightService.register(GenderInferenceProcessor);
insightService.register(GenderRenderProcessor);
