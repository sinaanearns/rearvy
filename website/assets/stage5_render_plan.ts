export type ElectronWorkflowPlan = {
  name: string;
  description: string;
  steps: Array<{
    id: string;
    name: string;
    action: {
      type: string;
      query?: string;
      ms?: number;
      keys?: string[];
      text?: string;
    };
    timeout: number;
  }>;
};

const plan: ElectronWorkflowPlan = {
  name: 'Stage 5 - DaVinci Resolve Import & Render',
  description: 'Launch DaVinci Resolve, import FCPXML timeline, trigger Quick Export to render the 45-second Rearvy SaaS promo video.',
  steps: [
    {
      id: 'launch_davinci',
      name: 'Launch DaVinci Resolve',
      action: {
        type: 'launchApp',
        query: 'DaVinci Resolve'
      },
      timeout: 30000
    },
    {
      id: 'wait_for_load',
      name: 'Wait for DaVinci to load',
      action: {
        type: 'wait',
        ms: 15000
      },
      timeout: 20000
    },
    {
      id: 'screenshot_verify_open',
      name: 'Verify DaVinci is open',
      action: {
        type: 'screenshot'
      },
      timeout: 10000
    },
    {
      id: 'focus_davinci',
      name: 'Focus DaVinci Resolve window',
      action: {
        type: 'focusWindow',
        query: 'DaVinci Resolve'
      },
      timeout: 10000
    },
    {
      id: 'open_file_menu',
      name: 'Open File menu via keyboard',
      action: {
        type: 'keyPress',
        keys: ['Alt', 'f']
      },
      timeout: 5000
    },
    {
      id: 'wait_menu',
      name: 'Wait for menu',
      action: {
        type: 'wait',
        ms: 500
      },
      timeout: 3000
    },
    {
      id: 'navigate_import',
      name: 'Navigate to Import submenu',
      action: {
        type: 'keyPress',
        keys: ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight']
      },
      timeout: 5000
    },
    {
      id: 'wait_submenu',
      name: 'Wait for submenu',
      action: {
        type: 'wait',
        ms: 500
      },
      timeout: 3000
    },
    {
      id: 'select_timeline_import',
      name: 'Select Timeline from Import submenu',
      action: {
        type: 'keyPress',
        keys: ['Enter']
      },
      timeout: 5000
    },
    {
      id: 'wait_file_dialog',
      name: 'Wait for file open dialog',
      action: {
        type: 'wait',
        ms: 2000
      },
      timeout: 5000
    },
    {
      id: 'type_fcpxml_path',
      name: 'Type FCPXML file path',
      action: {
        type: 'type',
        text: 'assets/Rearvy_SaaS_Product_Video.fcpxml'
      },
      timeout: 5000
    },
    {
      id: 'confirm_import',
      name: 'Press Enter to confirm import',
      action: {
        type: 'keyPress',
        keys: ['Enter']
      },
      timeout: 5000
    },
    {
      id: 'wait_timeline_load',
      name: 'Wait for timeline to load',
      action: {
        type: 'wait',
        ms: 8000
      },
      timeout: 12000
    },
    {
      id: 'screenshot_timeline',
      name: 'Capture loaded timeline',
      action: {
        type: 'screenshot'
      },
      timeout: 10000
    },
    {
      id: 'trigger_quick_export',
      name: 'Trigger Quick Export via Deliver page',
      action: {
        type: 'keyPress',
        keys: ['Control', 'd']
      },
      timeout: 5000
    },
    {
      id: 'wait_export_page',
      name: 'Wait for Deliver page',
      action: {
        type: 'wait',
        ms: 2000
      },
      timeout: 5000
    },
    {
      id: 'start_render',
      name: 'Start render with Enter',
      action: {
        type: 'keyPress',
        keys: ['Enter']
      },
      timeout: 5000
    },
    {
      id: 'wait_render',
      name: 'Wait for render to complete',
      action: {
        type: 'wait',
        ms: 120000
      },
      timeout: 180000
    },
    {
      id: 'verify_render',
      name: 'Capture final state',
      action: {
        type: 'screenshot'
      },
      timeout: 10000
    }
  ]
};

export default plan;
