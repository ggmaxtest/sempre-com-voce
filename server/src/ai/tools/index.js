// Registro central das ferramentas. Para adicionar uma ferramenta nova,
// basta importá-la e registrá-la aqui — o Orquestrador a descobre automaticamente.
import { registerTool } from './registry.js';
import { webSearchTool } from './web-search.js';
import { fetchUrlTool } from './fetch-url.js';
import { imageGenTool } from './image-gen.js';
import { fileAnalyzeTool } from './file-analyze.js';
import { marketingCalcTool } from './marketing-calc.js';

let registered = false;

export function registerAllTools() {
  if (registered) return;
  registerTool(webSearchTool);
  registerTool(fetchUrlTool);
  registerTool(imageGenTool);
  registerTool(fileAnalyzeTool);
  registerTool(marketingCalcTool);
  registered = true;
}

export * from './registry.js';
