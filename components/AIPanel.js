// components/AIPanel.js
import styles from '../styles/AIPanel.module.css';
import { useState, useEffect, useRef } from 'react';
import { detectOperationType } from '../utils/matrixUtils';
import MatrixOperationSelector from './MatrixOperationSelector';
import ReactMarkdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import katex from 'katex';

// Custom component to render math expressions
const MathRenderer = ({ formula, display = false }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          displayMode: display,
          throwOnError: false
        });
      } catch (error) {
        containerRef.current.textContent = formula;
      }
    }
  }, [formula, display]);
  
  return <span ref={containerRef} />;
};

// Function to process text with math formulas
const FormattedMessage = ({ content }) => {
  // Split the content by math delimiters
  const parts = [];
  let remaining = content;
  let inlineMathRegex = /\\\[(.*?)\\\]/g;
  let blockMathRegex = /\\\begin\{equation\}(.*?)\\\end\{equation\}/gs;
  
  // Process text for math expressions
  const processMath = (text, regex, isBlock) => {
    const segments = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ 
          type: 'text', 
          content: text.substring(lastIndex, match.index) 
        });
      }
      
      segments.push({
        type: isBlock ? 'block-math' : 'inline-math',
        content: match[1]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }
    
    return segments;
  };
  
  // First process block math
  const blockSegments = processMath(content, blockMathRegex, true);
  
  // Then process inline math within each text segment
  const allSegments = [];
  blockSegments.forEach(segment => {
    if (segment.type === 'text') {
      allSegments.push(...processMath(segment.content, inlineMathRegex, false));
    } else {
      allSegments.push(segment);
    }
  });
  
  return (
    <div className={styles.formattedResponse}>
      {allSegments.map((segment, index) => {
        if (segment.type === 'text') {
          return <ReactMarkdown key={index}>{segment.content}</ReactMarkdown>;
        } else if (segment.type === 'inline-math') {
          return <MathRenderer key={index} formula={segment.content} display={false} />;
        } else if (segment.type === 'block-math') {
          return <MathRenderer key={index} formula={segment.content} display={true} />;
        }
        return null;
      })}
    </div>
  );
};

const AIPanel = ({ query, setQuery, aiResponse, setAiResponse, onAskAI, onClose, hotRef }) => {
  const [isMatrixOperation, setIsMatrixOperation] = useState(false);
  const [operationType, setOperationType] = useState(null);
  const [matrixResult, setMatrixResult] = useState(null);
  const [pendingOperation, setPendingOperation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Update messages when aiResponse prop changes
  useEffect(() => {
    if (aiResponse && aiResponse.trim() !== '') {
      // Simulate typing
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prevMessages => [
          ...prevMessages, 
          { type: 'ai', content: aiResponse }
        ]);
      }, 1000);
    }
  }, [aiResponse]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleAskAI = async () => {
    if (!query.trim()) return;
    
    // Add user message to chat
    setMessages(prevMessages => [
      ...prevMessages, 
      { type: 'user', content: query }
    ]);
    
    // Reset states
    setMatrixResult(null);
    
    // Check if query is related to matrix operations
    const detectedOperation = detectOperationType(query);
    
    if (detectedOperation) {
      console.log("Detected matrix operation:", detectedOperation);
      // Set the pending operation and show confirmation
      setPendingOperation(detectedOperation);
      
      // Add AI response about the matrix operation
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prevMessages => [
          ...prevMessages, 
          { 
            type: 'ai', 
            content: `I can help with ${detectedOperation} calculations. Would you like me to set this up for you?`,
            isMatrixPrompt: true,
            operation: detectedOperation
          }
        ]);
      }, 1000);
      
      return;
    }
    
    // If not a matrix operation, proceed with the normal AI query
    setIsTyping(true);
    // Clear the input after sending
    setQuery('');
    onAskAI();
  };

  const handleMatrixConfirm = (operation) => {
    setIsMatrixOperation(true);
    setOperationType(operation);
    setPendingOperation(null);
  };

  const handleMatrixCancel = () => {
    setPendingOperation(null);
    // Add AI response about cancellation
    setMessages(prevMessages => [
      ...prevMessages, 
      { type: 'ai', content: "No problem. Is there anything else I can help you with?" }
    ]);
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
        <div className={styles.messageContainer}>
          {messages.length === 0 && (
            <div className={styles.messageWrapper}>
              <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                AI
              </div>
              <div className={styles.messageContent}>
                <div className={styles.aiMessage}>
                  <div className={styles.aiResponseText}>
                    How can I help you with your data today?
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div key={index} className={styles.messageWrapper}>
              {message.type === 'user' ? (
                <>
                  <div className={styles.messageContent} style={{display: 'flex', justifyContent: 'flex-end'}}>
                    <div className={styles.userMessage}>
                      {message.content}
                    </div>
                  </div>
                  <div className={`${styles.avatar} ${styles.userAvatar}`}>
                    You
                  </div>
                </>
              ) : (
                <>
                  <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                    AI
                  </div>
                  <div className={styles.messageContent}>
                    <div className={styles.aiMessage}>
                      {message.isMatrixPrompt ? (
                        <>
                          <div className={styles.aiResponseText}>
                            {message.content}
                          </div>
                          <div className={styles.actionPrompt}>
                            <button 
                              onClick={() => handleMatrixConfirm(message.operation)}
                              className={styles.confirmButton}
                            >
                              Yes, set up {message.operation} calculation
                            </button>
                            <button 
                              onClick={handleMatrixCancel}
                              className={styles.cancelButton}
                            >
                              No, thanks
                            </button>
                          </div>
                        </>
                      ) : (
                        <FormattedMessage content={message.content} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className={styles.messageWrapper}>
              <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                AI
              </div>
              <div className={styles.typingIndicator}>
                <div className={styles.typingDot}></div>
                <div className={styles.typingDot}></div>
                <div className={styles.typingDot}></div>
              </div>
            </div>
          )}
          
          {isMatrixOperation && !matrixResult && (
            <div className={styles.messageWrapper}>
              <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                AI
              </div>
              <div className={styles.messageContent} style={{width: '100%'}}>
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
                      // Add AI response about cancellation
                      setMessages(prevMessages => [
                        ...prevMessages, 
                        { type: 'ai', content: "Operation cancelled. Is there anything else I can help you with?" }
                      ]);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {isMatrixOperation && matrixResult && (
            <div className={styles.messageWrapper}>
              <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                AI
              </div>
              <div className={styles.messageContent} style={{width: '100%'}}>
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
                        // Add AI response after completing matrix operation
                        setMessages(prevMessages => [
                          ...prevMessages, 
                          { type: 'ai', content: "I've completed the matrix operation. Is there anything else you'd like to calculate?" }
                        ]);
                      }}
                      className={styles.newQueryButton}
                    >
                      New Query
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
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
          disabled={!query.trim()}
      >
          Ask
      </button>
        </div>
    </div>
  );
};

export default AIPanel;