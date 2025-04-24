// pages/api/visualize.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const { query, data } = req.body;

  // Convert data to tab-separated string for better formatting
  const formattedData = data.map(row => row.join('\t')).join('\n');

  try {
    const prompt = `
Here is a spreadsheet table (tab-separated):

${formattedData}

User's visualization request: ${query}

Your task is to:
1. Determine the best chart type for visualizing this data based on the request.
2. Valid chart types are: bar, line, pie, doughnut, radar, polarArea, scatter
3. Provide a brief explanation of why this chart type is appropriate.

Return a JSON response with the following fields:
- chartType: The recommended chart type (one of the valid types listed above)
- explanation: A brief explanation of why this chart type is appropriate for the data and request.

For example:
{
  "chartType": "bar",
  "explanation": "A bar chart is appropriate because you're comparing discrete categories."
}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // or your preferred model
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    });

    // Parse the response
    try {
      const jsonResponse = JSON.parse(completion.choices[0].message.content);
      res.status(200).json(jsonResponse);
    } catch (parseError) {
      // Fallback if the response isn't valid JSON
      res.status(200).json({ 
        answer: "I analyzed your data but couldn't determine the best visualization. Try being more specific about what you want to visualize.",
        chartType: null
      });
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ 
      error: 'Failed to process your request',
      details: error.message 
    });
  }
}