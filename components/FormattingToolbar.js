import React from 'react';
import styles from '../styles/Spreadsheet.module.css';

const FormattingToolbar = ({ onFormat }) => {
  return (
    <div className={styles.formattingToolbar}>
      <button
        onClick={() => {
          console.log('[FormattingToolbar] Bold clicked');
          onFormat('bold');
        }}
        title="Bold"
      >
        <b>B</b>
      </button>
      <button
        onClick={() => {
          console.log('[FormattingToolbar] Italic clicked');
          onFormat('italic');
        }}
        title="Italic"
      >
        <i>I</i>
      </button>
      <button
        onClick={() => {
          console.log('[FormattingToolbar] Underline clicked');
          onFormat('underline');
        }}
        title="Underline"
      >
        <u>U</u>
      </button>
      <input
        type="color"
        title="Text Color"
        onChange={e => {
          console.log('[FormattingToolbar] Text Color clicked');
          onFormat('textColor', e.target.value);
        }}
        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
      />
      <input
        type="color"
        title="Cell Background"
        onChange={e => {
          console.log('[FormattingToolbar] Background Color clicked');
          onFormat('backgroundColor', e.target.value);
        }}
        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
      />
      <select
        title="Number Format"
        onChange={e => onFormat('numberFormat', e.target.value)}
        defaultValue=""
        style={{ marginLeft: 8 }}
      >
        <option value="">Format</option>
        <option value="plain">Plain</option>
        <option value="currency">Currency</option>
        <option value="percent">Percent</option>
        <option value="number">Number</option>
      </select>
    </div>
  );
};

export default FormattingToolbar; 