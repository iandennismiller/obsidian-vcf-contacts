import { insightService } from "src/insights/insightService";
import { UidProcessor } from 'src/insights/processors/UidProcessor';
import { VcfSyncPreProcessor } from 'src/insights/processors/VcfSyncPreProcessor';
import { RelatedOtherProcessor } from 'src/insights/processors/RelatedOtherProcessor';
import { RelatedFrontMatterProcessor } from 'src/insights/processors/RelatedFrontMatterProcessor';

insightService.register(UidProcessor);
insightService.register(VcfSyncPreProcessor);
insightService.register(RelatedOtherProcessor);
insightService.register(RelatedFrontMatterProcessor);
