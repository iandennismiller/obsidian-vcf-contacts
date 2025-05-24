import { insightService } from "src/insights/insightService";
import { UidProcessor } from 'src/insights/processors/UidProcessor';

insightService.register(UidProcessor);
