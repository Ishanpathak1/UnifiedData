import { runPCA } from '../../utils/analytics';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { matrix_a, operation } = req.body;

    if (!matrix_a || !operation) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let result;

    if (operation === 'pca') {
      // Run PCA on the data
      result = runPCA(matrix_a);
      return res.status(200).json({
        result: result.transformed,
        explained_variance: result.explainedVariance,
        components: result.components,
        result_type: 'pca'
      });
    }
    
    // For now, we'll return an error for other operations
    return res.status(400).json({ error: 'Operation not supported yet' });
    
  } catch (error) {
    console.error('Matrix operation error:', error);
    return res.status(500).json({ error: error.message });
  }
} 