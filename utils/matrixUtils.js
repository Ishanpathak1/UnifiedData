// Detect if a query is related to matrix operations
export function detectOperationType(query) {
  const normalizedQuery = query.toLowerCase();
  
  // Matrix multiplication
  if ((normalizedQuery.includes('matrix') && 
      (normalizedQuery.includes('multiply') || normalizedQuery.includes('multiplication') || 
       normalizedQuery.includes('product'))) ||
      normalizedQuery.includes('matrix multiplication')) {
    return 'multiply';
  }
  
  // Addition
  if ((normalizedQuery.includes('matrix') && 
      (normalizedQuery.includes('add') || normalizedQuery.includes('addition') || 
       normalizedQuery.includes('sum'))) ||
      normalizedQuery.includes('matrix addition')) {
    return 'add';
  }
  
  // Subtraction
  if ((normalizedQuery.includes('matrix') && 
      (normalizedQuery.includes('subtract') || normalizedQuery.includes('subtraction') || 
       normalizedQuery.includes('difference'))) ||
      normalizedQuery.includes('matrix subtraction')) {
    return 'subtract';
  }
  
  // Transpose
  if (normalizedQuery.includes('transpose') || 
      (normalizedQuery.includes('matrix') && normalizedQuery.includes('transpose'))) {
    return 'transpose';
  }
  
  // Determinant
  if (normalizedQuery.includes('determinant') || 
      (normalizedQuery.includes('matrix') && normalizedQuery.includes('determinant'))) {
    return 'determinant';
  }
  
  // Inverse
  if (normalizedQuery.includes('inverse') || 
      (normalizedQuery.includes('matrix') && normalizedQuery.includes('inverse'))) {
    return 'inverse';
  }
  
  // Eigenvalues
  if (normalizedQuery.includes('eigenvalue') || 
      normalizedQuery.includes('eigen value') ||
      normalizedQuery.includes('characteristic value') ||
      (normalizedQuery.includes('matrix') && normalizedQuery.includes('eigen'))) {
    return 'eigenvalues';
  }
  
  // PCA (handle as a special case)
  if (normalizedQuery.includes('pca') || 
      normalizedQuery.includes('principal component analysis') ||
      (normalizedQuery.includes('principal') && normalizedQuery.includes('component'))) {
    return 'pca';
  }
  
  // Correlation analysis
  if (normalizedQuery.includes('correlation') || 
      normalizedQuery.includes('correlate') ||
      normalizedQuery.includes('covariance')) {
    return 'correlation';
  }
  
  // SVD
  if (normalizedQuery.includes('svd') || 
      normalizedQuery.includes('singular value decomposition')) {
    return 'svd';
  }
  
  // Not a matrix operation
  return null;
}

// Add this additional formatter function
export function formatMatrixResult(result, operation, columnNames) {
  // Return a clean, concise explanation based on operation type
  
  if (!result) return "";
  
  const matrixNames = columnNames.join(', ');
  
  if (operation === 'eigenvalues' && result.result_type === 'vector') {
    const eigenvalues = result.result.map((val, i) => {
      if (typeof val === 'object') {
        // Complex eigenvalue
        return `λ${i+1} = ${val.real.toFixed(2)}${val.imag >= 0 ? ' + ' : ' - '}${Math.abs(val.imag).toFixed(2)}i`;
      } else {
        // Real eigenvalue
        return `λ${i+1} = ${val.toFixed(2)}`;
      }
    });
    
    return `Eigenvalues for the matrix using columns ${matrixNames}:\n${eigenvalues.join('\n')}`;
  }
  
  if (operation === 'determinant' && result.result_type === 'scalar') {
    return `The determinant of the matrix using ${matrixNames} is ${result.result.toFixed(4)}`;
  }
  
  if (operation === 'inverse' && result.result_type === 'matrix') {
    return `Inverse matrix calculated successfully. The matrix is invertible.`;
  }
  
  if (operation === 'transpose' && result.result_type === 'matrix') {
    return `Transpose of the matrix using ${matrixNames} calculated successfully.`;
  }
  
  if (['add', 'subtract', 'multiply'].includes(operation) && result.result_type === 'matrix') {
    return `Matrix ${operation === 'add' ? 'addition' : operation === 'subtract' ? 'subtraction' : 'multiplication'} performed successfully.`;
  }
  
  if (operation === 'pca' && result.result_type === 'pca') {
    return `PCA completed successfully. The first ${result.explained_variance.length} principal components explain ${
      (result.explained_variance.reduce((a, b) => a + b, 0) * 100).toFixed(2)
    }% of the variance.`;
  }
  
  if (operation === 'correlation' && result.result_type === 'matrix') {
    return `Correlation matrix calculated successfully.`;
  }
  
  if (operation === 'svd' && result.result_type === 'svd') {
    return `SVD decomposition completed successfully. Found ${result.S.length} singular values.`;
  }
  
  // Generic response
  return `Calculation complete. The result has been displayed.`;
} 