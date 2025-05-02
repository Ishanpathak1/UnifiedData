// pages/api/ask.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const { query, data } = req.body;

    if (!query || !data) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Both query and data are required'
      });
    }

    // Log request for debugging
    console.log('AI API Request:', {
      query,
      dataLength: data.length,
      endpoint: 'ask'
    });

    // Forward the request to the external API
    const externalApiUrl = 'https://unifieddata-api-552541459765.us-central1.run.app/api/ask';
    
    // Create a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(externalApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, data }),
        signal: controller.signal
      });

      // Clear timeout
      clearTimeout(timeoutId);
      
      // Log response status
      console.log('External API response status:', response.status);
      
      // Get response as text first to handle both JSON and non-JSON responses
      const responseText = await response.text();
      
      let responseData;
      try {
        // Try to parse as JSON
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing response as JSON:', parseError);
        // Return the text response with original status
        return res.status(response.status).json({
          error: 'Invalid response from API',
          details: 'The API returned a non-JSON response',
          rawResponse: responseText.substring(0, 500) // Truncate long responses
        });
      }

      // Return the JSON response with original status
      const endTime = Date.now();
      console.log(`API request completed in ${endTime - startTime}ms`);
      return res.status(response.status).json(responseData);
    } catch (fetchError) {
      // Clear timeout to prevent memory leaks
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('API proxy error:', error);
    
    // Handle timeout errors specifically
    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'The API request took too long to respond'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}