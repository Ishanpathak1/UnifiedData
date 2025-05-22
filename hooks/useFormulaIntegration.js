import { useRef, useEffect, useState, useCallback } from 'react';
import { 
  getHyperFormulaInstance, 
  resetFormulaEngine, 
  updateFormulaData,
  configureHandsontableFormulas,
  evaluateFormula
} from '../utils/spreadsheet/formulaEngine';

/**
 * Hook for integrating HyperFormula with Handsontable
 * Manages formula calculation, cell dependencies, and updates
 * 
 * @param {Object} hotRef - Reference to Handsontable instance
 * @param {Array} data - Spreadsheet data
 * @param {string} activeSheetId - Currently active sheet ID
 * @returns {Object} Formula-related utilities and state
 */
const useFormulaIntegration = (hotRef, data, activeSheetId) => {
  const initialized = useRef(false);
  const [hasFormulaError, setHasFormulaError] = useState(false);
  
  // Initialize formula engine when component mounts
  useEffect(() => {
    try {
      if (!hotRef.current || initialized.current) return;
      
      // Reset the formula engine when component mounts
      resetFormulaEngine();
      
      // Mark as initialized
      initialized.current = true;
      setHasFormulaError(false);
    } catch (error) {
      console.error("Error initializing formula engine:", error);
      setHasFormulaError(true);
    }
    
    // Clean up on unmount
    return () => {
      try {
        resetFormulaEngine();
        initialized.current = false;
      } catch (e) {
        console.warn("Error cleaning up formula engine:", e);
      }
    };
  }, []);
  
  // Configure Handsontable to use HyperFormula when the hot instance is available
  useEffect(() => {
    try {
      if (!hotRef.current || !hotRef.current.hotInstance) return;
      
      const hot = hotRef.current.hotInstance;
      
      // Configure Handsontable for formula processing
      configureHandsontableFormulas(hot);
      
      // Update formula engine with current data
      if (data && data.length > 0) {
        updateFormulaData(data);
      }
      
      setHasFormulaError(false);
    } catch (error) {
      console.error("Error configuring formula integration:", error);
      setHasFormulaError(true);
    }
  }, [hotRef.current?.hotInstance]);
  
  // Update formula engine when data changes
  useEffect(() => {
    try {
      if (!hotRef.current || !hotRef.current.hotInstance || !data || data.length === 0) return;
      
      // Update formula data when spreadsheet data changes
      updateFormulaData(data);
      setHasFormulaError(false);
    } catch (error) {
      console.error("Error updating formula data:", error);
      setHasFormulaError(true);
    }
  }, [data]);
  
  // Update when sheet changes
  useEffect(() => {
    try {
      if (!hotRef.current || !hotRef.current.hotInstance) return;
      
      // When sheet changes, update the formula engine with new data
      const hot = hotRef.current.hotInstance;
      updateFormulaData(hot.getData());
      setHasFormulaError(false);
    } catch (error) {
      console.error("Error updating formula engine on sheet change:", error);
      setHasFormulaError(true);
    }
  }, [activeSheetId]);
  
  // Safe formula evaluation wrapper
  const safeEvaluateFormula = useCallback((formula, row, col, sheetId = 0) => {
    try {
      return evaluateFormula(formula, row, col, sheetId);
    } catch (error) {
      console.error("Formula evaluation error:", error);
      return '#ERROR!';
    }
  }, []);
  
  // Process formula input for the formula bar
  const processFormulaInput = useCallback((value, row, col) => {
    if (typeof value === 'string' && value.startsWith('=')) {
      try {
        // Just set the raw formula in the cell
        // The formula engine hooks will handle evaluation
        return value;
      } catch (e) {
        console.error('Formula processing error:', e);
        return value;
      }
    }
    return value;
  }, []);
  
  // Return utility functions and state
  return {
    evaluateFormula: safeEvaluateFormula,
    hyperFormula: getHyperFormulaInstance(),
    resetFormulaEngine,
    processFormulaInput,
    hasFormulaError,
    
    // Manually trigger formula recalculation
    recalculateFormulas: useCallback(() => {
      try {
        if (!hotRef.current || !hotRef.current.hotInstance) return;
        
        const hot = hotRef.current.hotInstance;
        const currentData = hot.getData();
        
        // Update formula engine with current data to trigger recalculation
        updateFormulaData(currentData);
        
        // Render to show updated results
        hot.render();
        
        return true;
      } catch (error) {
        console.error("Error recalculating formulas:", error);
        setHasFormulaError(true);
        return false;
      }
    }, [hotRef])
  };
};

export default useFormulaIntegration; 