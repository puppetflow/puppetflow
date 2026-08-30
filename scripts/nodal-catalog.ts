import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_NODAL_CATALOG } from '../resources/js/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/generatedCatalog';

const outputPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'catalog.json',
);

fs.writeFileSync(outputPath, `${JSON.stringify(GENERATED_NODAL_CATALOG, null, 2)}\n`);
process.stdout.write(`Wrote ${outputPath}\n`);
