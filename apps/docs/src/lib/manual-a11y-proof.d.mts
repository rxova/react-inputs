export interface ManualA11yProofResult {
  combination: string
  status: 'pass' | 'pending' | 'fail'
  testedAt: string | null
  tester: string | null
  osVersion: string | null
  browserVersion: string | null
  assistiveTechnologyVersion: string | null
}

export interface ManualA11yProofRecord {
  component: string
  sourceHash: string
  scenarioVersion: number
  results: ManualA11yProofResult[]
}

export declare const manualA11yRecords: ManualA11yProofRecord[]
export declare function manualA11yMarkdown(records?: ManualA11yProofRecord[]): string
