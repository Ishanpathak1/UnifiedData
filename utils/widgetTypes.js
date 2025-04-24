// Define widget type constants
export const WIDGET_TYPES = {
  CHART: 'chart',
  TEXT: 'text',
  KPI: 'kpi',
  IFRAME: 'iframe',
  TABLE: 'table'
};

// Widget default configurations
export const DEFAULT_WIDGET_CONFIG = {
  [WIDGET_TYPES.TEXT]: {
    content: 'Add your text here...',
    formatting: {
      align: 'left',
      fontSize: 'medium'
    }
  },
  [WIDGET_TYPES.KPI]: {
    title: 'Metric',
    value: 0,
    prefix: '',
    suffix: '',
    comparison: {
      value: null,
      type: 'previous', // 'previous', 'target', 'none'
      showPercentage: true
    },
    colorCoding: {
      enabled: true,
      positiveColor: '#4caf50',
      negativeColor: '#f44336',
      neutralColor: '#757575'
    }
  },
  [WIDGET_TYPES.IFRAME]: {
    url: '',
    aspectRatio: '16:9',
    scrollable: true,
    allowFullscreen: true
  },
  [WIDGET_TYPES.TABLE]: {
    columns: [],
    pageSize: 10,
    showPagination: true,
    sortable: true,
    filterable: true
  }
};

// Widget size presets
export const WIDGET_SIZE_PRESETS = {
  [WIDGET_TYPES.TEXT]: { w: 6, h: 4, minW: 2, minH: 2 },
  [WIDGET_TYPES.KPI]: { w: 3, h: 2, minW: 2, minH: 2 },
  [WIDGET_TYPES.IFRAME]: { w: 6, h: 6, minW: 3, minH: 3 },
  [WIDGET_TYPES.TABLE]: { w: 8, h: 6, minW: 4, minH: 3 },
  [WIDGET_TYPES.CHART]: { w: 6, h: 4, minW: 3, minH: 3 }
};

// Widget display information
export const WIDGET_DISPLAY_INFO = {
  [WIDGET_TYPES.TEXT]: {
    name: 'Text Block',
    description: 'Add notes, descriptions, or context to your dashboard',
    icon: '📝'
  },
  [WIDGET_TYPES.KPI]: {
    name: 'KPI Metric',
    description: 'Display a key value with comparison and trend',
    icon: '📊'
  },
  [WIDGET_TYPES.IFRAME]: {
    name: 'Embedded Content',
    description: 'Embed external websites or content',
    icon: '🔗'
  },
  [WIDGET_TYPES.TABLE]: {
    name: 'Data Table',
    description: 'Display tabular data with sorting and filtering',
    icon: '📋'
  },
  [WIDGET_TYPES.CHART]: {
    name: 'Chart',
    description: 'Visualize data with various chart types',
    icon: '📈'
  }
};

// Create a new widget of specified type
export const createNewWidget = (type, overrides = {}) => {
  if (!WIDGET_TYPES[type] && !Object.values(WIDGET_TYPES).includes(type)) {
    throw new Error(`Invalid widget type: ${type}`);
  }

  const widgetType = WIDGET_TYPES[type] || type;
  const defaultSize = WIDGET_SIZE_PRESETS[widgetType];
  const defaultConfig = DEFAULT_WIDGET_CONFIG[widgetType] || {};

  return {
    id: `widget_${Date.now()}`,
    type: widgetType,
    title: WIDGET_DISPLAY_INFO[widgetType]?.name || 'Widget',
    position: { x: 0, y: 0, ...defaultSize },
    config: { ...defaultConfig },
    createdAt: new Date().toISOString(),
    ...overrides
  };
};
