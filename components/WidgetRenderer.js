import { useRef } from 'react';
import { WIDGET_TYPES } from '../utils/widgetTypes';
import TextWidget from './widgets/TextWidget';
import KPIWidget from './widgets/KPIWidget';
import IFrameWidget from './widgets/IFrameWidget';
import TableWidget from './widgets/TableWidget';
import styles from '../styles/WidgetRenderer.module.css';

export default function WidgetRenderer({ 
  widget, 
  onDelete, 
  onEdit, 
  onRefresh,
  isDraggable = true
}) {
  const { id, type, title, config } = widget;
  
  // Render the appropriate widget based on type
  const renderWidgetContent = () => {
    switch (type) {
      case WIDGET_TYPES.TEXT:
        return <TextWidget id={id} config={config} onEdit={onEdit} />;
      case WIDGET_TYPES.KPI:
        return <KPIWidget id={id} config={config} onRefresh={onRefresh} />;
      case WIDGET_TYPES.IFRAME:
        return <IFrameWidget id={id} config={config} />;
      case WIDGET_TYPES.TABLE:
        return <TableWidget id={id} config={config} onRefresh={onRefresh} />;
      case WIDGET_TYPES.CHART:
        // Assuming you already have a chart component
        return <div className={styles.chartPlaceholder}>Chart Rendering</div>;
      default:
        return <div className={styles.unknownWidget}>Unknown widget type: {type}</div>;
    }
  };

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>{title || 'Untitled'}</h3>
        <div className={styles.widgetActions}>
          {type !== WIDGET_TYPES.TEXT && (
            <button 
              onClick={() => onRefresh?.(id)}
              className={styles.refreshButton}
              title="Refresh data"
            >
              ↻
            </button>
          )}
          <button 
            onClick={() => onEdit?.(id)}
            className={styles.editButton}
            title="Edit widget"
          >
            ✎
          </button>
          <button 
            onClick={() => onDelete?.(id)}
            className={styles.deleteButton}
            title="Delete widget"
          >
            ×
          </button>
          {isDraggable && (
            <div className={styles.dragHandle} title="Drag to move">
              ⋮⋮
            </div>
          )}
        </div>
      </div>
      <div className={styles.widgetContent}>
        {renderWidgetContent()}
      </div>
    </div>
  );
}
