import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useSpreadsheet } from '../contexts/SpreadsheetContext';
import loadSpreadsheetData from '../utils/spreadsheet/loadSpreadsheet';

/**
 * Custom hook to load spreadsheet data from the URL
 */
const useLoadSpreadsheet = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { user } = useAuth();
  
  const { 
    setSpreadsheetId,
    setDocumentTitle,
    setSheets,
    setActiveSheetId,
    setData,
    allSheetsRef
  } = useSpreadsheet();
  
  // Load spreadsheet based on URL parameter
  useEffect(() => {
    const loadData = async () => {
      // Reset loading state
      setIsLoading(true);
      setError(null);
      
      // Get ID from URL
      const { id } = router.query;
      
      // If no ID or ID is 'new', don't load
      if (!id || id === 'new' || !user) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Load the spreadsheet data
        const result = await loadSpreadsheetData(
          id,
          user,
          setSpreadsheetId,
          setDocumentTitle,
          setSheets,
          setActiveSheetId,
          setData,
          allSheetsRef,
          router
        );
        
        if (!result.success) {
          setError(result.error);
        }
      } catch (err) {
        console.error('Error loading spreadsheet:', err);
        setError(err.message || 'Failed to load spreadsheet');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (router.isReady) {
      loadData();
    }
  }, [
    router.isReady, 
    router.query, 
    user, 
    setActiveSheetId, 
    setData, 
    setDocumentTitle, 
    setSheets, 
    setSpreadsheetId, 
    allSheetsRef,
    router
  ]);
  
  return { isLoading, error };
};

export default useLoadSpreadsheet; 