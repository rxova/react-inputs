// Hand-written types for docs-md.mjs: the module stays plain JavaScript, and the
// pages it returns are docs-kit's.

import type { DocsPage } from '@rxova/docs-kit'

export declare function docsPages(options: { origin: string; base?: string }): Promise<DocsPage[]>
