import * as math from 'mathjs';

export function runPCA(data) {
  // Standardize the data
  const means = [];
  const stds = [];
  
  // Calculate means and standard deviations for each column
  for (let c = 0; c < data[0].length; c++) {
    const column = data.map(row => row[c]);
    const mean = column.reduce((sum, val) => sum + val, 0) / column.length;
    means.push(mean);
    
    const squaredDiffs = column.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / column.length;
    stds.push(Math.sqrt(variance));
  }
  
  // Standardize the data
  const standardizedData = data.map(row => 
    row.map((val, idx) => (val - means[idx]) / stds[idx])
  );
  
  // Calculate covariance matrix
  const covMatrix = calculateCovarianceMatrix(standardizedData);
  
  // Get eigenvalues and eigenvectors
  const { values, vectors } = math.eigs(math.matrix(covMatrix));
  
  // Sort eigenvectors by eigenvalues in descending order
  const eigenPairs = [];
  for (let i = 0; i < values.length; i++) {
    eigenPairs.push({
      value: values[i],
      vector: vectors.map(row => row[i])
    });
  }
  
  eigenPairs.sort((a, b) => b.value - a.value);
  
  // Get explained variance
  const totalVariance = eigenPairs.reduce((sum, pair) => sum + pair.value, 0);
  const explainedVariance = eigenPairs.map(pair => pair.value / totalVariance);
  
  // Select top 2 components (or less if there are fewer features)
  const numComponents = Math.min(2, eigenPairs.length);
  const components = eigenPairs.slice(0, numComponents).map(pair => pair.vector);
  
  // Project data onto principal components
  const transformedData = standardizedData.map(row => {
    return components.map(component => {
      return row.reduce((sum, val, idx) => sum + val * component[idx], 0);
    });
  });
  
  return {
    transformed: transformedData,
    explainedVariance: explainedVariance.slice(0, numComponents),
    components: components
  };
}

// Calculate covariance matrix
function calculateCovarianceMatrix(standardizedData) {
  const numFeatures = standardizedData[0].length;
  const numSamples = standardizedData.length;
  
  // Initialize covariance matrix
  const covMatrix = Array(numFeatures).fill().map(() => Array(numFeatures).fill(0));
  
  // Calculate covariance for each pair of features
  for (let i = 0; i < numFeatures; i++) {
    for (let j = i; j < numFeatures; j++) {
      let sum = 0;
      for (let k = 0; k < numSamples; k++) {
        sum += standardizedData[k][i] * standardizedData[k][j];
      }
      const cov = sum / (numSamples - 1);
      covMatrix[i][j] = cov;
      covMatrix[j][i] = cov; // Symmetric matrix
    }
  }
  
  return covMatrix;
} 