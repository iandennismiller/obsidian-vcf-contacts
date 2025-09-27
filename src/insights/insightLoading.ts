import { insightService } from "src/insights/insightService";
import { UidProcessor } from 'src/insights/processors/UidProcessor';
import { VcfSyncPreProcessor } from 'src/insights/processors/VcfSyncPreProcessor';

insightService.register(UidProcessor);
insightService.register(VcfSyncPreProcessor);
