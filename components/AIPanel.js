// components/AIPanel.js
import styles from '../styles/AIPanel.module.css';
import { useState, useEffect } from 'react';
import { detectOperationType } from '../utils/matrixUtils';
import MatrixOperationSelector from './MatrixOperationSelector';

const AIPanel = ({ query, setQuery, aiResponse, setAiResponse, onAskAI, onClose, hotRef }) => {
  const [isMatrixOperation, setIsMatrixOperation] = useState(false);
  const [operationType, setOperationType] = useState(null);
  const [matrixResult, setMatrixResult] = useState(null);
  const [pendingOperation, setPendingOperation] = useState(null);
  const [localAiResponse, setLocalAiResponse] = useState(aiResponse);
  
  // Update localAiResponse when aiResponse prop changes
  useEffect(() => {
    setLocalAiResponse(aiResponse);
  }, [aiResponse]);

  const handleAskAI = async () => {
    if (!query.trim()) return;
    
    // Reset states
    setMatrixResult(null);
    
    // Check if query is related to matrix operations
    const detectedOperation = detectOperationType(query);
    
    if (detectedOperation) {
      console.log("Detected matrix operation:", detectedOperation);
      // Set the pending operation and show confirmation
      setPendingOperation(detectedOperation);
      setLocalAiResponse(`I can help with ${detectedOperation} calculations. Would you like me to set this up for you?`);
      return;
    }
    
    // If not a matrix operation, proceed with the normal AI query
    onAskAI();
  };

  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiPanelHeader}>
        <h3>AI Assistant</h3>
        <button 
          onClick={onClose} 
          className={styles.closeButton}
        >
          ×
        </button>
      </div>
      
      <div className={styles.aiResponseArea}>
        {localAiResponse && !isMatrixOperation && !pendingOperation && (
          <div className={styles.aiResponseText}>{localAiResponse}</div>
        )}
        
        {pendingOperation && (
          <div className={styles.matrixOperationPrompt}>
            <div className={styles.aiResponseText}>
              I can help with {pendingOperation} calculations. Would you like me to set this up for you?
            </div>
            <div className={styles.actionPrompt}>
              <button 
                onClick={() => {
                  setIsMatrixOperation(true);
                  setOperationType(pendingOperation);
                  setPendingOperation(null);
                }}
                className={styles.confirmButton}
              >
                Yes, set up {pendingOperation} calculation
              </button>
              <button 
                onClick={() => {
                  setPendingOperation(null);
                  setLocalAiResponse('');
                }}
                className={styles.cancelButton}
              >
                No, thanks
              </button>
            </div>
          </div>
        )}
        
        {isMatrixOperation && !matrixResult && (
          <div className={styles.matrixOperationUI}>
            <MatrixOperationSelector 
              operation={operationType}
              hotRef={hotRef}
              onCalculate={(result, selectedColumns) => {
                setMatrixResult({
                  ...result,
                  selectedColumns: selectedColumns
                });
              }}
              onCancel={() => {
                setIsMatrixOperation(false);
                setOperationType(null);
              }}
            />
          </div>
        )}
        
        {isMatrixOperation && matrixResult && (
          <div className={styles.matrixResult}>
            <h4>Result of {operationType}:</h4>
            
            {matrixResult.result_type === 'matrix' && (
              <>
                <div className={styles.matrixGrid}>
                  {matrixResult.result.map((row, rowIndex) => (
                    <div key={`row-${rowIndex}`} className={styles.matrixRow}>
                      {row.map((cell, colIndex) => (
                        <div key={`cell-${rowIndex}-${colIndex}`} className={styles.matrixCell}>
                          {typeof cell === 'number' ? cell.toFixed(2) : cell}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className={styles.resultSummary}>
                  {matrixResult.selectedColumns?.join(', ') || ''} 
                  → {matrixResult.result.length}×{matrixResult.result[0].length} matrix
                </p>
              </>
            )}
            
            {matrixResult.result_type === 'scalar' && (
              <>
                <div className={styles.scalarResult}>
                  {typeof matrixResult.result === 'number' ? matrixResult.result.toFixed(4) : matrixResult.result}
                </div>
                <p className={styles.resultSummary}>
                  Determinant of {matrixResult.selectedColumns?.join(', ') || ''}
                </p>
              </>
            )}
            
            {matrixResult.result_type === 'vector' && (
              <>
                <div className={styles.vectorResult}>
                  {matrixResult.result.map((val, i) => (
                    <div key={`val-${i}`} className={styles.vectorValue}>
                      {typeof val === 'object' 
                        ? `λ${i+1} = ${val.real.toFixed(2)}${val.imag >= 0 ? ' + ' : ' - '}${Math.abs(val.imag).toFixed(2)}i` 
                        : `λ${i+1} = ${typeof val === 'number' ? val.toFixed(2) : val}`}
                    </div>
                  ))}
                </div>
                <p className={styles.resultSummary}>
                  Eigenvalues of {matrixResult.selectedColumns?.join(', ') || ''}
                </p>
              </>
            )}
            
            {matrixResult.result_type === 'pca' && (
              <>
                <div className={styles.pcaResult}>
                  <h4>Principal Components</h4>
                  <div className={styles.explainedVariance}>
                    {matrixResult.explained_variance.map((val, i) => (
                      <div key={`var-${i}`} className={styles.varianceBar}>
                        <div className={styles.varianceLabel}>PC{i+1}</div>
                        <div className={styles.varianceValue} style={{width: `${val * 100}%`}}>
                          {(val * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.pcaMatrix}>
                    {matrixResult.result.map((row, rowIndex) => (
                      <div key={`pca-row-${rowIndex}`} className={styles.matrixRow}>
                        {row.map((cell, colIndex) => (
                          <div key={`pca-cell-${rowIndex}-${colIndex}`} className={styles.matrixCell}>
                            {typeof cell === 'number' ? cell.toFixed(2) : cell}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <p className={styles.resultSummary}>
                  The first {matrixResult.explained_variance.length} principal components explain 
                  {(matrixResult.explained_variance.reduce((a, b) => a + b, 0) * 100).toFixed(1)}% of variance
                </p>
              </>
            )}
            
            <div className={styles.resultActions}>
              <button 
                onClick={() => {
                  if (hotRef && hotRef.current && matrixResult) {
                    // Export to spreadsheet
                    const hot = hotRef.current.hotInstance;
                    const selected = hot.getSelected();
                    let startRow = 0, startCol = 0;
                    
                    if (selected && selected.length > 0) {
                      [startRow, startCol] = selected[0];
                    }
                    
                    if (matrixResult.result_type === 'matrix') {
                      const matrix = matrixResult.result;
                      for (let r = 0; r < matrix.length; r++) {
                        for (let c = 0; c < matrix[0].length; c++) {
                          hot.setDataAtCell(startRow + r, startCol + c, matrix[r][c]);
                        }
                      }
                    } else if (matrixResult.result_type === 'scalar') {
                      hot.setDataAtCell(startRow, startCol, matrixResult.result);
                    } else if (matrixResult.result_type === 'vector') {
                      const vector = matrixResult.result;
                      for (let i = 0; i < vector.length; i++) {
                        const value = typeof vector[i] === 'object' 
                          ? `${vector[i].real.toFixed(4)}${vector[i].imag >= 0 ? '+' : ''}${vector[i].imag.toFixed(4)}i` 
                          : vector[i];
                        hot.setDataAtCell(startRow + i, startCol, value);
                      }
                    }
                  }
                }}
                className={styles.exportButton}
              >
                Export to Spreadsheet
              </button>
              <button 
                onClick={() => {
                  setIsMatrixOperation(false);
                  setMatrixResult(null);
                  setOperationType(null);
                }}
                className={styles.newQueryButton}
              >
                New Query
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className={styles.aiInputArea}>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
          className={styles.aiInput}
          placeholder="Ask about your data or request calculations..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAskAI();
            }
          }}
        />
      <button
        onClick={handleAskAI}
        className={styles.askButton}
      >
          Ask
      </button>
        </div>
    </div>
  );
};

export default AIPanel;